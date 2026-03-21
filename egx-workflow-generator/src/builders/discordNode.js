/**
 * discordNode.js — Format & Send to Discord node generator
 *
 * Features:
 *   - WEBHOOK_URLS, BOT config, COL map, ACTION_PRIORITY/EMOJI
 *   - getTrend (4H EMA alignment)
 *   - Header embed (action counts, best picks, regime badge, market breadth)
 *   - Per-stock embeds (action/confluence/Elliott/technicals/news/targets/analysis)
 *   - Per-stock badges: divergence warning, volume confirmation, institutional flow,
 *     Fibonacci-VVP confluence, historical accuracy score, catalyst decay indicator
 *   - Chunking (2 embeds/batch, 5500-char limit)
 *   - Sending (3 retries, 429 rate-limit handling, 1s/2s delays)
 */

const { createCodeNode } = require('../lib/utils');

// ---------------------------------------------------------------------------
// Embedded code — Format & Send to Discord
// ---------------------------------------------------------------------------
const DISCORD_CODE = `
if ($input.all()[0]?.json?._skip) return [{ json: { _skip: true } }];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const httpReq = this.helpers.httpRequest;

const WEBHOOK_URLS = [
'${process.env.DISCORD_WEBHOOK_URL}'
];
const BOT = {
  username: 'EGX Deep Analyst',
  avatar_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT0IcHOvVsV9GMr6RBfsKYCyL4GcD0MRuvaGg&s'
};

const COL = { BUY: 5763719, SELL: 15548997, WATCH: 16776960, HOLD: 10070709, ERROR: 10038562 };
const ACTION_PRIORITY = { BUY: 1, HOLD: 2, WATCH: 3, SELL: 4, ERROR: 5 };
const ACTION_EMOJI = { BUY: '🟢', SELL: '🔴', WATCH: '🟡', HOLD: '⚪', ERROR: '❌' };

function getTrend(tfData) {
  const anchor = tfData?.['4H'] || Object.values(tfData || {})[0];
  if (!anchor) return 'Unknown';
  if (anchor.ema === 'bullish') return 'Uptrend';
  if (anchor.ema === 'bearish') return 'Downtrend';
  return 'Sideways';
}

const data = $input.all().map(i => i.json).filter(d => !d._fetchLog && !d.isIndex);

data.sort((a, b) => {
  const pa = ACTION_PRIORITY[a.ai?.action] || 5;
  const pb = ACTION_PRIORITY[b.ai?.action] || 5;
  if (pa !== pb) return pa - pb;
  return (b.ai?.confidence || 0) - (a.ai?.confidence || 0);
});

const allEmbeds = [];
const runDate = data[0]?.runDate || new Date().toISOString().split('T')[0];

// ── Action counts ──
const actionCounts = {};
for (const a of data) {
  const act = a.ai?.action || 'HOLD';
  actionCounts[act] = (actionCounts[act] || 0) + 1;
}
const summaryParts = [];
if (actionCounts.BUY) summaryParts.push('🟢 BUY: ' + actionCounts.BUY);
if (actionCounts.WATCH) summaryParts.push('🟡 WATCH: ' + actionCounts.WATCH);
if (actionCounts.HOLD) summaryParts.push('⚪ HOLD: ' + actionCounts.HOLD);
if (actionCounts.SELL) summaryParts.push('🔴 SELL: ' + actionCounts.SELL);

// ── Best picks for header ──
const topBuy = data.find(d => d.ai?.action === 'BUY');
const topSell = data.find(d => d.ai?.action === 'SELL');

const headerLines = [
  '**' + data.length + ' stocks analyzed** · ' + summaryParts.join(' · '),
  ''
];

// Regime badge
const regimeData = data.find(d => d.regime)?.regime;
if (regimeData) {
  const regimeEmoji = {
    strong_bullish: '🟢🟢', bullish: '🟢', neutral: '⚪',
    bearish: '🔴', strong_bearish: '🔴🔴', unknown: '❓'
  };
  headerLines.push('Regime: ' + (regimeEmoji[regimeData.regime] || '❓') + ' **' + regimeData.regime.toUpperCase() + '** (score: ' + regimeData.score + ')');
}

// Breadth section
const breadthData = data.find(d => d.marketBreadth)?.marketBreadth;
if (breadthData && breadthData.signal && breadthData.signal !== 'unknown') {
  const breadthEmoji = {
    broad_bullish: '🟢', narrow_leadership: '🟡', mixed: '⚪', broad_bearish: '🔴'
  };
  let breadthLine = 'Breadth: ' + (breadthEmoji[breadthData.signal] || '⚪') + ' **' + breadthData.signal + '**';
  for (const [idx, d] of Object.entries(breadthData.indices || {})) {
    breadthLine += ' · ' + idx + ': ' + (d.change5d > 0 ? '+' : '') + d.change5d + '%';
  }
  headerLines.push(breadthLine);
}

// Macro Baseline (EGX30 Index)
const macroData = data.find(d => d.macroBaseline)?.macroBaseline;
if (macroData) {
  const macroEmoji = {
    strong_bullish: '🟢🟢', bullish: '🟢', neutral: '⚪',
    bearish: '🔴', strong_bearish: '🔴🔴'
  };
  headerLines.push('EGX30 Macro: ' + (macroEmoji[macroData.regime] || '❓') + ' **' + macroData.regime.toUpperCase() + '** (score: ' + macroData.score + ', trend: ' + macroData.trend + ', price: ' + macroData.price + ')');
  if (macroData.regime === 'bearish' || macroData.regime === 'strong_bearish') {
    headerLines.push('⚠️ **MACRO DISCOUNT ACTIVE — BUY confidence reduced 50%**');
  }
}

// CBE Rates
const cbeData = data.find(d => d.cbeRates?.overnightDeposit != null)?.cbeRates;
if (cbeData) {
  headerLines.push('🏛️ CBE: Deposit **' + cbeData.overnightDeposit + '%** · Lending **' + cbeData.overnightLending + '%**');
}

// Institutional Flow
const flowData = data.find(d => d.institutionalFlow && !d.institutionalFlow.error && d.institutionalFlow.netForeign != null)?.institutionalFlow;
if (flowData) {
  const fEmoji = flowData.foreignSentiment === 'buying' ? '🔼' : flowData.foreignSentiment === 'selling' ? '🔽' : '➡️';
  const aEmoji = flowData.arabSentiment   === 'buying' ? '🔼' : flowData.arabSentiment   === 'selling' ? '🔽' : '➡️';
  headerLines.push('🏦 Inst. Flow: Foreign ' + fEmoji + ' **' + flowData.foreignSentiment + '** (' + (flowData.netForeign >= 0 ? '+' : '') + flowData.netForeign + 'M) · Arab ' + aEmoji + ' **' + flowData.arabSentiment + '** (' + (flowData.netArab >= 0 ? '+' : '') + flowData.netArab + 'M)');
}

if (topBuy) {
  const b24 = topBuy.ai.prediction_24h || {};
  const b5d = topBuy.ai.prediction_5d || {};
  let bestLongLine = '📈 **Best long:** ' + topBuy.fullName + ' — 24h: \`' + Number(b24.low).toFixed(3) + '–' + Number(b24.high).toFixed(3) + '\` · 5d: \`' + Number(b5d.low).toFixed(3) + '–' + Number(b5d.high).toFixed(3) + ' EGP\`';
  if (topBuy.ai.entry > 0) bestLongLine += ' · Entry: \`' + Number(topBuy.ai.entry).toFixed(3) + '\` SL: \`' + Number(topBuy.ai.stopLoss).toFixed(3) + '\` TP: \`' + Number(topBuy.ai.takeProfit).toFixed(3) + '\`';
  headerLines.push(bestLongLine);
} else {
  const bestUpside = data
    .filter(d => (d.ai?.action === 'WATCH' || d.ai?.action === 'HOLD') && d.ai?.prediction_24h?.high && d.currentPrice > 0)
    .sort((a, b) => ((b.ai.prediction_24h.high - b.currentPrice) / b.currentPrice) - ((a.ai.prediction_24h.high - a.currentPrice) / a.currentPrice))[0];
  if (bestUpside) {
    const u24 = bestUpside.ai.prediction_24h || {};
    const u5d = bestUpside.ai.prediction_5d || {};
    const upPct = ((u24.high - bestUpside.currentPrice) / bestUpside.currentPrice * 100).toFixed(1);
    headerLines.push('📈 **Best upside (' + bestUpside.ai.action + '):** ' + bestUpside.fullName + ' — 24h: \`' + Number(u24.low).toFixed(3) + '–' + Number(u24.high).toFixed(3) + '\` · 5d: \`' + Number(u5d.low).toFixed(3) + '–' + Number(u5d.high).toFixed(3) + ' EGP\` (+' + upPct + '% upside)');
  }
}

if (topSell) {
  const s24 = topSell.ai.prediction_24h || {};
  const s5d = topSell.ai.prediction_5d || {};
  headerLines.push('📉 **Best short:** ' + topSell.fullName + ' — 24h: \`' + Number(s24.low).toFixed(3) + '–' + Number(s24.high).toFixed(3) + '\` · 5d: \`' + Number(s5d.low).toFixed(3) + '–' + Number(s5d.high).toFixed(3) + ' EGP\`');
} else {
  const bearish = data
    .filter(d => (d.ai?.action === 'WATCH' || d.ai?.action === 'HOLD') && d.ai?.prediction_24h?.high && d.currentPrice)
    .sort((a, b) => (a.ai.prediction_24h.high - a.currentPrice) - (b.ai.prediction_24h.high - b.currentPrice))[0];
  if (bearish) {
    const bh24 = bearish.ai.prediction_24h || {};
    headerLines.push('📉 **Watch for drop:** ' + bearish.fullName + ' — 24h: \`' + Number(bh24.low).toFixed(3) + '–' + Number(bh24.high).toFixed(3) + ' EGP\`');
  }
}

allEmbeds.push({
  title: '📊 EGX Daily Analysis · ' + runDate,
  description: headerLines.join('\\n'),
  color: 3447003
});

// ── Per-stock embeds ──
for (const a of data) {
  const ai = a.ai || {};
  const action = ai.action || 'HOLD';
  const color = COL[action] || COL.HOLD;
  const conf = ai.confidence || 0;

  if (a.error && (!a.tf || Object.keys(a.tf).length === 0)) {
    allEmbeds.push({
      title: '❌ ' + a.fullName,
      description: 'No data: \`' + (a.error || '').substring(0, 300) + '\`',
      color: COL.ERROR
    });
    continue;
  }

  const trend = getTrend(a.tf);
  const bestTF = a.tf?.['4H'] || a.tf?.['1H'] || Object.values(a.tf || {})[0] || {};

  // Elliott Wave
  const ewParts = [];
  for (const [tf, tfData] of Object.entries(a.tf || {})) {
    if (tfData?.ew) {
      let s = tf + ':' + tfData.ew.l + '(q' + tfData.ew.q + ')';
      if (tfData.ew.sub?.fibMatch && tfData.ew.sub.fibMatch !== 'none') s += '[' + tfData.ew.sub.fibMatch + ']';
      ewParts.push(s);
    }
  }

  const sections = [];

  // Action header line
  let actionLine = ' **' + action + '** · ' + conf + '% confidence';
  if (ai.riskLevel) actionLine += ' · Risk: ' + ai.riskLevel;
  sections.push(actionLine);

  // Divergence warning badge
  if (ai.divergenceWarning && ai.divergenceWarning !== 'none') {
    const divEmoji = ai.divergenceWarning.includes('bearish') ? '⚠️' : '💡';
    sections.push(divEmoji + ' **DIVERGENCE: ' + ai.divergenceWarning.replace('_', ' ').toUpperCase() + '**');
  }

  // Volume confirmation badge
  if (ai.volumeConfirmation) {
    const vc = ai.volumeConfirmation;
    const vcEmoji = vc.confirmed ? '✅' : '❌';
    sections.push(vcEmoji + ' Volume Confirmed: ' + (vc.confirmed ? 'YES' : 'NO') + ' (OBV:' + vc.obv + ' CMF:' + vc.cmf + ' MFI:' + vc.mfi + ')');
  }

  // Institutional flow alignment
  if (ai.institutionalFlowAlignment && ai.institutionalFlowAlignment !== 'unavailable') {
    const flowEmoji = ai.institutionalFlowAlignment === 'accumulating' ? '🏦' : ai.institutionalFlowAlignment === 'distributing' ? '🏚️' : '↔️';
    sections.push(flowEmoji + ' Institutional: **' + ai.institutionalFlowAlignment.toUpperCase() + '**');
  }

  // Fibonacci-VVP confluence
  if (ai.fibVvpConfluence?.detected) {
    sections.push('🔺 **TRIPLE CONFLUENCE** at ' + ai.fibVvpConfluence.level + ' — ' + ai.fibVvpConfluence.description);
  }

  // Historical Accuracy Score badge
  if (a.dbHistory && a.dbHistory.hasHistory && a.dbHistory.accuracyStats) {
    const stats = a.dbHistory.accuracyStats;
    if (stats.total_audited_24h > 0) {
      const accPct = stats.direction_accuracy_24h != null ? stats.direction_accuracy_24h + '%' : 'N/A';
      const accEmoji = stats.direction_accuracy_24h >= 70 ? '🎯' : stats.direction_accuracy_24h >= 50 ? '📊' : '⚠️';
      sections.push(accEmoji + ' Track Record: **' + accPct + ' direction accuracy** (' + stats.total_audited_24h + ' audited)');
    }
  }

  // Catalyst decay indicator
  if (ai.catalystDecayApplied) {
    sections.push('🕐 **Catalyst Decay Applied** — previous news catalysts have aged');
  }

  // Turnover badge
  if (bestTF.to) {
    const toR = bestTF.to.r;
    const toEmoji = toR < 0.5 ? '🚫' : toR > 2.0 ? '🔥' : '💧';
    sections.push(toEmoji + ' Turnover: ' + Number(bestTF.to.lat).toLocaleString() + ' EGP (×' + toR + ' avg)');
  }

  if (a.confluence) {
    sections.push('Confluence: **' + a.confluence.score + '** (' + a.confluence.bias + ', ' + a.confluence.strength + ')');
  }
  if (ewParts.length) sections.push('Elliott: \`' + ewParts.join(' | ') + '\`');
  if (a.waveAlignment?.signal && a.waveAlignment.signal !== 'insufficient_data') {
    sections.push('Wave Align: \`' + a.waveAlignment.signal + '\`');
  }

  // ── Technical ──
  sections.push('');
  sections.push('**📊 Technical**');

  let trendLine = '▸ Trend: \`' + trend + '\`';
  if (bestTF.adx) trendLine += ' · ADX: \`' + bestTF.adx.v + ' (' + bestTF.adx.sig + ')\`';
  sections.push(trendLine);

  let rsiLine = '';
  if (bestTF.rsi != null) rsiLine = 'RSI-14: \`' + bestTF.rsi + '\`';
  if (bestTF.rsi3 != null) rsiLine += ' · RSI-3: \`' + bestTF.rsi3 + ' (' + bestTF.rsi3Sig + ')\`';
  if (rsiLine) sections.push('▸ ' + rsiLine);

  if (bestTF.ichi) {
    sections.push('▸ Ichimoku: \`' + bestTF.ichi.cloud + '\` · TK cross: \`' + bestTF.ichi.tk + '\`');
  }
  if (bestTF.bb) {
    sections.push('▸ BB: \`width=' + bestTF.bb.w + '%, %B=' + bestTF.bb.pB + ', ' + bestTF.bb.sig + '\`');
  }
  if (bestTF.stoch) {
    sections.push('▸ Stoch: \`K=' + bestTF.stoch.k + ' D=' + bestTF.stoch.d + ' (' + bestTF.stoch.sig + ', ' + bestTF.stoch.x + ')\`');
  }
  if (bestTF.vol) {
    sections.push('▸ Smart Money: \`' + bestTF.vol.sm + ' (conf:' + bestTF.vol.smc + ')\`');
    let flowLine = '▸ MFI: \`' + bestTF.vol.mfi + ' (' + bestTF.vol.mfiSig + ')\` · CMF: \`' + bestTF.vol.cmf + ' (' + bestTF.vol.cmfSig + ')\`';
    if (bestTF.vol.div && bestTF.vol.div !== 'none') flowLine += ' · \`' + bestTF.vol.div + '\`';
    if (bestTF.vol.spike) flowLine += ' · SPIKE ×' + bestTF.vol.vr;
    sections.push(flowLine);
  }

  const sup = (bestTF.sup || []).slice(0, 3).join(', ') || 'N/A';
  const res = (bestTF.res || []).slice(0, 3).join(', ') || 'N/A';
  sections.push('▸ Support: \`' + sup + '\` · Resistance: \`' + res + '\`');
  if (bestTF.fib) {
    if (bestTF.fib.f618 != null) {
      let fibStr = 'f382=' + bestTF.fib.f382 + ' f500=' + bestTF.fib.f500 + ' f618=' + bestTF.fib.f618;
      if (bestTF.fib.e162 != null) fibStr += ' · ext162=' + bestTF.fib.e162;
      sections.push('▸ Fib: \`' + fibStr + '\`');
    } else if (bestTF.fib.nr != null) {
      sections.push('▸ Fib: \`' + bestTF.fib.nr + '\` (' + bestTF.fib.nd + '% away)');
    }
  }

  // VVP
  if (bestTF.vvp) {
    const vvp = bestTF.vvp;
    const pocDist = vvp.poc > 0 && a.currentPrice > 0
      ? ((a.currentPrice - vvp.poc) / vvp.poc * 100).toFixed(1)
      : '?';
    const posEmoji = vvp.pos === 'above_value' ? '🔼' : vvp.pos === 'below_value' ? '🔽' : '⬛';
    sections.push('▸ VVP: POC=\`' + vvp.poc + '\` (' + (pocDist > 0 ? '+' : '') + pocDist + '%) · ' + posEmoji + ' ' + (vvp.pos || '').replace(/_/g, ' '));
  }

  // Per-TF divergences (raw data — complements AI∙divergenceWarning)
  const rawDivParts = [];
  for (const [tf, tfData] of Object.entries(a.tf || {})) {
    if (!tfData?.div) continue;
    const d = [];
    if (tfData.div.rsi  !== 'none' && tfData.div.rsi)  d.push('RSI '  + tfData.div.rsi);
    if (tfData.div.macd !== 'none' && tfData.div.macd) d.push('MACD ' + tfData.div.macd);
    if (d.length) rawDivParts.push(tf + ':' + d.join('/'));
  }
  if (rawDivParts.length) sections.push('▸ Div: \`' + rawDivParts.join(' | ') + '\`');

  // Chart patterns
  const allPats = [];
  for (const [tf, tfData] of Object.entries(a.tf || {})) {
    if (tfData?.pat?.p?.length) tfData.pat.p.forEach(p => allPats.push(tf + ':' + p));
  }
  if (allPats.length) sections.push('▸ Patterns: \`' + [...new Set(allPats)].slice(0, 5).join(', ') + '\`');

  // Smart Context badge
  if (a.smartContext?.length > 0) {
    const best = a.smartContext[0];
    const simPct = best.similarity != null ? Math.round(Number(best.similarity) * 100) : 0;
    if (simPct >= 60) {
      const scEmoji = best.action === 'BUY' ? '🟢' : best.action === 'SELL' ? '🔴' : '⚪';
      sections.push('🧠 **Context:** ' + simPct + '% ≈ ' + best.date + ' → ' + scEmoji + ' ' + best.action + ' (' + (best.confidence || '?') + '% conf)');
    }
  }

  // Raw institutional flow numbers (when available per-stock)
  if (a.institutionalFlow && !a.institutionalFlow.error && a.institutionalFlow.netForeign != null) {
    const fl = a.institutionalFlow;
    const fE = fl.foreignSentiment === 'buying' ? '🟢' : fl.foreignSentiment === 'selling' ? '🔴' : '⚪';
    const aE = fl.arabSentiment   === 'buying' ? '🟢' : fl.arabSentiment   === 'selling' ? '🔴' : '⚪';
    sections.push(fE + ' Foreign: **' + (fl.netForeign >= 0 ? '+' : '') + fl.netForeign + 'M** · ' + aE + ' Arab: **' + (fl.netArab >= 0 ? '+' : '') + fl.netArab + 'M**');
  }
  // ── News — driven by raw a.news[] so all 3 items always appear;
  //          ai.news_analysis[] is used only for impact icon + Arabic analysis text
  const rawNews = a.news || [];
  if (rawNews.length > 0) {
    sections.push('');
    sections.push('**📰 News**');
    const aiNewsArr = ai.news_analysis || [];
    rawNews.forEach((n, idx) => {
      // Match AI analysis: try title overlap first (first 25 chars), fall back to positional index
      const matchByTitle = aiNewsArr.find(an => {
        const t1 = (an.title || '').substring(0, 25).trim();
        const t2 = (n.title  || '').substring(0, 25).trim();
        return t1.length > 3 && t2.length > 3 && (t2.startsWith(t1) || t1.startsWith(t2));
      });
      const matched = matchByTitle || aiNewsArr[idx] || null;
      const impact  = matched?.impact;
      const icon    = impact === 'positive' ? '🟢' : impact === 'negative' ? '🔴' : '🟡';
      const dateTag = n.date ? ' \`' + n.date + '\`' : '';
      sections.push(icon + ' **' + (n.title || '').substring(0, 80) + '**' + dateTag);
      if (matched?.analysis) {
        sections.push('> ' + matched.analysis.substring(0, 160));
      } else if (n.content && n.content !== n.title) {
        sections.push('> ' + n.content.substring(0, 100));
      }
    });
  }

  // ── Targets ──
  sections.push('');
  sections.push('**🎯 Targets**');
  sections.push('▸ 24h: \`' + Number(ai.prediction_24h?.low || 0).toFixed(3) + ' – ' + Number(ai.prediction_24h?.high || 0).toFixed(3) + ' EGP\`');
  sections.push('▸ 5d:  \`' + Number(ai.prediction_5d?.low || 0).toFixed(3) + ' – ' + Number(ai.prediction_5d?.high || 0).toFixed(3) + ' EGP\`');
  if (ai.entry > 0) {
    sections.push('▸ Entry: \`' + Number(ai.entry).toFixed(3) + '\` · SL: \`' + Number(ai.stopLoss).toFixed(3) + '\` · TP: \`' + Number(ai.takeProfit).toFixed(3) + '\`');
    // Entry window and position size
    if (ai.entryWindow) sections.push('▸ Window: \`' + ai.entryWindow + '\`');
    if (ai.positionSizeModifier && ai.positionSizeModifier !== 'full') {
      sections.push('▸ Position: **' + ai.positionSizeModifier.toUpperCase() + '**');
    }
  }

  // Invalidation level
  if (ai.invalidation && ai.invalidation.price > 0) {
    sections.push('▸ 🛑 Invalidation: \`' + Number(ai.invalidation.price).toFixed(3) + ' EGP\` (' + ai.invalidation.basis + ')');
  }

  // ── Analysis ──
  sections.push('');
  sections.push('**📝 Analysis**');
  sections.push((ai.reasoning_ar || '').substring(0, 900));

  allEmbeds.push({
    title: ACTION_EMOJI[action] + ' ' + a.fullName + ' [\`' + Number(a.currentPrice).toFixed(3) + ' EGP\`]',
    description: sections.join('\\n').substring(0, 4000),
    color
  });
}

// ── Chunk & send ──
const payloads = [];
let batch = [], chars = 0;
for (const e of allEmbeds) {
  const len = (e.title || '').length + (e.description || '').length + 100;
  if (batch.length >= 2 || (chars + len > 5500 && batch.length > 0)) {
    payloads.push(batch);
    batch = []; chars = 0;
  }
  batch.push(e);
  chars += len;
}
if (batch.length > 0) payloads.push(batch);

const sendResults = [];
for (let i = 0; i < payloads.length; i++) {
  const body = JSON.stringify({ ...BOT, embeds: payloads[i] });
  for (const webhookUrl of WEBHOOK_URLS) {
    let success = false;
    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const resp = await httpReq({
          method: 'POST', url: webhookUrl,
          headers: { 'Content-Type': 'application/json' },
          body,
          returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 15000
        });
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          sendResults.push({ batch: i + 1, webhook: webhookUrl.split('/')[6], status: resp.statusCode, ok: true });
          success = true;
        } else if (resp.statusCode === 429) {
          const ra = (typeof resp.body === 'object' ? resp.body?.retry_after : 3) || 3;
          await sleep(ra * 1000 + 500);
        } else {
          const errBody = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
          sendResults.push({ batch: i + 1, webhook: webhookUrl.split('/')[6], status: resp.statusCode, ok: false, detail: errBody.substring(0, 200) });
          break;
        }
      } catch (e) {
        sendResults.push({ batch: i + 1, webhook: webhookUrl.split('/')[6], error: e.message, ok: false });
        if (attempt < 2) await sleep(2000);
      }
    }
    await sleep(1000);
  }
  if (i < payloads.length - 1) await sleep(2000);
}

return [{
  json: {
    totalStocks: data.length,
    totalEmbeds: allEmbeds.length,
    totalPayloads: payloads.length,
    sendResults,
    allOk: sendResults.every(r => r.ok)
  }
}];
`;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------
function buildDiscordNode(opts = {}) {
  const { prevNodeName = 'AI Analysis Per Stock', startX = 2200, startY = 300 } = opts;

  const node = createCodeNode(
    'Format and Send to Discord',
    DISCORD_CODE.trim(),
    [startX, startY]
  );

  const nodes = [node];
  const connections = {
    [prevNodeName]: {
      main: [[{ node: 'Format and Send to Discord', type: 'main', index: 0 }]],
    },
  };

  return { nodes, connections, lastNodeName: 'Format and Send to Discord' };
}

module.exports = { buildDiscordNode };
