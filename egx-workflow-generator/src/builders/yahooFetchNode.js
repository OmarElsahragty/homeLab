/**
 * yahooFetchNode.js — Stock Config + Yahoo Finance OHLCV Fetcher Node Generators
 *
 * Produces n8n Code node definitions for:
 *   1. Stock Config — tickers + FETCH_MATRIX + runDate
 *   2. Fetch Yahoo OHLCV (All TFs) — DST-safe, 9:30–15:00 boundaries
 *      - Timezone: Intl.DateTimeFormat (no hardcoded offset)
 *      - filterMOC: 9:30 open ≤ candle < 15:00
 *      - healGrid: 9:00–15:00 window
 *      - Fetch Matrix: 1D→1y, 1H→60d, 1W→5y
 *
 * @module yahooFetchNode
 */

'use strict';

const {
  createCodeNode,
  TIMEZONE_HELPERS,
  YAHOO_BASE,
  USER_AGENT,
} = require('../lib/utils');

// ──────────────────────────────────────────────────────────────────
// STOCK CONFIG CODE
// ──────────────────────────────────────────────────────────────────

const STOCK_CONFIG_CODE = `
/*
 * STOCK CONFIG — EGX Deep Analyst
 * Yahoo EGX ticker format: TICKER.CA
 * Fetch Matrix: 1D→1y, 1H→60d, 1W→5y. 4H synthesized from 1H.
 * 30m: 11 equal candles per 5.5h session — eliminates unequal bin distortion.\n * Note: 30m candles are no longer in FETCH_MATRIX but retained for reference.
 */
const STOCKS = [
  { ticker: 'SKPC',  name: 'Sidi Kerir Petrochemicals' },
  { ticker: 'ICFC',  name: 'International Co For Investment & Development' },
  { ticker: 'IFAP',  name: 'International Agricultural Products' },
  { ticker: 'ISMQ',  name: 'Iron And Steel for Mines and Quarries' },
  { ticker: 'ZMID',  name: 'Zahraa El Maadi Investment & Development' },
  { ticker: '^CASE30', name: 'EGX30 Index', isIndex: true }
];

const FETCH_MATRIX = [
  { id: '1D',   interval: '1d',   range: '1y',   label: 'Daily Swing' },
  { id: '1H',   interval: '60m',  range: '60d',  label: '1-Hour Entry' },
  { id: '1W',   interval: '1wk',  range: '5y',   label: 'Weekly Deep' }
];

const runDate = new Date().toISOString().split('T')[0];
return [{ json: { stocks: STOCKS, fetchMatrix: FETCH_MATRIX, runDate } }];
`;

// ──────────────────────────────────────────────────────────────────
// FETCH YAHOO OHLCV CODE — DST-safe, 9:30–15:00 boundaries
// ──────────────────────────────────────────────────────────────────

const FETCH_YAHOO_CODE = `
/*
 * YAHOO FINANCE DEFENSIVE FETCHER
 * Architecture: sequential per stock, 3 TFs, 2s delays, 3 retries
 * Data Healer: MOC filter (9:30–15:00), grid inject, piastre fix, 4H synthesis
 * Timezone: Intl.DateTimeFormat (auto-DST, no hardcoded offset)
 * filterMOC: 9:30 open ≤ candle < 15:00
 * healGrid: ≥ 9 && < 15
 * FETCH_MATRIX: 1D, 1H, 1W
 */
if ($input.all()[0]?.json?._skip) return $input.all();

${TIMEZONE_HELPERS}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const httpReq = this.helpers.httpRequest;
const config = $input.all()[0].json;
const { stocks, fetchMatrix, runDate } = config;

const YAHOO_BASE = '${YAHOO_BASE}';
const YAHOO_HEADERS = {
  'User-Agent': '${USER_AGENT}',
  'Accept': 'application/json'
};

async function fetchYahoo(ticker, interval, range, maxRetries, isIndex) {
  maxRetries = maxRetries || 3;
  const suffix = isIndex ? '' : '.CA';
  const url = YAHOO_BASE + '/' + ticker + suffix + '?interval=' + interval + '&range=' + range;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await httpReq({
        method: 'GET', url,
        headers: YAHOO_HEADERS,
        returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 20000
      });
      if (resp.statusCode === 200) {
        const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
        return { ok: true, data: body };
      }
      if (resp.statusCode === 404) return { ok: false, err: 'Yahoo 404: ' + ticker + '.CA not found' };
      if (resp.statusCode === 401 || resp.statusCode === 403) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (attempt === maxRetries - 1) return { ok: false, err: 'Yahoo HTTP ' + resp.statusCode };
    } catch (e) {
      if (attempt === maxRetries - 1) return { ok: false, err: 'Yahoo error: ' + e.message };
    }
    await sleep(2000 * Math.pow(2, attempt));
  }
  return { ok: false, err: 'Max retries exceeded' };
}

function extractOHLCV(yahooData) {
  const result = yahooData?.chart?.result?.[0];
  if (!result?.timestamp) return null;
  const ts = result.timestamp;
  const q = result.indicators?.quote?.[0];
  if (!q) return null;
  return {
    timestamps: ts,
    opens:   ts.map((_, i) => q.open?.[i] ?? null),
    highs:   ts.map((_, i) => q.high?.[i] ?? null),
    lows:    ts.map((_, i) => q.low?.[i] ?? null),
    closes:  ts.map((_, i) => q.close?.[i] ?? null),
    volumes: ts.map((_, i) => q.volume?.[i] ?? 0)
  };
}

function fixPiastreAnomaly(closes) {
  if (closes.length < 10) return closes;
  const valid = closes.filter(c => c != null && c > 0);
  if (valid.length < 5) return closes;
  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return closes.map(c => {
    if (c == null) return c;
    if (median > 0 && c > median * 50 && c < median * 200) return +(c / 100).toFixed(4);
    return c;
  });
}

// filterMOC: 9:30 open ≤ candle < 15:00
// Uses toCairoHour + toCairoMinute for precise 9:30 boundary detection
function filterMOC(raw, isIntraday) {
  if (!isIntraday || !raw) return raw;
  const idx = [];
  for (let i = 0; i < raw.timestamps.length; i++) {
    const cairoHour   = toCairoHour(raw.timestamps[i]);
    const cairoMinute = toCairoMinute(raw.timestamps[i]);
    // Accept candles at or after 9:30 AM and before 3:00 PM (15:00)
    const afterOpen = cairoHour > 9 || (cairoHour === 9 && cairoMinute >= 30);
    if (afterOpen && cairoHour < 15) idx.push(i);
  }
  return {
    timestamps: idx.map(i => raw.timestamps[i]),
    opens:   idx.map(i => raw.opens[i]),
    highs:   idx.map(i => raw.highs[i]),
    lows:    idx.map(i => raw.lows[i]),
    closes:  idx.map(i => raw.closes[i]),
    volumes: idx.map(i => raw.volumes[i])
  };
}

// healGrid: fills gaps within trading hours (>= 9 && < 15)
function healGrid(raw, intervalSec) {
  if (!raw || raw.timestamps.length < 2) return raw;
  const healed = { timestamps: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
  for (let i = 0; i < raw.timestamps.length; i++) {
    if (i > 0) {
      const gap = raw.timestamps[i] - raw.timestamps[i - 1];
      if (gap > intervalSec * 1.5 && gap < intervalSec * 50) {
        const prevClose = healed.closes[healed.closes.length - 1] || raw.closes[i - 1];
        let fillTs = raw.timestamps[i - 1] + intervalSec;
        while (fillTs < raw.timestamps[i]) {
          const fillHour = toCairoHour(fillTs);
          if (fillHour >= 9 && fillHour < 15) {
            healed.timestamps.push(fillTs);
            healed.opens.push(prevClose); healed.highs.push(prevClose);
            healed.lows.push(prevClose); healed.closes.push(prevClose);
            healed.volumes.push(0);
          }
          fillTs += intervalSec;
        }
      }
    }
    const prevClose = healed.closes.length > 0 ? healed.closes[healed.closes.length - 1] : null;
    const c = raw.closes[i], o = raw.opens[i], h = raw.highs[i], l = raw.lows[i];
    if (c != null && c > 0) {
      healed.timestamps.push(raw.timestamps[i]);
      healed.opens.push(o != null && o > 0 ? o : c);
      healed.highs.push(h != null && h > 0 ? h : c);
      healed.lows.push(l != null && l > 0 ? l : c);
      healed.closes.push(c);
      healed.volumes.push(raw.volumes[i] || 0);
    } else if (prevClose != null) {
      healed.timestamps.push(raw.timestamps[i]);
      healed.opens.push(prevClose); healed.highs.push(prevClose);
      healed.lows.push(prevClose); healed.closes.push(prevClose);
      healed.volumes.push(0);
    }
  }
  return healed;
}

function synthesize4H(healed1H) {
  if (!healed1H || healed1H.timestamps.length < 4) return null;
  const byDay = {};
  for (let i = 0; i < healed1H.timestamps.length; i++) {
    const day = toCairoDate(healed1H.timestamps[i]);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(i);
  }
  const result = { timestamps: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
  for (const day of Object.keys(byDay).sort()) {
    const indices = byDay[day];
    if (indices.length === 0) continue;
    const dayO = healed1H.opens[indices[0]];
    const dayH = Math.max(...indices.map(i => healed1H.highs[i]));
    const dayL = Math.min(...indices.map(i => healed1H.lows[i]));
    const dayC = healed1H.closes[indices[indices.length - 1]];
    const dayV = indices.reduce((s, i) => s + (healed1H.volumes[i] || 0), 0);
    if (dayC > 0) {
      result.timestamps.push(healed1H.timestamps[indices[0]]);
      result.opens.push(dayO); result.highs.push(dayH);
      result.lows.push(dayL); result.closes.push(dayC);
      result.volumes.push(dayV);
    }
  }
  return result.closes.length >= 5 ? result : null;
}

function toPlainOHLCV(healed) {
  if (!healed) return null;
  const fixedCloses = fixPiastreAnomaly(healed.closes);
  return {
    opens: healed.opens, highs: healed.highs,
    lows: healed.lows, closes: fixedCloses, volumes: healed.volumes
  };
}

// MAIN ORCHESTRATOR
const fetchLog = [];
const results = [];

for (const stock of stocks) {
  const bundle = {
    stock: stock.ticker, fullName: stock.name,
    runDate, currentPrice: 0, mtf: {}, error: null,
    isIndex: !!stock.isIndex
  };
  let hasAnyData = false;

  for (const tf of fetchMatrix) {
    const isIntraday = (tf.id === '30m' || tf.id === '1H');
    const intervalSec = tf.id === '30m' ? 1800 : tf.id === '1H' ? 3600 : 0;

    const result = await fetchYahoo(stock.ticker, tf.interval, tf.range, 3, stock.isIndex);
    fetchLog.push({ stock: stock.ticker, tf: tf.id, ok: result.ok, err: result.err || null });

    if (result.ok) {
      let raw = extractOHLCV(result.data);
      if (raw && raw.timestamps.length > 0) {
        raw = filterMOC(raw, isIntraday);
        if (isIntraday && intervalSec > 0) raw = healGrid(raw, intervalSec);
        const plain = toPlainOHLCV(raw);
        if (plain && plain.closes.length >= 10) {
          bundle.mtf[tf.id] = plain;
          hasAnyData = true;
          const lastClose = plain.closes[plain.closes.length - 1];
          if (lastClose > 0) bundle.currentPrice = +lastClose.toFixed(2);
        }
        if (tf.id === '1H' && raw) {
          const synth4H = synthesize4H(raw);
          const plain4H = toPlainOHLCV(synth4H);
          if (plain4H && plain4H.closes.length >= 10) {
            bundle.mtf['4H'] = plain4H;
          }
        }
      }
    }
    await sleep(2000);
  }

  if (!hasAnyData) {
    const tickerLabel = stock.isIndex ? stock.ticker : stock.ticker + '.CA';
    bundle.error = 'No data from Yahoo Finance for ' + tickerLabel + ' across all timeframes.';
  } else if (!bundle.mtf['4H']) {
    bundle.error = 'Warning: Missing 4H macro anchor for ' + stock.ticker + '. Partial TA only.';
  }

  results.push({ json: bundle });
}

results.push({ json: { _fetchLog: fetchLog } });
return results;
`;

// ──────────────────────────────────────────────────────────────────
// NODE GENERATOR
// ──────────────────────────────────────────────────────────────────

/**
 * Build Stock Config + Fetch Yahoo OHLCV nodes and their connections.
 *
 * @param {object} opts
 * @param {string} opts.previousNodeName - Name of the upstream node (Holiday Gate)
 * @param {number[]} opts.startPosition  - [x, y] for Stock Config node
 * @returns {{ nodes: object[], connections: object, lastNodeName: string }}
 */
function buildYahooFetchNodes(opts) {
  const sx = opts?.startX ?? 7112;
  const sy = opts?.startY ?? -1424;
  const prevNode = opts?.prevNodeName || 'Holiday Gate';
  const GAP = 400;

  const nodes = [];

  // 1. Stock Config
  const stockConfig = createCodeNode(
    'Stock Config',
    STOCK_CONFIG_CODE,
    [sx, sy]
  );
  nodes.push(stockConfig);

  // 2. Fetch Yahoo OHLCV (All TFs)
  const fetchYahooNode = createCodeNode(
    'Fetch Yahoo OHLCV',
    FETCH_YAHOO_CODE,
    [sx + GAP, sy]
  );
  nodes.push(fetchYahooNode);

  const connections = {
    [prevNode]: {
      main: [[{ node: stockConfig.name, type: 'main', index: 0 }]],
    },
    [stockConfig.name]: {
      main: [[{ node: fetchYahooNode.name, type: 'main', index: 0 }]],
    },
  };

  return {
    nodes,
    connections,
    lastNodeName: fetchYahooNode.name,
  };
}

module.exports = { buildYahooFetchNodes };
