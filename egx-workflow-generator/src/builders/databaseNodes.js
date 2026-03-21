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

  is_audited_24h        BOOLEAN DEFAULT false,
  is_audited_5d         BOOLEAN DEFAULT false,
  actual_price_24h      NUMERIC(12,4),
  actual_price_5d       NUMERIC(12,4),
  direction_correct_24h BOOLEAN,
  direction_correct_5d  BOOLEAN,
  price_accuracy_24h    NUMERIC(5,2),
  price_accuracy_5d     NUMERIC(5,2),

  UNIQUE(ticker, run_date)
);

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
  ROUND(CAST(1 - (embedding <=> '{{$json.embeddingStr}}'::vector) AS NUMERIC), 4) AS similarity
FROM egx_trading_journal
WHERE ticker = '{{$json.stock}}'
  AND is_audited_24h = true
  AND embedding IS NOT NULL
ORDER BY embedding <=> '{{$json.embeddingStr}}'::vector ASC
LIMIT 2
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

const dbRows = $input.all().map(i => i.json);

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
  });
}

return Object.values(origMap).map(orig => ({
  json: {
    ...orig,
    smartContext: contextMap[orig.stock] || [],
  }
}));
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
  ];

  inserts.push('\\n  (' + row.join(', ') + ')');
}

if (!inserts.length) {
  return [{ json: { _dbWrite: 'skip', reason: 'no stocks to archive' } }];
}

const sql = 'INSERT INTO egx_trading_journal\\n' +
  '  (ticker, run_date, run_timestamp, market_state_text, embedding,\\n' +
  '   price_at_analysis, ai_action, ai_confidence, ai_reasoning, ai_targets, invalidation_note)\\n' +
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
      sqlUpdates.push(
        'UPDATE egx_trading_journal SET ' +
        'actual_price_24h = ' + currentPrice + ', ' +
        'direction_correct_24h = ' + dirCorrect + ', ' +
        'price_accuracy_24h = ' + acc + ', ' +
        'is_audited_24h = true ' +
        'WHERE id = ' + row.id + ';'
      );
    } else {
      sqlUpdates.push(
        'UPDATE egx_trading_journal SET ' +
        'actual_price_5d = ' + currentPrice + ', ' +
        'direction_correct_5d = ' + dirCorrect + ', ' +
        'price_accuracy_5d = ' + acc + ', ' +
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

  const mergeNode = createCodeNode(
    'Merge Smart Context',
    MERGE_SMART_CONTEXT_CODE,
    [startX + 800, startY]
  );

  const nodes = [embedNode, searchNode, mergeNode];

  const connections = mergeConnections(
    createConnection(prevNodeName, 'Embed Market States'),
    createConnection('Embed Market States', 'Smart Context Search'),
    createConnection('Smart Context Search', 'Merge Smart Context')
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
};
