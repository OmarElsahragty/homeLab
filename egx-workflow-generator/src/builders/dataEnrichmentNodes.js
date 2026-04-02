/**
 * dataEnrichmentNodes.js — Data Enrichment Node Generators
 *
 * Produces the following n8n Code nodes:
 *   1. Fetch News (Mubasher) — per-stock Arabic news scraper
 *   2. Fetch CBE Rates — Central Bank of Egypt interest rates
 *   3. Fetch Market Breadth — EGX30/EGX70/EGX100 indices
 *   4. Fetch Institutional Flow — net foreign/Arab activity
 *   5. Merge Enrichment — n8n Merge node to combine parallel branches
 *   6. Compress for AI — data compression with divergence, VVP, fibonacci, regime
 *
 * @module dataEnrichmentNodes
 */

'use strict';

const {
  createCodeNode,
  createMergeNode,
  WAF_SAFETY_WRAPPER,
  YAHOO_BASE,
  USER_AGENT,
} = require('../lib/utils');

// ──────────────────────────────────────────────────────────────────
// 1. FETCH NEWS (MUBASHER)
// ──────────────────────────────────────────────────────────────────

const FETCH_NEWS_CODE = `
/*
 * FETCH NEWS (MUBASHER) — per-stock Arabic news scraper
 * Unchanged from V2.
 */
if ($input.all()[0]?.json?._skip) return $input.all();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const httpReq = this.helpers.httpRequest;
const results = [];

const AR_MONTHS = {
  'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3,
  'مايو': 4, 'يونيو': 5, 'يوليو': 6, 'أغسطس': 7,
  'سبتمبر': 8, 'أكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11
};

function parseArabicDate(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\\d{1,2})\\s+(\\S+?)(?:\\s+(\\d{4}))?\\s+\\d/);
  if (!m) return null;
  const month = AR_MONTHS[m[2]];
  if (month === undefined) return null;
  const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  return new Date(year, month, parseInt(m[1]));
}

function stripHtml(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\\d+;/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function parseNewsList(html) {
  const items = [];
  const pat = /mi-article-media-block__date[^>]*>([\\s\\S]*?)<\\/span>[\\s\\S]{1,300}?mi-article-media-block__title[^>]*href="(\\/news\\/(\\d+)\\/[^"]*)"[^>]*>([\\s\\S]*?)<\\/a>/g;
  let m;
  while ((m = pat.exec(html)) !== null) {
    items.push({
      dateStr: m[1].trim(),
      url: m[2],
      id: m[3],
      title: stripHtml(m[4]).trim(),
      dt: parseArabicDate(m[1].trim())
    });
  }
  return items;
}

function extractArticleContent(html) {
  const idx = html.indexOf('article__content-text');
  if (idx === -1) return '';
  const section = html.substring(idx, idx + 8000);
  const parts = [];
  const pPat = /<p[^>]*>([\\s\\S]*?)<\\/p>/g;
  let pm;
  while ((pm = pPat.exec(section)) !== null) {
    const text = stripHtml(pm[1]);
    if (text.length > 5) parts.push(text);
  }
  return parts.join('\\n').substring(0, 900);
}

const LIST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.5',
  'Referer': 'https://www.mubasher.info/'
};

for (const item of $input.all()) {
  const out = { ...item.json, news: [] };
  if (out._fetchLog || (out.error && !out.ta)) { results.push({ json: out }); continue; }
  if (out.isIndex) { results.push({ json: out }); continue; }

  try {
    const stockLower = (out.stock || '').toLowerCase();
    const listUrl = 'https://www.mubasher.info/markets/EGX/stocks/' + stockLower + '/news';

    const listResp = await httpReq({
      method: 'GET', url: listUrl,
      headers: LIST_HEADERS,
      returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 15000
    });

    if (listResp.statusCode === 200) {
      const html = typeof listResp.body === 'string' ? listResp.body : '';
      const allNews = parseNewsList(html);
      const recent = allNews.slice(0, 3);

      for (const n of recent) {
        await sleep(500);
        let content = '';
        try {
          const articleUrl = 'https://www.mubasher.info/news/' + n.id;
          const artResp = await httpReq({
            method: 'GET', url: articleUrl,
            headers: { ...LIST_HEADERS, Referer: listUrl },
            returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 12000
          });
          if (artResp.statusCode === 200) {
            const artHtml = typeof artResp.body === 'string' ? artResp.body : '';
            content = extractArticleContent(artHtml);
          }
        } catch (artErr) { /* use title as fallback */ }

        out.news.push({
          title: n.title.substring(0, 200),
          content: content || n.title,
          date: n.dateStr,
          url: 'https://www.mubasher.info' + n.url
        });
      }
    }
  } catch (e) {
    out.news_error = e.message;
  }

  results.push({ json: out });
  await sleep(400);
}

return results;
`;

// ──────────────────────────────────────────────────────────────────
// 2. FETCH CBE RATES
// ──────────────────────────────────────────────────────────────────

const FETCH_CBE_RATES_CODE = `
/*
 * FETCH CBE RATES — Central Bank of Egypt Key Rates
 * Scrapes the latest CBE monetary policy rates.
 */
if ($input.all()[0]?.json?._skip) return $input.all();

const httpReq = this.helpers.httpRequest;

const CBE_URL = 'https://www.cbe.org.eg/en/monetary-policy/interest-rates';

let ratesData = {
  overnightDeposit: null,
  overnightLending: null,
  lastUpdate: null,
  source: 'CBE',
  error: null
};

try {
  const resp = await httpReq({
    method: 'GET',
    url: CBE_URL,
    headers: {
      'User-Agent': '${USER_AGENT}',
      'Accept': 'text/html'
    },
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    timeout: 15000
  });

  if (resp.statusCode === 200) {
    const html = typeof resp.body === 'string' ? resp.body : '';
    const depositMatch = html.match(/overnight\\s*deposit[^0-9]*?([\\d.]+)\\s*%/i);
    const lendingMatch = html.match(/overnight\\s*lending[^0-9]*?([\\d.]+)\\s*%/i);

    if (depositMatch) ratesData.overnightDeposit = parseFloat(depositMatch[1]);
    if (lendingMatch) ratesData.overnightLending = parseFloat(lendingMatch[1]);
    ratesData.lastUpdate = new Date().toISOString().split('T')[0];
  }
} catch (e) {
  ratesData.error = e.message;
}

// Fallback to known rates if scraping fails
if (ratesData.overnightDeposit === null) {
  ratesData.overnightDeposit = 19.0;
  ratesData.overnightLending = 20.0;
  ratesData.lastUpdate = '2026-02-12';
  ratesData.source = 'fallback (last known)';
}

const results = [];
for (const item of $input.all()) {
  results.push({ json: { ...item.json, cbeRates: ratesData } });
}
return results;
`;

// ──────────────────────────────────────────────────────────────────
// 3. FETCH MARKET BREADTH
// ──────────────────────────────────────────────────────────────────

const FETCH_MARKET_BREADTH_CODE = `
/*
 * FETCH MARKET BREADTH — EGX30, EGX70, EGX100 comparison
 * Uses Yahoo Finance index tickers.
 */
if ($input.all()[0]?.json?._skip) return $input.all();

const httpReq = this.helpers.httpRequest;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const INDICES = [
  { ticker: '^EGX30', name: 'EGX30' },
  { ticker: '^EGX70', name: 'EGX70' },
  { ticker: '^EGX100', name: 'EGX100' }
];

const YAHOO_BASE = '${YAHOO_BASE}';
const YAHOO_HEADERS = {
  'User-Agent': '${USER_AGENT}',
  'Accept': 'application/json'
};

let breadth = { indices: {}, signal: 'unknown', error: null };

try {
  for (const idx of INDICES) {
    const url = YAHOO_BASE + '/' + idx.ticker + '?interval=1d&range=10d';
    const resp = await httpReq({
      method: 'GET', url,
      headers: YAHOO_HEADERS,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
      timeout: 15000
    });

    if (resp.statusCode === 200) {
      const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
      const result = body?.chart?.result?.[0];
      if (result?.indicators?.quote?.[0]) {
        const closes = result.indicators.quote[0].close.filter(c => c != null);
        if (closes.length >= 2) {
          const latest = closes[closes.length - 1];
          const prev5 = closes[Math.max(0, closes.length - 6)];
          breadth.indices[idx.name] = {
            latest: +latest.toFixed(2),
            change5d: +(((latest - prev5) / prev5) * 100).toFixed(2)
          };
        }
      }
    }
    await sleep(1500);
  }

  const egx30 = breadth.indices.EGX30?.change5d;
  const egx70 = breadth.indices.EGX70?.change5d;
  const egx100 = breadth.indices.EGX100?.change5d;

  if (egx30 != null && egx70 != null) {
    if (egx30 > 0 && egx70 > 0 && egx100 > 0) {
      breadth.signal = 'broad_bullish';
    } else if (egx30 > 0 && (egx70 < 0 || egx100 < 0)) {
      breadth.signal = 'narrow_leadership';
    } else if (egx30 < 0 && egx70 < 0) {
      breadth.signal = 'broad_bearish';
    } else {
      breadth.signal = 'mixed';
    }
  }
} catch (e) {
  breadth.error = e.message;
}

const results = [];
for (const item of $input.all()) {
  results.push({ json: { ...item.json, marketBreadth: breadth } });
}
return results;
`;

// ──────────────────────────────────────────────────────────────────
// 4. FETCH INSTITUTIONAL FLOW
// ──────────────────────────────────────────────────────────────────

const FETCH_INSTITUTIONAL_FLOW_CODE = `
/*
 * FETCH INSTITUTIONAL ORDER FLOW — EGX Net Foreign & Arab Trading
 * Source: Arab Finance daily Egypt market summary.
 * DST SAFETY: Uses Intl.DateTimeFormat — no hardcoded UTC offsets.
 */
if ($input.all()[0]?.json?._skip) return $input.all();

const httpReq = this.helpers.httpRequest;

${WAF_SAFETY_WRAPPER}

const SOURCE_URL = 'https://www.arabfinance.com/en/markets/stocks/egypt/';

let flowData = {
  netForeign: null,
  netArab: null,
  foreignSentiment: null,
  arabSentiment: null,
  date: null,
  source: 'arabfinance',
  error: null
};

try {
  const resp = await safeHttpGet(httpReq, SOURCE_URL, {
    'Accept': 'text/html'
  }, 20000);

  if (resp && resp.statusCode === 200) {
    const html = typeof resp.body === 'string' ? resp.body : '';

    if (isWafChallenge(html)) {
      flowData.error = 'WAF CAPTCHA block detected (200 OK with HTML challenge page)';
    } else {
      const foreignMatch = html.match(/net\\s*foreign[^-\\d]*([-\\d,.]+)\\s*(M?)/i);
      const arabMatch    = html.match(/net\\s*arab[^-\\d]*([-\\d,.]+)\\s*(M?)/i);

      if (foreignMatch) {
        flowData.netForeign = parseFloat(foreignMatch[1].replace(/,/g, ''));
        flowData.foreignSentiment = flowData.netForeign > 0 ? 'buying'
                                  : flowData.netForeign < 0 ? 'selling' : 'neutral';
      }
      if (arabMatch) {
        flowData.netArab = parseFloat(arabMatch[1].replace(/,/g, ''));
        flowData.arabSentiment = flowData.netArab > 0 ? 'buying'
                               : flowData.netArab < 0 ? 'selling' : 'neutral';
      }

      flowData.date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
    }
  }
} catch (e) {
  flowData.error = e.message;
}

if (flowData.netForeign === null) {
  flowData.error = (flowData.error ? flowData.error + ' | ' : '') +
    'Institutional flow unavailable — source unreachable or page structure changed';
}

const results = [];
for (const item of $input.all()) {
  results.push({ json: { ...item.json, institutionalFlow: flowData } });
}
return results;
`;

// ──────────────────────────────────────────────────────────────────
// 5. COMPRESS FOR AI
// ──────────────────────────────────────────────────────────────────

const COMPRESS_CODE = `
/*
 * COMPRESS DATA FOR AI
 * Fields: divergence, vvp, fibonacci, regime,
 * cbeRates, institutionalFlow, marketBreadth.
 */
if ($input.all()[0]?.json?._skip) return $input.all();

const TF_ORDER = ['1W', '1D', '4H', '1H'];
const TF_SHORT = { '1W': 'W', '1D': 'D', '4H': '4H', '1H': '1H' };

// ── Pre-holiday risk: known EGX closures 2026 ──
const HOLIDAYS_2026 = [
  '2026-03-19','2026-03-22','2026-03-23',
  '2026-04-25','2026-05-01',
  '2026-06-06','2026-06-07','2026-06-08','2026-06-09',
  '2026-07-23','2026-06-27','2026-09-05','2026-10-06'
];

function computeDaysToNextHoliday(dateStr) {
  if (!dateStr) return null;
  try {
    const today = new Date(dateStr);
    let min = Infinity, next = null;
    for (const h of HOLIDAYS_2026) {
      const diff = Math.ceil((new Date(h) - today) / 86400000);
      if (diff > 0 && diff < min) { min = diff; next = h; }
    }
    return min < Infinity ? { daysToNext: min, nextHoliday: next } : null;
  } catch (e) { return null; }
}

function compressTF(ta) {
  if (!ta) return null;
  const c = {
    ema: ta.emaAlign,
    ema9: ta.ema9, ema21: ta.ema21, ema50: ta.ema50,
    rsi: ta.rsi?.value, rsiPrev: ta.rsi?.prev, rsiSlp: ta.rsi?.slope
  };

  if (ta.rsiShort) {
    c.rsi3 = ta.rsiShort.value;
    c.rsi3Sig = ta.rsiShort.signal;
  }

  if (ta.macd) {
    c.mH = ta.macd.histogram;
    c.mHS = ta.macd.histSlope;
    c.mX = ta.macd.crossover;
  }

  if (ta.macdEgx) {
    c.mEgxH = ta.macdEgx.histogram;
    c.mEgxHS = ta.macdEgx.histSlope;
    c.mEgxX = ta.macdEgx.crossover;
  }

  c.atr = ta.atr;

  // Turnover (Close × Volume)
  if (ta.turnover) {
    c.to = { lat: ta.turnover.latest, avg: ta.turnover.avg20, r: ta.turnover.ratio };
  }

  if (ta.ichimoku) {
    c.ichi = {
      cloud: ta.ichimoku.cloud,
      tk: ta.ichimoku.tkCross,
      tenkan: ta.ichimoku.tenkan,
      kijun: ta.ichimoku.kijun
    };
  }

  if (ta.adx) {
    c.adx = { v: ta.adx.value, pdi: ta.adx.pdi, mdi: ta.adx.mdi, sig: ta.adx.signal };
  }

  if (ta.bollinger) {
    c.bb = { u: ta.bollinger.upper, l: ta.bollinger.lower, w: ta.bollinger.width, pB: ta.bollinger.pctB, sig: ta.bollinger.signal };
  }

  if (ta.stochastic) {
    c.stoch = { k: ta.stochastic.k, d: ta.stochastic.d, sig: ta.stochastic.signal, x: ta.stochastic.crossover };
  }

  if (ta.sr?.supports?.length) c.sup = ta.sr.supports;
  if (ta.sr?.resistances?.length) c.res = ta.sr.resistances;

  if (ta.elliott && ta.elliott.label !== 'N/A') {
    c.ew = { l: ta.elliott.label, p: ta.elliott.phase, q: ta.elliott.quality, d: ta.elliott.direction };
    if (ta.elliott.subWave) c.ew.sub = ta.elliott.subWave;
  }

  if (ta.fib) {
    c.fib = { sh: ta.fib.swingHigh, sl: ta.fib.swingLow, ret: ta.fib.retracements, ext: ta.fib.extensions, nr: ta.fib.nearest, nd: ta.fib.nearestDist };
  }

  if (ta.volume) {
    c.vol = {
      sm: ta.volume.smartMoney, smc: ta.volume.smConfidence,
      obv: ta.volume.obv, div: ta.volume.obvDivergence,
      ad: ta.volume.adLine,
      mfi: ta.volume.mfi, mfiSig: ta.volume.mfiSignal,
      cmf: ta.volume.cmf, cmfSig: ta.volume.cmfSignal,
      spike: ta.volume.volumeSpike, vr: ta.volume.volumeRatio
    };
  }

  if (ta.patterns) {
    c.pat = { st: ta.patterns.structure, p: ta.patterns.patterns };
  }

  // Divergence
  if (ta.divergence) {
    c.div = { rsi: ta.divergence.rsi, macd: ta.divergence.macd };
  }

  // VVP
  if (ta.vvp) {
    c.vvp = {
      poc: ta.vvp.poc,
      vah: ta.vvp.valueAreaHigh,
      val: ta.vvp.valueAreaLow,
      pos: ta.vvp.pricePosition
    };
  }

  // Structural Fibonacci Retracements
  if (ta.fibonacci) {
    const f = ta.fibonacci;
    c.sfib = {
      up: f.isUptrend,
      sh: f.swingHigh, sl: f.swingLow,
      f236: f.f0236, f382: f.f0382,
      f500: f.f0500, f618: f.f0618,
      f786: f.f0786,
      e162: f.ext1618, e262: f.ext2618
    };
  }

  // Wave Trading Signal
  if (ta.waveTradingSignal) c.wts = ta.waveTradingSignal;

  // Wave 2 Volume Contraction
  if (ta.wave2VolContraction) c.w2vc = ta.wave2VolContraction;

  // Wave Take-Profit Tiers
  if (ta.waveTakeProfit) c.wtp = ta.waveTakeProfit;

  return c;
}

// ── Breadth proxy: % of analyzed stocks with bullish EMA alignment ──
let bullishCount = 0, totalAnalyzed = 0;
for (const bpItem of $input.all()) {
  const bd = bpItem.json;
  if (bd._fetchLog || bd.isIndex) continue;
  totalAnalyzed++;
  const anchor = bd.ta?.['4H'] || bd.ta?.['1H'];
  if (anchor?.emaAlign === 'bullish') bullishCount++;
}
const breadthProxy = totalAnalyzed > 0 ? +(bullishCount / totalAnalyzed * 100).toFixed(1) : 0;

const results = [];
for (const item of $input.all()) {
  const d = item.json;
  if (d._fetchLog) { results.push({ json: d }); continue; }
  const compressed = {
    stock: d.stock, fullName: d.fullName,
    currentPrice: d.currentPrice, error: d.error || null,
    confluence: d.confluence, waveAlignment: d.waveAlignment || null,
    tfs: (d.availableTFs || []).map(t => TF_SHORT[t] || t),
    tf: {},
    news: (d.news || []).slice(0, 5),
    news_error: d.news_error || null,
    // Enrichment fields
    regime: d.regime || null,
    cbeRates: d.cbeRates || null,
    institutionalFlow: d.institutionalFlow || null,
    marketBreadth: d.marketBreadth || null,
    macroBaseline: d.macroBaseline || null,
    isIndex: d.isIndex || false,
    breadthProxy,
  };
  for (const tf of TF_ORDER) {
    if (d.ta?.[tf]) {
      const c = compressTF(d.ta[tf]);
      if (c) compressed.tf[TF_SHORT[tf] || tf] = c;
    }
  }

  // ── ARBS Composite Score (0-6) ──
  if (!d.isIndex) {
    let arbsScore = 0;
    const anchorTF = compressed.tf?.['4H'] || compressed.tf?.['1H'] || Object.values(compressed.tf || {})[0];

    // Layer 1: Wave Mechanics (impulse Wave 3 or trigger_zone)
    if (anchorTF?.wts === 'momentum_core' || anchorTF?.wts === 'trigger_zone') arbsScore++;

    // Layer 2: Fibonacci Confluence (price near key fib level)
    if (anchorTF?.sfib && d.currentPrice > 0) {
      const cp = d.currentPrice;
      const fibLevels = [anchorTF.sfib.f618, anchorTF.sfib.f500, anchorTF.sfib.f382].filter(Boolean);
      if (fibLevels.some(lv => Math.abs(cp - lv) / cp < 0.01)) arbsScore++;
    }

    // Layer 3: Volume Confirmation
    if (anchorTF?.vol?.sm === 'strong_accumulation' || anchorTF?.vol?.sm === 'accumulation') arbsScore++;

    // Layer 4: Regime (bullish)
    if (d.regime?.regime === 'bullish' || d.regime?.regime === 'strong_bullish') arbsScore++;

    // Layer 5: Institutional Flow
    if (d.institutionalFlow && !d.institutionalFlow.error && d.institutionalFlow.foreignSentiment === 'buying') arbsScore++;

    // Layer 6: Market Breadth
    if (d.marketBreadth?.signal === 'broad_bullish') arbsScore++;

    compressed.arbsScore = arbsScore;
  }

  // ── Pre-holiday risk flag ──
  const holidayInfo = computeDaysToNextHoliday(d.runDate);
  if (holidayInfo && holidayInfo.daysToNext <= 2) {
    compressed.nearHoliday = holidayInfo;
  }

  results.push({ json: compressed });
}
return results;
`;

// ──────────────────────────────────────────────────────────────────
// NODE GENERATOR
// ──────────────────────────────────────────────────────────────────

/**
 * Build all enrichment nodes: 4 parallel data nodes + Merge + Compress.
 *
 * @param {object} opts
 * @param {string} opts.previousNodeName - Name of the upstream node (TA Engine)
 * @param {number[]} opts.startPosition  - [x, y] base position for the Fetch News node
 * @returns {{ nodes: object[], connections: object, lastNodeName: string }}
 */
function buildEnrichmentNodes(opts) {
  const sx = opts?.startX ?? 8500;
  const sy = opts?.startY ?? -1424;
  const prevNode = opts?.prevNodeName || 'TA Engine';

  // Parallel branch layout: 4 fetch nodes spread vertically
  const fetchNewsNode = createCodeNode('Fetch News Mubasher', FETCH_NEWS_CODE, [sx, sy]);
  const fetchCBENode = createCodeNode('Fetch CBE Rates', FETCH_CBE_RATES_CODE, [sx, sy + 300]);
  const fetchBreadthNode = createCodeNode('Fetch Market Breadth', FETCH_MARKET_BREADTH_CODE, [sx, sy + 600]);
  const fetchFlowNode = createCodeNode('Fetch Institutional Flow', FETCH_INSTITUTIONAL_FLOW_CODE, [sx, sy + 900]);

  // Chain of 3 x 2-input Merge nodes (n8n combine+mergeByFields only supports 2 inputs each).
  // Step 1: merge News + CBE
  const mergeABNode = createMergeNode('Merge Enrichment', [sx + 600, sy + 150]);
  // Step 2: merge (News+CBE) + Breadth
  const mergeBthNode = createMergeNode('Merge Breadth', [sx + 900, sy + 375]);
  // Step 3: merge (News+CBE+Breadth) + Flow → final enrichment
  const mergeFloNode = createMergeNode('Merge Flow', [sx + 1200, sy + 600]);

  // Compress node — after the final merge
  const compressNode = createCodeNode('Compress for AI', COMPRESS_CODE, [sx + 1600, sy + 600]);

  const connections = {
    // TA Engine fans out to all 4 parallel fetch nodes simultaneously
    [prevNode]: {
      main: [[
        { node: fetchNewsNode.name, type: 'main', index: 0 },
        { node: fetchCBENode.name, type: 'main', index: 0 },
        { node: fetchBreadthNode.name, type: 'main', index: 0 },
        { node: fetchFlowNode.name, type: 'main', index: 0 },
      ]],
    },
    // Step 1: News → MergeAB[i0], CBE → MergeAB[i1]
    [fetchNewsNode.name]: {
      main: [[{ node: mergeABNode.name, type: 'main', index: 0 }]],
    },
    [fetchCBENode.name]: {
      main: [[{ node: mergeABNode.name, type: 'main', index: 1 }]],
    },
    // Step 2: MergeAB → MergeBth[i0], Breadth → MergeBth[i1]
    [mergeABNode.name]: {
      main: [[{ node: mergeBthNode.name, type: 'main', index: 0 }]],
    },
    [fetchBreadthNode.name]: {
      main: [[{ node: mergeBthNode.name, type: 'main', index: 1 }]],
    },
    // Step 3: MergeBth → MergeFlo[i0], Flow → MergeFlo[i1]
    [mergeBthNode.name]: {
      main: [[{ node: mergeFloNode.name, type: 'main', index: 0 }]],
    },
    [fetchFlowNode.name]: {
      main: [[{ node: mergeFloNode.name, type: 'main', index: 1 }]],
    },
    // Final merge → Compress for AI
    [mergeFloNode.name]: {
      main: [[{ node: compressNode.name, type: 'main', index: 0 }]],
    },
  };

  return {
    nodes: [fetchNewsNode, fetchCBENode, fetchBreadthNode, fetchFlowNode,
      mergeABNode, mergeBthNode, mergeFloNode, compressNode],
    connections,
    lastNodeName: compressNode.name,
  };
}

module.exports = { buildEnrichmentNodes };
