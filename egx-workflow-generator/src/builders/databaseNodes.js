/**
 * databaseNodes.js — Semantic RAG Database Nodes for EGX Deep Analyst
 *
 * Implements "Smart Context" — a pgvector-backed semantic memory that retrieves
 * the 2 most similar past trading days from the journal and injects them into
 * the AI prompt so the model can reason by analogy.
 *
 * Architecture (pipeline nodes):
 *   1. Schema Init            — CREATE TABLE + indexes (idempotent, runs each execution)
 *   2. Embed Market States    — Code node: builds market-state text, calls Ollama embeddings
 *   3. Smart Context Search   — Postgres node: pgvector cosine similarity (LIMIT 2)
 *   4. Merge Smart Context    — Code node: re-merges DB rows with original pipeline items
 *   5. Build Archive          — Code node: prepares INSERT SQL with embedding literals
 *   6. Write To Journal       — Postgres node: INSERT ON CONFLICT UPDATE
 *
 * Auditor nodes (separate workflow):
 *   7. Query Pending 24h/5d
 *   8. Fetch & Score
 *   9. Update Audit
 *
 * Requires:
 *   - pgvector/pgvector:16-bookworm Docker image
 *   - Ollama sidecar (ollama/ollama:latest) with nomic-embed-text model pulled
 *   - n8n Postgres credential id: 'SMM23XuwjMBme4xR', name: 'Postgres account'
 */

'use strict';

const {
  createCodeNode,
  createConnection,
  mergeConnections,
  TIMEZONE_HELPERS,
  EMBED_HELPER_CODE,
} = require('../lib/utils');

// ──────────────────────────────────────────────────────────────────
// HELPER: Create an n8n Postgres node
// ──────────────────────────────────────────────────────────────────

let _pgNodeIdCounter = 0;

function createPostgresNode(name, query, position, opts = {}) {
  _pgNodeIdCounter++;
  const hex = _pgNodeIdCounter.toString(16).padStart(4, '0');
  const ts = Date.now().toString(16).slice(-12);
  return {
    parameters: {
      operation: 'executeQuery',
      query,
      options: opts.options || {},
      ...(opts.additionalParams || {}),
    },
    id: `pg-${hex}-0000-0000-${ts}`,
    name,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position,
    continueOnFail: opts.continueOnFail || false,
    credentials: {
      postgres: {
        id: 'SMM23XuwjMBme4xR',
        name: 'Postgres account',
      },
    },
  };
}

function resetPgNodeIds() {
  _pgNodeIdCounter = 0;
}

// ──────────────────────────────────────────────────────────────────
// SCHEMA (semantic vector schema)
// ──────────────────────────────────────────────────────────────────

const SCHEMA_INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS egx_trading_journal (
  id                    BIGSERIAL PRIMARY KEY,
  ticker                VARCHAR(20)  NOT NULL,
  run_date              DATE         NOT NULL,
  run_timestamp         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  market_state_text     TEXT,
  embedding             vector(768),

  price_at_analysis     NUMERIC(12,4),

  ai_action             VARCHAR(20),
  ai_confidence         NUMERIC(5,2),
  ai_reasoning          TEXT,
  ai_targets            JSONB,
  invalidation_note     TEXT,

  -- Context columns (stored at prediction time for aggregate learning)
  ai_regime             VARCHAR(20),
  confluence_score      NUMERIC(6,2),
  wave_signal           VARCHAR(40),
  arbs_score            SMALLINT,
  wave_trading_signal   VARCHAR(30),
  nesting_3of3          BOOLEAN DEFAULT false,

  is_audited_24h        BOOLEAN DEFAULT false,
  is_audited_5d         BOOLEAN DEFAULT false,
  actual_price_24h      NUMERIC(12,4),
  actual_price_5d       NUMERIC(12,4),
  direction_correct_24h BOOLEAN,
  direction_correct_5d  BOOLEAN,
  price_accuracy_24h    NUMERIC(5,2),
  price_accuracy_5d     NUMERIC(5,2),

  -- Learning columns (computed by auditor for range calibration)
  prediction_error_pct_24h NUMERIC(8,4),
  prediction_error_pct_5d  NUMERIC(8,4),

  UNIQUE(ticker, run_date)
);

-- Backward-compatible migration: add new columns if upgrading from old schema
DO $$ BEGIN
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS ai_regime VARCHAR(20);
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS confluence_score NUMERIC(6,2);
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS wave_signal VARCHAR(40);
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS arbs_score SMALLINT;
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS wave_trading_signal VARCHAR(30);
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS nesting_3of3 BOOLEAN DEFAULT false;
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS prediction_error_pct_24h NUMERIC(8,4);
  ALTER TABLE egx_trading_journal ADD COLUMN IF NOT EXISTS prediction_error_pct_5d NUMERIC(8,4);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_embedding
  ON egx_trading_journal USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_journal_ticker
  ON egx_trading_journal(ticker);

CREATE INDEX IF NOT EXISTS idx_journal_date
  ON egx_trading_journal(run_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_pending_24h
  ON egx_trading_journal(run_date)
  WHERE is_audited_24h = false;

CREATE INDEX IF NOT EXISTS idx_journal_pending_5d
  ON egx_trading_journal(run_date)
  WHERE is_audited_5d = false;

CREATE INDEX IF NOT EXISTS idx_journal_regime
  ON egx_trading_journal(ai_regime)
  WHERE ai_regime IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_audited_ticker
  ON egx_trading_journal(ticker, run_date DESC)
  WHERE is_audited_24h = true;
`.trim();

// ──────────────────────────────────────────────────────────────────
// EMBED MARKET STATES code (injected into n8n Code node)
// ──────────────────────────────────────────────────────────────────

const EMBED_STATES_CODE = `
if ($input.all()[0]?.json?._skip) return [{ json: { _skip: true, reason: 'EGX closed' } }];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const httpReq = this.helpers.httpRequest;

${EMBED_HELPER_CODE}

const items = $input.all();
const results = [];

for (const item of items) {
  const d = item.json;

  if (d._skip || d._fetchLog || d.isIndex) {
    results.push({ json: d });
    continue;
  }

  const regime   = d.regime?.regime || 'unknown';
  const egx30    = d.macroBaseline?.regime || 'unknown';
  const conf     = d.confluence?.score ?? 0;
  const wave     = d.waveAlignment?.signal || 'none';
  const tf4H     = d.tf?.['4H'] || d.tf?.['1H'] || {};
  const tf30m    = d.tf?.['30m'] || {};
  const instFlow = d.institutionalFlow || {};

  const mst = [
    'Ticker: ' + d.stock + (d.fullName ? ' (' + d.fullName + ')' : ''),
    'DateSession: ' + new Date().toISOString().slice(0, 10),
    'Regime: ' + regime + ' | EGX30_Regime: ' + egx30,
    'MTF_Confluence: ' + conf + ' | WaveAlignment: ' + wave,
    'EMA_Alignment: ' + (tf4H.ema || 'unknown'),
    'RSI14: ' + (tf4H.rsi ?? '') + ' | RSI3: ' + (tf4H.rsi3 ?? '') + ' | RSI_slope: ' + (tf4H.rsiSlp ?? ''),
    'MACD_hist: ' + (tf4H.mH ?? '') + ' | MACD_slope: ' + (tf4H.mHS ?? '') + ' | MACD_xover: ' + (tf4H.mX ?? ''),
    'ADX_val: ' + (tf4H.adx?.v ?? '') + ' | ADX_sig: ' + (tf4H.adx?.sig ?? '') + ' | PDI: ' + (tf4H.adx?.pdi ?? '') + ' | MDI: ' + (tf4H.adx?.mdi ?? ''),
    'BB_pctB: ' + (tf4H.bb?.pB ?? '') + ' | BB_sig: ' + (tf4H.bb?.sig ?? '') + ' | BB_width: ' + (tf4H.bb?.w ?? ''),
    'Stoch_K: ' + (tf4H.stoch?.k ?? '') + ' | Stoch_D: ' + (tf4H.stoch?.d ?? '') + ' | Stoch_sig: ' + (tf4H.stoch?.sig ?? ''),
    'MFI: ' + (tf4H.vol?.mfi ?? '') + ' | CMF: ' + (tf4H.vol?.cmf ?? '') + ' | SmartMoney: ' + (tf4H.vol?.sm ?? ''),
    'VVP_pos: ' + (tf4H.vvp?.pos ?? '') + ' | VVP_POC: ' + (tf4H.vvp?.poc ?? '') + ' | VAH: ' + (tf4H.vvp?.vah ?? '') + ' | VAL: ' + (tf4H.vvp?.val ?? ''),
    'Price: ' + (d.currentPrice ?? ''),
    'Turnover_ratio: ' + (tf4H.to?.r ?? '') + ' | Turnover_avg20: ' + (tf4H.to?.avg ?? ''),
    'EW_wave: ' + (tf4H.ew?.l ?? '') + ' | EW_phase: ' + (tf4H.ew?.p ?? '') + ' | EW_quality: ' + (tf4H.ew?.q ?? ''),
    'RSI_div: ' + (tf4H.div?.rsi || 'none') + ' | MACD_div: ' + (tf4H.div?.macd || 'none'),
    'Ichimoku_cloud: ' + (tf4H.ichi?.cloud ?? '') + ' | TK: ' + (tf4H.ichi?.tk ?? ''),
    'FIB_618: ' + (tf4H.fib?.f618 ?? '') + ' | FIB_500: ' + (tf4H.fib?.f500 ?? '') + ' | FIB_786: ' + (tf4H.fib?.f786 ?? ''),
    'ForeignFlow: ' + (instFlow.foreignSentiment || 'unknown') + ' | ArabFlow: ' + (instFlow.arabSentiment || 'unknown'),
    'Catalyst_count: ' + (d.news?.length ?? 0),
    '30m_RSI: ' + (tf30m.rsi ?? '') + ' | 30m_EMA: ' + (tf30m.ema ?? ''),
  ].filter(l => !l.match(/:\s*$/) && !l.match(/: undefined/)).join('\\n');

  const embeddingStr = await generateEmbedding(httpReq, mst);

  results.push({ json: { ...d, marketStateText: mst, embeddingStr } });

  await sleep(150);
}

return results;
`.trim();

// ──────────────────────────────────────────────────────────────────
// SMART CONTEXT SEARCH SQL
// ──────────────────────────────────────────────────────────────────

const SMART_CONTEXT_SEARCH_SQL = `
SELECT
  ticker,
  run_date,
  ai_action,
  ai_confidence,
  ai_reasoning,
  market_state_text,
  ai_targets,
  invalidation_note,
  ai_regime,
  confluence_score,
  arbs_score,
  direction_correct_24h,
  direction_correct_5d,
  price_accuracy_24h,
  price_accuracy_5d,
  actual_price_24h,
  actual_price_5d,
  prediction_error_pct_24h,
  prediction_error_pct_5d,
  ROUND(CAST(1 - (embedding <=> '{{$json.embeddingStr}}'::vector) AS NUMERIC), 4) AS similarity
FROM egx_trading_journal
WHERE ticker = '{{$json.stock}}'
  AND is_audited_24h = true
  AND embedding IS NOT NULL
ORDER BY embedding <=> '{{$json.embeddingStr}}'::vector ASC
LIMIT 2
`.trim();

// ──────────────────────────────────────────────────────────────────
// CROSS-TICKER SIMILARITY SEARCH (fallback for stocks with limited history)
// ──────────────────────────────────────────────────────────────────

const CROSS_TICKER_SEARCH_SQL = `
SELECT
  ticker,
  run_date,
  ai_action,
  ai_confidence,
  ai_regime,
  confluence_score,
  arbs_score,
  direction_correct_24h,
  direction_correct_5d,
  price_accuracy_24h,
  price_accuracy_5d,
  ROUND(CAST(1 - (embedding <=> '{{$json.embeddingStr}}'::vector) AS NUMERIC), 4) AS similarity
FROM egx_trading_journal
WHERE ticker != '{{$json.stock}}'
  AND is_audited_24h = true
  AND embedding IS NOT NULL
  AND (1 - (embedding <=> '{{$json.embeddingStr}}'::vector)) > 0.80
ORDER BY embedding <=> '{{$json.embeddingStr}}'::vector ASC
LIMIT 3
`.trim();

// ──────────────────────────────────────────────────────────────────
// TICKER PERFORMANCE STATS (self-learning feedback per stock)
// ──────────────────────────────────────────────────────────────────

const TICKER_PERF_STATS_SQL = `
WITH ticker_stats AS (
  SELECT
    ticker,
    COUNT(*) AS total_predictions,
    COUNT(*) FILTER (WHERE is_audited_24h) AS audited_24h_count,
    COUNT(*) FILTER (WHERE is_audited_5d)  AS audited_5d_count,
    ROUND(AVG(CASE WHEN direction_correct_24h THEN 1 ELSE 0 END) FILTER (WHERE is_audited_24h) * 100, 1) AS dir_accuracy_24h_pct,
    ROUND(AVG(CASE WHEN direction_correct_5d  THEN 1 ELSE 0 END) FILTER (WHERE is_audited_5d)  * 100, 1) AS dir_accuracy_5d_pct,
    ROUND(AVG(price_accuracy_24h) FILTER (WHERE is_audited_24h) * 100, 1) AS avg_price_acc_24h_pct,
    ROUND(AVG(price_accuracy_5d)  FILTER (WHERE is_audited_5d)  * 100, 1) AS avg_price_acc_5d_pct,
    ROUND(AVG(ai_confidence), 1) AS avg_confidence,
    ROUND(AVG(prediction_error_pct_24h) FILTER (WHERE is_audited_24h) * 100, 2) AS avg_error_bias_24h_pct,
    ROUND(AVG(prediction_error_pct_5d)  FILTER (WHERE is_audited_5d)  * 100, 2) AS avg_error_bias_5d_pct
  FROM egx_trading_journal
  GROUP BY ticker
  HAVING COUNT(*) FILTER (WHERE is_audited_24h) >= 3
),
recent_streak AS (
  SELECT
    ticker,
    ARRAY_AGG(direction_correct_24h ORDER BY run_date DESC) AS last_results
  FROM (
    SELECT ticker, run_date, direction_correct_24h
    FROM egx_trading_journal
    WHERE is_audited_24h = true
    ORDER BY run_date DESC
  ) sub
  GROUP BY ticker
),
confidence_calibration AS (
  SELECT
    ticker,
    ROUND(AVG(CASE WHEN direction_correct_24h THEN 1 ELSE 0 END) FILTER (WHERE ai_confidence < 40)  * 100, 0) AS acc_when_conf_low,
    ROUND(AVG(CASE WHEN direction_correct_24h THEN 1 ELSE 0 END) FILTER (WHERE ai_confidence >= 40 AND ai_confidence < 65) * 100, 0) AS acc_when_conf_med,
    ROUND(AVG(CASE WHEN direction_correct_24h THEN 1 ELSE 0 END) FILTER (WHERE ai_confidence >= 65 AND ai_confidence < 80) * 100, 0) AS acc_when_conf_high,
    ROUND(AVG(CASE WHEN direction_correct_24h THEN 1 ELSE 0 END) FILTER (WHERE ai_confidence >= 80) * 100, 0) AS acc_when_conf_very_high
  FROM egx_trading_journal
  WHERE is_audited_24h = true
  GROUP BY ticker
  HAVING COUNT(*) FILTER (WHERE is_audited_24h) >= 5
)
SELECT
  ts.*,
  rs.last_results[1:5] AS recent_5_results,
  cc.acc_when_conf_low,
  cc.acc_when_conf_med,
  cc.acc_when_conf_high,
  cc.acc_when_conf_very_high
FROM ticker_stats ts
LEFT JOIN recent_streak rs ON ts.ticker = rs.ticker
LEFT JOIN confidence_calibration cc ON ts.ticker = cc.ticker
ORDER BY ts.ticker
`.trim();

// ──────────────────────────────────────────────────────────────────
// REGIME PERFORMANCE STATS (learning by market condition)
// ──────────────────────────────────────────────────────────────────

const REGIME_PERF_STATS_SQL = `
SELECT
  ai_regime AS regime,
  ai_action AS action,
  COUNT(*) AS sample_count,
  ROUND(AVG(CASE WHEN direction_correct_24h THEN 1 ELSE 0 END) * 100, 1) AS dir_accuracy_24h_pct,
  ROUND(AVG(CASE WHEN direction_correct_5d  THEN 1 ELSE 0 END) * 100, 1) AS dir_accuracy_5d_pct,
  ROUND(AVG(price_accuracy_24h) * 100, 1) AS avg_price_acc_24h_pct,
  ROUND(AVG(ai_confidence), 1) AS avg_confidence
FROM egx_trading_journal
WHERE is_audited_24h = true
  AND ai_regime IS NOT NULL
GROUP BY ai_regime, ai_action
HAVING COUNT(*) >= 3
ORDER BY ai_regime, ai_action
`.trim();

// ──────────────────────────────────────────────────────────────────
// MERGE SMART CONTEXT code
// ──────────────────────────────────────────────────────────────────

const MERGE_SMART_CONTEXT_CODE = `
if ($input.all()[0]?.json?._skip) return [{ json: { _skip: true, reason: 'EGX closed' } }];

const origItems = $('Embed Market States').all().map(i => i.json);
const origMap = {};
for (const orig of origItems) {
  if (orig.stock) origMap[orig.stock] = orig;
}

// Same-ticker context rows
const dbRows = $('Smart Context Search').all().map(i => i.json);

// Cross-ticker fallback rows
let crossRows = [];
try {
  crossRows = $('Cross-Ticker Search').all().map(i => i.json);
} catch(e) {}

const contextMap = {};
for (const row of dbRows) {
  const t = row.ticker;
  if (!t) continue;
  if (!contextMap[t]) contextMap[t] = [];

  let targets = {};
  try {
    targets = typeof row.ai_targets === 'string'
      ? JSON.parse(row.ai_targets)
      : (row.ai_targets || {});
  } catch(e) {}

  contextMap[t].push({
    date:         row.run_date,
    action:       row.ai_action,
    confidence:   row.ai_confidence,
    reasoning:    (row.ai_reasoning || '').slice(0, 500),
    marketState:  (row.market_state_text || '').slice(0, 400),
    targets,
    invalidation: row.invalidation_note,
    similarity:   row.similarity,
    // Audit outcome data (learning loop)
    dirCorrect24h:  row.direction_correct_24h,
    dirCorrect5d:   row.direction_correct_5d,
    priceAcc24h:    row.price_accuracy_24h,
    priceAcc5d:     row.price_accuracy_5d,
    actualPrice24h: row.actual_price_24h,
    actualPrice5d:  row.actual_price_5d,
    regime:         row.ai_regime,
    confScore:      row.confluence_score,
    arbsScore:      row.arbs_score,
    errorBias24h:   row.prediction_error_pct_24h,
    errorBias5d:    row.prediction_error_pct_5d,
  });
}

// Cross-ticker fallback: for tickers with <2 same-ticker results
const crossContextMap = {};
for (const row of crossRows) {
  // Don't assign to a specific ticker — these are analogous setups from OTHER tickers
  const srcTicker = row.ticker;
  if (!crossContextMap[srcTicker]) crossContextMap[srcTicker] = [];
  crossContextMap[srcTicker].push({
    sourceTicker: srcTicker,
    date:         row.run_date,
    action:       row.ai_action,
    confidence:   row.ai_confidence,
    similarity:   row.similarity,
    dirCorrect24h: row.direction_correct_24h,
    dirCorrect5d:  row.direction_correct_5d,
    priceAcc24h:   row.price_accuracy_24h,
    regime:        row.ai_regime,
    confScore:     row.confluence_score,
    arbsScore:     row.arbs_score,
  });
}

// Performance stats (ticker + regime)
let tickerPerfStats = {};
let regimePerfStats = [];
try {
  const perfRows = $('Fetch Ticker Stats').all().map(i => i.json);
  for (const row of perfRows) {
    if (row.ticker) tickerPerfStats[row.ticker] = row;
  }
} catch(e) {}
try {
  regimePerfStats = $('Fetch Regime Stats').all().map(i => i.json).filter(r => r.regime);
} catch(e) {}

return Object.values(origMap).map(orig => {
  const sameTickerCtx = contextMap[orig.stock] || [];
  // If <2 same-ticker results, add cross-ticker analogues
  let crossTickerCtx = [];
  if (sameTickerCtx.length < 2) {
    const allCross = Object.values(crossContextMap).flat();
    crossTickerCtx = allCross
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, 3 - sameTickerCtx.length);
  }

  return {
    json: {
      ...orig,
      smartContext: sameTickerCtx,
      crossTickerContext: crossTickerCtx,
      performanceStats: tickerPerfStats[orig.stock] || null,
      regimeStats: regimePerfStats,
    }
  };
});
`.trim();

// ──────────────────────────────────────────────────────────────────
// BUILD ARCHIVE code
// ──────────────────────────────────────────────────────────────────

const BUILD_ARCHIVE_CODE = `
${TIMEZONE_HELPERS}

let analysisItems = [];
try {
  analysisItems = $('AI Analysis Per Stock').all().map(i => i.json);
} catch(e) {
  analysisItems = $input.all().map(i => i.json);
}

const embedMap = {};
try {
  for (const ei of $('Embed Market States').all()) {
    if (ei.json.stock) embedMap[ei.json.stock] = ei.json;
  }
} catch(e) {}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return isNaN(v) ? 'NULL' : String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const inserts = [];

for (const stock of analysisItems) {
  if (stock._skip || stock._fetchLog || stock.isIndex) continue;
  const ticker = stock.stock || stock.ticker || '';
  if (!ticker) continue;

  const ai     = stock.ai || {};
  const embed  = embedMap[ticker] || {};
  const price  = embed.currentPrice || stock.currentPrice || null;
  const mst    = (embed.marketStateText || '').slice(0, 3000);
  const embStr = embed.embeddingStr || null;

  const targets = {
    entry:       ai.entry            || null,
    tp:          ai.takeProfit       || null,
    sl:          ai.stopLoss         || null,
    horizon:     ai.entryWindow      || null,
    pred24hLow:  ai.prediction_24h?.low  || null,
    pred24hHigh: ai.prediction_24h?.high || null,
    pred5dLow:   ai.prediction_5d?.low   || null,
    pred5dHigh:  ai.prediction_5d?.high  || null,
  };

  const reasoning        = (ai.reasoning_ar || ai.reasoning || '').slice(0, 1500);
  const invalidationNote = ai.invalidation
    ? (ai.invalidation.basis || '') + '@' + (ai.invalidation.price || 0)
    : null;

  // Context columns for aggregate learning
  const aiRegime         = ai.regime || stock.regime?.regime || null;
  const confScore        = stock.confluence?.score ?? null;
  const waveSignal       = stock.waveAlignment?.signal || null;
  const arbsScoreVal     = ai.arbsScore ?? stock.arbsScore ?? null;
  const waveTradSig      = ai.waveTradingSignal || null;
  const nesting          = ai.nesting3of3 || false;

  const embLiteral = embStr
    ? ("'" + embStr.replace(/'/g, "''") + "'::vector")
    : 'NULL';

  const row = [
    esc(ticker),
    'CURRENT_DATE',
    'NOW()',
    esc(mst),
    embLiteral,
    esc(price ? Number(price) : null),
    esc(ai.action || 'HOLD'),
    esc(ai.confidence != null ? Number(ai.confidence) : 0),
    esc(reasoning),
    esc(JSON.stringify(targets)),
    esc(invalidationNote),
    esc(aiRegime),
    esc(confScore != null ? Number(confScore) : null),
    esc(waveSignal),
    esc(arbsScoreVal != null ? Number(arbsScoreVal) : null),
    esc(waveTradSig),
    nesting ? 'true' : 'false',
  ];

  inserts.push('\\n  (' + row.join(', ') + ')');
}

if (!inserts.length) {
  return [{ json: { _dbWrite: 'skip', reason: 'no stocks to archive' } }];
}

const sql = 'INSERT INTO egx_trading_journal\\n' +
  '  (ticker, run_date, run_timestamp, market_state_text, embedding,\\n' +
  '   price_at_analysis, ai_action, ai_confidence, ai_reasoning, ai_targets, invalidation_note,\\n' +
  '   ai_regime, confluence_score, wave_signal, arbs_score, wave_trading_signal, nesting_3of3)\\n' +
  'VALUES' + inserts.join(',') + '\\n' +
  'ON CONFLICT (ticker, run_date) DO UPDATE SET\\n' +
  '  market_state_text  = EXCLUDED.market_state_text,\\n' +
  '  embedding          = EXCLUDED.embedding,\\n' +
  '  price_at_analysis  = EXCLUDED.price_at_analysis,\\n' +
  '  ai_action          = EXCLUDED.ai_action,\\n' +
  '  ai_confidence      = EXCLUDED.ai_confidence,\\n' +
  '  ai_reasoning       = EXCLUDED.ai_reasoning,\\n' +
  '  ai_targets         = EXCLUDED.ai_targets,\\n' +
  '  invalidation_note  = EXCLUDED.invalidation_note,\\n' +
  '  ai_regime          = EXCLUDED.ai_regime,\\n' +
  '  confluence_score   = EXCLUDED.confluence_score,\\n' +
  '  wave_signal        = EXCLUDED.wave_signal,\\n' +
  '  arbs_score         = EXCLUDED.arbs_score,\\n' +
  '  wave_trading_signal = EXCLUDED.wave_trading_signal,\\n' +
  '  nesting_3of3       = EXCLUDED.nesting_3of3,\\n' +
  '  run_timestamp      = EXCLUDED.run_timestamp;';

return [{ json: { _dbWriteQuery: sql } }];
`.trim();

// ──────────────────────────────────────────────────────────────────
// AUDITOR QUERIES
// ──────────────────────────────────────────────────────────────────

const AUDITOR_QUERY_24H_SQL = `
SELECT
  id, ticker, run_date,
  price_at_analysis,
  ai_action,
  ai_confidence,
  (ai_targets->>'pred24hHigh')::numeric AS prediction_24h_high,
  (ai_targets->>'pred24hLow')::numeric  AS prediction_24h_low
FROM egx_trading_journal
WHERE is_audited_24h = false
  AND run_date <= CURRENT_DATE - INTERVAL '1 day'
ORDER BY run_date ASC
LIMIT 50
`.trim();

const AUDITOR_QUERY_5D_SQL = `
SELECT
  id, ticker, run_date,
  price_at_analysis,
  ai_action,
  ai_confidence,
  (ai_targets->>'pred5dHigh')::numeric AS prediction_5d_high,
  (ai_targets->>'pred5dLow')::numeric  AS prediction_5d_low
FROM egx_trading_journal
WHERE is_audited_5d = false
  AND run_date <= CURRENT_DATE - INTERVAL '5 days'
ORDER BY run_date ASC
LIMIT 50
`.trim();

const AUDITOR_FETCH_AND_SCORE_CODE = `
const httpReq = this.helpers.httpRequest;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pendingRows = $input.all().map(i => i.json);
if (!pendingRows.length || !pendingRows[0]?.id) {
  return [{ json: { _audit: 'skip', reason: 'no pending rows' } }];
}

const is24h = pendingRows[0].prediction_24h_high !== undefined;

const tickerMap = {};
for (const row of pendingRows) {
  if (!tickerMap[row.ticker]) tickerMap[row.ticker] = [];
  tickerMap[row.ticker].push(row);
}

const sqlUpdates = [];

for (const [ticker, rows] of Object.entries(tickerMap)) {
  const symbol = ticker.startsWith('^') ? ticker : ticker + '.CA';
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=1d&range=10d';

  let currentPrice = null;
  try {
    const resp = await httpReq({
      method: 'GET', url,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
      timeout: 15000,
    });
    if (resp.statusCode === 200) {
      const data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
      const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] != null) { currentPrice = closes[i]; break; }
      }
    }
  } catch(e) {}

  if (currentPrice === null) continue;

  for (const row of rows) {
    const origPrice = Number(row.price_at_analysis) || 0;
    if (!origPrice) continue;

    const predHigh = is24h
      ? Number(row.prediction_24h_high || 0)
      : Number(row.prediction_5d_high  || 0);
    const predLow  = is24h
      ? Number(row.prediction_24h_low  || 0)
      : Number(row.prediction_5d_low   || 0);
    const predMid  = (predHigh + predLow) / 2;

    const predDir   = predMid > origPrice ? 'UP' : predMid < origPrice ? 'DOWN' : 'FLAT';
    const actualDir = currentPrice > origPrice ? 'UP' : currentPrice < origPrice ? 'DOWN' : 'FLAT';
    const dirCorrect = predDir === actualDir ||
      (predDir === 'FLAT' && Math.abs(currentPrice - origPrice) / origPrice < 0.005);

    let priceAccuracy = 0;
    if (predMid > 0 && currentPrice > 0) {
      priceAccuracy = Math.max(0, 1 - Math.abs(currentPrice - predMid) / currentPrice);
    }

    const acc = Number(priceAccuracy.toFixed(4));

    if (is24h) {
      const errorPct = predMid > 0 && currentPrice > 0
        ? Number(((predMid - currentPrice) / currentPrice).toFixed(4))
        : null;
      sqlUpdates.push(
        'UPDATE egx_trading_journal SET ' +
        'actual_price_24h = ' + currentPrice + ', ' +
        'direction_correct_24h = ' + dirCorrect + ', ' +
        'price_accuracy_24h = ' + acc + ', ' +
        'prediction_error_pct_24h = ' + (errorPct !== null ? errorPct : 'NULL') + ', ' +
        'is_audited_24h = true ' +
        'WHERE id = ' + row.id + ';'
      );
    } else {
      const errorPct = predMid > 0 && currentPrice > 0
        ? Number(((predMid - currentPrice) / currentPrice).toFixed(4))
        : null;
      sqlUpdates.push(
        'UPDATE egx_trading_journal SET ' +
        'actual_price_5d = ' + currentPrice + ', ' +
        'direction_correct_5d = ' + dirCorrect + ', ' +
        'price_accuracy_5d = ' + acc + ', ' +
        'prediction_error_pct_5d = ' + (errorPct !== null ? errorPct : 'NULL') + ', ' +
        'is_audited_5d = true ' +
        'WHERE id = ' + row.id + ';'
      );
    }
  }

  await sleep(1500);
}

if (!sqlUpdates.length) {
  return [{ json: { _audit: 'skip', reason: 'no prices fetched' } }];
}

return [{ json: { _auditUpdateQuery: sqlUpdates.join('\\n'), updatedCount: sqlUpdates.length } }];
`.trim();

// ──────────────────────────────────────────────────────────────────
// BUILDERS
// ──────────────────────────────────────────────────────────────────

function buildSchemaInitNode(opts = {}) {
  const { prevNodeName = 'Holiday Gate', startX = 400, startY = 300 } = opts;

  const node = createPostgresNode('Schema Init', SCHEMA_INIT_SQL, [startX, startY]);
  const connections = createConnection(prevNodeName, 'Schema Init');

  return { nodes: [node], connections, lastNodeName: 'Schema Init' };
}

function buildSemanticRetrievalNodes(opts = {}) {
  const { prevNodeName = 'Compress for AI', startX = 1400, startY = 300 } = opts;

  const embedNode = createCodeNode(
    'Embed Market States',
    EMBED_STATES_CODE,
    [startX, startY]
  );

  const searchNode = createPostgresNode(
    'Smart Context Search',
    SMART_CONTEXT_SEARCH_SQL,
    [startX + 400, startY],
    { continueOnFail: true }
  );

  const crossSearchNode = createPostgresNode(
    'Cross-Ticker Search',
    CROSS_TICKER_SEARCH_SQL,
    [startX + 400, startY + 200],
    { continueOnFail: true }
  );

  const tickerStatsNode = createPostgresNode(
    'Fetch Ticker Stats',
    TICKER_PERF_STATS_SQL,
    [startX + 800, startY + 200],
    { continueOnFail: true }
  );

  const regimeStatsNode = createPostgresNode(
    'Fetch Regime Stats',
    REGIME_PERF_STATS_SQL,
    [startX + 800, startY + 400],
    { continueOnFail: true }
  );

  const mergeNode = createCodeNode(
    'Merge Smart Context',
    MERGE_SMART_CONTEXT_CODE,
    [startX + 1200, startY]
  );

  const nodes = [embedNode, searchNode, crossSearchNode, tickerStatsNode, regimeStatsNode, mergeNode];

  const connections = mergeConnections(
    createConnection(prevNodeName, 'Embed Market States'),
    createConnection('Embed Market States', 'Smart Context Search'),
    createConnection('Embed Market States', 'Cross-Ticker Search'),
    createConnection('Embed Market States', 'Fetch Ticker Stats'),
    createConnection('Embed Market States', 'Fetch Regime Stats'),
    createConnection('Smart Context Search', 'Merge Smart Context'),
    createConnection('Cross-Ticker Search', 'Merge Smart Context'),
    createConnection('Fetch Ticker Stats', 'Merge Smart Context'),
    createConnection('Fetch Regime Stats', 'Merge Smart Context')
  );

  return { nodes, connections, lastNodeName: 'Merge Smart Context' };
}

function buildArchiveNodes(opts = {}) {
  const { prevNodeName = 'Format and Send to Discord', startX = 2600, startY = 300 } = opts;

  const buildNode = createCodeNode(
    'Build Archive',
    BUILD_ARCHIVE_CODE,
    [startX, startY]
  );

  const writeNode = createPostgresNode(
    'Write To Journal',
    '{{ $json._dbWriteQuery }}',
    [startX + 400, startY]
  );

  const nodes = [buildNode, writeNode];

  const connections = mergeConnections(
    createConnection(prevNodeName, 'Build Archive'),
    createConnection('Build Archive', 'Write To Journal')
  );

  return { nodes, connections, lastNodeName: 'Write To Journal' };
}

function buildAuditorNodes(opts = {}) {
  const { startX = 200, startY = 300 } = opts;

  const query24h = createPostgresNode('Query Pending 24h', AUDITOR_QUERY_24H_SQL, [startX, startY]);
  const score24h = createCodeNode('Fetch & Score 24h', AUDITOR_FETCH_AND_SCORE_CODE, [startX + 400, startY]);
  const update24h = createPostgresNode('Update Audit 24h', '{{ $json._auditUpdateQuery }}', [startX + 800, startY]);

  const query5d = createPostgresNode('Query Pending 5d', AUDITOR_QUERY_5D_SQL, [startX, startY + 250]);
  const score5d = createCodeNode('Fetch & Score 5d', AUDITOR_FETCH_AND_SCORE_CODE, [startX + 400, startY + 250]);
  const update5d = createPostgresNode('Update Audit 5d', '{{ $json._auditUpdateQuery }}', [startX + 800, startY + 250]);

  const nodes = [query24h, score24h, update24h, query5d, score5d, update5d];

  const connections = mergeConnections(
    createConnection('Query Pending 24h', 'Fetch & Score 24h'),
    createConnection('Fetch & Score 24h', 'Update Audit 24h'),
    createConnection('Query Pending 5d', 'Fetch & Score 5d'),
    createConnection('Fetch & Score 5d', 'Update Audit 5d')
  );

  return {
    nodes,
    connections,
    lastNodeName24h: 'Update Audit 24h',
    lastNodeName5d: 'Update Audit 5d',
    triggerTargets: ['Query Pending 24h', 'Query Pending 5d'],
  };
}

// ──────────────────────────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────────────────────────

module.exports = {
  buildSchemaInitNode,
  buildSemanticRetrievalNodes,
  buildArchiveNodes,
  buildAuditorNodes,
  resetPgNodeIds,
  SCHEMA_INIT_SQL,
  SMART_CONTEXT_SEARCH_SQL,
  CROSS_TICKER_SEARCH_SQL,
  TICKER_PERF_STATS_SQL,
  REGIME_PERF_STATS_SQL,
};
