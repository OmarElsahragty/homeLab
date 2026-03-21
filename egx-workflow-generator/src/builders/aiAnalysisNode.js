/**
 * aiAnalysisNode.js — AI Analysis (Per Stock) node generator
 *
 * Smart Context — AI receives the 2 most semantically similar past
 * trading days (Ollama pgvector RAG) and calibrates by analogy, not aggregation.
 *
 * Embeds:
 *   - SYSTEM_PROMPT (~450 lines, EGX-ARBS strategy, divergence, VVP, Fibonacci,
 *     regime, breadth, institutional flow, Volume-Confirmed Wave Mechanics,
 *     + Smart Context Semantic Memory)
 *   - buildContext with smartContext (2 similar past sessions via pgvector RAG)
 *   - callGLM (Z.ai GLM, 2 retries, web_search tool, 180s timeout)
 *   - tryParseJSON (robust extraction from markdown fences)
 *   - sanitise
 *   - defaultAI (ATR-based fallback)
 *   - Main loop: 1.5s sleep between stocks
 */

const { createCodeNode } = require('../lib/utils');

// ---------------------------------------------------------------------------
// Embedded code — AI Analysis Per Stock
// ---------------------------------------------------------------------------
const AI_ANALYSIS_CODE = `
if ($input.all()[0]?.json?._skip) return [{ json: { _skip: true, reason: 'EGX closed' } }];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const httpReq = this.helpers.httpRequest;

const ZAI_API_KEY  = '${process.env.ZAI_API_KEY}';
const ZAI_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const SLEEP_MS     = 1500;
const HTTP_TIMEOUT = 180000;

const SYSTEM_PROMPT = \`You are an elite senior Technical Analyst specializing EXCLUSIVELY in the Egyptian Exchange (EGX).
You are analyzing a SINGLE stock with full focus. Provide deep, thorough analysis.

=== EGX MARKET CONTEXT (March 2026 Research) ===
- EGX annualized volatility: ~29.75% (nearly 2x MSCI EM) — adjust all thresholds accordingly
- Average annual return: ~19% with extreme variance (2005: +146%, 2008: -56%, 2023: >70%)
- Peak cycles: ~26 months, trough cycles: ~18 months
- CBE interest rates: check the cbeRates field for latest values — rate cuts are bullish for equities
- EGX is a "macro-first" market: CBE rates > EGP stability > inflation > political stability
- Egypt's 5-day trading week (Sun–Thu)

=== TRADING HOURS (UPDATED March 24, 2026) ===
NEW SESSION: 9:30 AM – 3:00 PM Cairo (EET) = 5.5 hours
- Previous: 10:00 AM – 2:30 PM (4.5 hours)
- Extended by 30 min at each end (FRA approval, effective post-Eid)
- Total session: 5h 30m of continuous trading

=== INTRADAY MICROSTRUCTURE (Rushdy & Samak, MDPI 2025) ===
- FIRST 30 MIN (9:30–10:00): AVOID — widest spreads (~0.384 bps), highest volatility (~0.25%), most noise
- MIDDAY (11:00–1:00): Lower depth (7.8M shares), moderate spreads — acceptable for scaled entries
- LAST 60-90 MIN (1:30–3:00): OPTIMAL — peak depth (20.3M→12.8M shares), narrowest spreads
- Day-of-week: Sunday = weakest (reduce size 40%), Thursday = strongest (increase conviction 20%)
- CRITICAL: Signals from the first 30 minutes should be DISCOUNTED heavily — they are noise-dominated

=== DATA QUALITY NOTE ===
All intraday data (15m, 1H) has been filtered to the organic trading session (9:30 AM – 3:00 PM Cairo).
The MOC auction period has been programmatically removed.
4H = SYNTHESIZED from organic 1H candles across the full 5.5-hour trading day.
This represents one complete organic EGX session, excluding MOC auction.

=== MULTI-TIMEFRAME FRAMEWORK ===
  W (Weekly)  → Long-term macro trend & deep Elliott Wave
  4H (Daily)  → PRIMARY MACRO ANCHOR (= 1 organic EGX day, 5.5 hours)
  1H          → Swing signals & sub-wave structure
  15m         → Precision entry timing

=== INDICATOR KEY (EGX-OPTIMIZED) ===
CORE:
- ema: EMA 9/21/50 alignment (bullish/bearish/mixed)
- rsi: RSI-14 (trend filter)
- mH/mHS/mX: MACD 12/26/9 histogram, slope, crossover

EGX RESEARCH-BACKED:
- rsi3/rsi3Sig: RSI 3-period with 85/15 thresholds — 91% win rate on EGX
  * rsi3 <= 15 = EXTREME oversold (strong buy)
  * rsi3 >= 85 = EXTREME overbought (strong sell)
- mEgxH/mEgxHS/mEgxX: MACD 8/17/9 (EGX-optimized, faster signals)
- ichi.cloud/tk: Ichimoku 7/22/44 (adapted for 5-day EGX week)
  * above_cloud = bullish, below_cloud = bearish, inside = indecision
  * tk = tenkan/kijun cross
- adx.v/pdi/mdi/sig: ADX 14-period trend strength
  * ADX > 25 = strong trend confirmed
  * ADX < 20 = ranging (use mean reversion)
- bb.u/l/w/pB/sig: Bollinger 10/2.5 (volatility squeeze)
  * squeeze signal = imminent breakout
  * pctB > 100 or < 0 = price outside bands
- stoch.k/d/sig/x: Stochastic 9/3/2 (quick oscillator)
  * oversold + bullish crossover = entry signal

VOLUME & SMART MONEY:
- vol.mfi/mfiSig: MFI 14-period (Money Flow Index)
  * > 80 = institutional overbought, < 20 = institutional oversold
- vol.cmf/cmfSig: CMF 20-period (Chaikin Money Flow)
  * positive = accumulation, negative = distribution
- vol.sm/smc: Smart Money composite signal & confidence score
  * Combines OBV, A/D Line, MFI, CMF, volume spikes

ADVANCED INDICATORS:
- div.rsi/div.macd: RSI/MACD vs Price DIVERGENCE detection
  * 'bearish' = price making higher highs but indicator making lower highs (REVERSAL WARNING)
  * 'bullish' = price making lower lows but indicator making higher lows (REVERSAL OPPORTUNITY)
  * CRITICAL: RSI bearish divergence at Fibonacci resistance = HIGH-PROBABILITY sell signal
- vvp.poc/vah/val/pos: Volume-Weighted Price Profile
  * poc = Point of Control (highest volume price level)
  * vah/val = Value Area High/Low (70% of volume traded here)
  * pos = 'above_value'|'inside_value'|'below_value'
  * Price above POC with volume confirmation = strong trend
  * Price below value area = potential mean reversion target
- fib.f382/f500/f618/f786: Structural Fibonacci Retracements (NEW)
  * Measured from the last complete swing high→low (uptrend) or low→high (downtrend)
  * f618 = golden ratio — deepest common retracement, highest significance
  * f500 = 50% midpoint — psychological support/resistance
  * f786 = last hold before the impulse wave is considered invalidated
  * CRITICAL CONFLUENCE: When a Fibonacci level (esp. f618 or f500) is within ±0.5%
    of the VVP Point of Control (vvp.poc), this is a HIGH-CONFIDENCE S/R zone validated
    by BOTH technical structure AND volume distribution history simultaneously
  * fib.e162/e262: Extension profit targets — Wave 3 (1.618×) and extended Wave 5 (2.618×)

=== MARKET REGIME & BREADTH ===
When provided:
- regime.regime: 'strong_bullish'|'bullish'|'neutral'|'bearish'|'strong_bearish'
  * Use this to filter signal quality: only take bullish setups in bullish+ regimes
- marketBreadth.signal: 'broad_bullish'|'narrow_leadership'|'mixed'|'broad_bearish'
  * 'narrow_leadership' = CAUTION — EGX30 strength without broad confirmation is fragile
  * 'broad_bullish' = CONFIRMING — safe to increase conviction
  * 'broad_bearish' = DEFENSIVE — reduce position size recommendations

=== CBE RATES ===
When cbeRates is provided:
- Reference overnight deposit/lending rates in your analysis
- Rate direction (cutting = bullish, hiking = bearish) is the #1 macro factor for EGX
- Compare current rates to historical T-bill yields (mid-20s%) — high yields compete with equities

=== INSTITUTIONAL ORDER FLOW ===
When institutionalFlow is provided:
- netForeign: EGP net value (millions) — positive = foreigners are NET BUYERS; negative = net sellers
- netArab: EGP net value (millions) — positive = Arab institutions are NET BUYERS; negative = net sellers
- foreignSentiment / arabSentiment: 'buying' | 'selling' | 'neutral'
- Source: EGX daily investor segmentation data (updated after market close)

EGX-ARBS Institutional Rules:
1. Both foreign AND Arab buying = STRONG institutional accumulation — highest conviction BUY filter
2. Foreign buying + Arab selling = MIXED — reduce confidence score by 15–20%
3. Both selling = institutional distribution — increase SELL conviction, reduce BUY size to half
4. VVP-POC CONFLUENCE: If foreigners are net buyers AND current price is AT or BELOW the VVP
   Point of Control, this is a HIGH-PROBABILITY accumulation at the market's highest-volume price
   node. This setup overrides a neutral EMA or RSI reading.
5. FIBONACCI-FLOW CONFLUENCE: If foreign institutions are net buyers AND price is at the golden
   pocket (f618 ± 0.5%), label this a TRIPLE CONFLUENCE setup in reasoning_ar:
   "تقاطع ثلاثي: مستويات فيبوناتشي + نقطة تحكم حجم التداول + تدفق مؤسسي أجنبي"
6. DIVERGENCE OVERRIDE: If institutional flow shows net buying but RSI/MACD shows bearish
   divergence, PREFER the technical divergence — institutions may be distributing into retail
   strength (classic smart-money exit at Wave 5 terminal)
7. If institutionalFlow.error is set, note unavailability in reasoning_ar and proceed on TA only

=== EXECUTION TIMING RULES (EGX-ARBS Layer 6) ===
In your trade recommendations, incorporate:
- Entry ONLY during optimal window: 1:30 PM – 3:00 PM Cairo (peak depth, narrowest spreads)
- NEVER recommend entries in the first 30 minutes (9:30–10:00 AM)
- Sunday: explicitly state reduced position size (40% reduction)
- Thursday: note higher conviction permissible

=== ELLIOTT WAVE INTERPRETATION ===
- ew.l = Wave label, ew.p = phase, ew.q = quality (0-95), ew.d = direction
- ew.sub.ratio = current wave ratio to previous wave
- ew.sub.fibMatch = Fibonacci relationship (38.2%, 61.8%, 100%, 161.8%, 261.8%)
- Wave 3 (impulse, quality > 60) = STRONGEST phase, expect acceleration
- Wave 5 = final push, watch for exhaustion (RSI divergence + MFI > 80)
- Wave C (corrective) = final correction leg, prepare for reversal
- Cross-TF alignment (waveAlignment.signal) is critical for confidence

=== VOLUME-CONFIRMED WAVE MECHANICS ===
ALL directional calls must pass a volume confirmation filter:
1. BUY signals require: OBV rising OR CMF > 0 OR MFI < 70 (not already overbought)
2. SELL signals require: OBV falling OR CMF < 0 OR MFI > 30 (not already oversold)
3. Divergence override: RSI bearish divergence at Wave 5 or Fibonacci resistance = SELL regardless
4. VVP confirmation: If price is above Value Area with declining OBV = distribution, not breakout
5. TRIPLE CONFLUENCE (highest conviction setup): Fibonacci level (f618/f500) within ±0.5% of VVP
   POC AND institutional flow alignment (foreigners buying at that level) = MAXIMUM BUY conviction.
   State this explicitly in reasoning_ar as shown in the Institutional Order Flow section above.

=== NEWS ANALYSIS RULES ===
- Analyze ALL provided Mubasher news items for this stock
- Correlate each news item with the technical picture:
  * Positive news + bullish technicals = REINFORCED buy signal
  * Positive news + bearish technicals = CONFLICTING (technicals take priority)
  * Negative news + bearish technicals = REINFORCED sell signal
- Consider news recency: more recent = more weight
- The 'title' field in EVERY news_analysis item MUST be the original Arabic title from the news context — do NOT translate
- The 'analysis' field in EVERY news_analysis item MUST be in Egyptian Arabic — mandatory
- If no news, focus entirely on TA

=== QUANTITATIVE CONSTRAINTS (MANDATORY) ===

--- Constraint 1: CATALYST DECAY (News Timelines) ---
News influence decays exponentially with age. Apply these weights to news impact:
- Published TODAY (0 days old): 100% weight — full influence on action/confidence
- Published 1–3 days ago: 70% weight — strong influence, note recency in reasoning_ar
- Published 3–7 days ago: 30% weight — moderate, label as "تأثير متناقص" in reasoning_ar
- Published >7 days ago: IGNORE COMPLETELY — do not mention in news_analysis
IMPORTANT: Apply decay to confidence adjustments from news. A positive headline from 5 days ago
should NOT boost confidence by the same amount as an identical headline from today.

--- Constraint 2: TURNOVER vs VOLUME (EGP Value Filter) ---
When turnover data is provided (to.lat = latest, to.avg = 20-day average, to.r = ratio):
- Turnover = Close × Volume (total EGP value traded)
- If to.r < 0.5 (latest turnover < 50% of 20-day avg): LIQUIDITY WARNING
  * Reduce confidence by 15 points
  * Set positionSizeModifier to at most 'reduced_40pct'
  * Note in reasoning_ar: "سيولة ضعيفة — حجم التداول بالجنيه أقل من نصف المتوسط"
- If to.r > 2.0: UNUSUAL ACTIVITY — investigate if accumulation or distribution
- Volume spikes (vol.spike=true) with to.r < 0.8 are FALSE SIGNALS — ignore them

--- Constraint 3: MACRO REGIME BASELINE (EGX30 Index) ---
When macroBaseline is provided:
- macroBaseline.regime: EGX30 index regime ('strong_bullish'|'bullish'|'neutral'|'bearish'|'strong_bearish')
- macroBaseline.trend: EGX30 EMA alignment
- macroBaseline.score: regime score (-100 to +100)
MACRO DISCOUNT RULE:
- If macroBaseline.regime is 'bearish' or 'strong_bearish':
  * DISCOUNT all BUY confidence by 50% (multiply confidence × 0.5 and round)
  * Set positionSizeModifier to at most 'half'
  * Add to reasoning_ar: "خصم ٥٠٪ — مؤشر EGX30 في نظام هبوطي"
- If macroBaseline.regime is 'neutral': reduce BUY confidence by 15%
- If macroBaseline.regime is 'bullish' or 'strong_bullish': no discount (market supports the trade)
- SELL signals are NOT discounted by bearish macro — bearish macro REINFORCES sell signals

--- Constraint 4: CATALYST DECAY APPLIED FLAG ---
When catalystDecayApplied is true, it means the system has detected that news items
influenced your previous analysis but those catalysts have now aged beyond their
peak influence. You MUST set catalystDecayApplied: true in your output when:
- A news item that drove your previous BUY/SELL call is now >3 days old
- The fundamental catalyst (earnings, CBE decision, etc.) has been fully priced in
- No new catalysts have emerged to replace the decayed ones
This flag helps the learning loop track how catalyst decay affects prediction accuracy.

--- Constraint 5: MANDATORY INVALIDATION LEVEL ---
You MUST provide an invalidation level for every actionable signal (BUY/SELL/WATCH).
- invalidation.price: The exact price at which the thesis is INVALIDATED
- invalidation.basis: The technical basis — one of:
  * 'VVP_VAL' — below VVP Value Area Low (strongest for longs)
  * 'fib_f618' — below 61.8% Fibonacci retracement
  * 'fib_f786' — below 78.6% Fibonacci (last defense)
  * 'ATR_2x' — 2× ATR below entry (fallback when no clear structure)
  * 'structure' — below identified support/resistance structure
  * 'ichimoku_cloud' — below Ichimoku cloud base
PRIORITY: VVP_VAL > fib_f618 > structure > ichimoku_cloud > ATR_2x
For HOLD actions: invalidation.price = 0, invalidation.basis = 'none'

=== SMART CONTEXT (Semantic Memory) ===
When smartContext is provided, you have access to the 2 most semantically similar past
trading days for this stock — days where the market setup (regime, confluence, wave,
indicators) was most similar to today. This is your SEMANTIC LEARNING LOOP.

Each smartContext entry contains:
  - date: run date of the similar session
  - action: what was recommended (BUY/SELL/HOLD/WATCH)
  - confidence: confidence at the time (0-100)
  - similarity: cosine similarity score (1.0 = identical market state, 0.0 = unrelated)
  - reasoning: excerpt of the reasoning from that session (Arabic)
  - marketState: brief snapshot of that session's market state
  - targets: {entry, tp, sl, pred24hLow, pred24hHigh, pred5dLow, pred5dHigh}
  - invalidation: basis@price string from that session

SEMANTIC MEMORY RULES:
1. If similarity > 0.85: very similar setup. Reference explicitly in reasoning_ar.
   Cite: "تشابه [XX]٪ مع جلسة [date]"
2. If similar session was audited and outcome was correct:
   - Setup worked before in similar conditions. Consider boosting confidence by 10pts.
3. If similar session was audited and outcome was wrong:
   - Setup failed before. Consider reducing confidence by 10pts and widening SL.
4. Compare context targets with your current prediction — adapt range width accordingly.
   If context pred24h range was too narrow (missed), WIDEN your range today.
5. If smartContext is empty or similarity < 0.60: this is a novel setup. Proceed normally.
6. Never blindly copy context action — market conditions evolve. Use context as signal, not rule.

=== OUTPUT FORMAT ===
Respond ONLY with valid JSON. No markdown. No code fences.
{
  "stock": "TICKER",
  "action": "BUY|SELL|HOLD|WATCH",
  "confidence": 0-100,
  "regime": "strong_bullish|bullish|neutral|bearish|strong_bearish",
  "breadthConfirmation": true|false,
  "news_analysis": [
    {
      "title": "<العنوان الأصلي للخبر باللغة العربية كما ورد في السياق>",
      "impact": "positive|negative|neutral",
      "analysis": "<2-3 sentences in Egyptian Arabic analyzing this news in the stock's technical context>"
    }
  ],
  "prediction_24h": {"low": 0.00, "high": 0.00},
  "prediction_5d": {"low": 0.00, "high": 0.00},
  "entry": 0.00,
  "entryWindow": "1:30 PM – 3:00 PM Cairo (optimal depth)",
  "stopLoss": 0.00,
  "takeProfit": 0.00,
  "riskLevel": "LOW|MEDIUM|HIGH",
  "positionSizeModifier": "full|reduced_40pct|reduced_30pct|half",
  "volumeConfirmation": {
    "obv": "rising|falling|flat",
    "cmf": "accumulation|distribution|neutral",
    "mfi": "oversold|neutral|overbought",
    "confirmed": true|false
  },
  "divergenceWarning": "none|rsi_bearish|rsi_bullish|macd_bearish|macd_bullish",
  "institutionalFlowAlignment": "accumulating|distributing|mixed|unavailable",
  "fibVvpConfluence": {"detected": false, "level": 0.00, "description": "e.g. f618 at VVP POC ±0.3%"},
  "catalystDecayApplied": false,
  "invalidation": {"price": 0.00, "basis": "VVP_VAL|fib_f618|fib_f786|ATR_2x|structure|ichimoku_cloud|none"},
  "reasoning_ar": "<12-18 sentences in Egyptian Arabic covering: session-aware timing, regime assessment, breadth confirmation, Elliott Wave + sub-wave Fibonacci, divergence analysis (RSI/MACD vs price), Volume-Confirmed Wave status (OBV/CMF/MFI/VVP), Fibonacci-VVP triple confluence if detected, institutional order flow alignment (foreign/Arab net), Ichimoku cloud, ADX trend strength, RSI-3 extremes, Fibonacci S/R levels (f618 golden pocket vs price), news-TA correlation, CBE rate direction impact, macro baseline discount if applicable, turnover liquidity assessment, invalidation level justification, and MTF confluence>"
}

=== LANGUAGE RULE ===
ALL prompt instructions above are in English. ALL JSON field keys must be in English.
The value of 'reasoning_ar', each 'analysis' inside news_analysis, AND each 'title' inside news_analysis must be in Arabic.
All other JSON values must remain in English.\`;

// ─── buildContext ───────────────────────────────────────────────────
function buildContext(a) {
  const lines = ['=== ' + a.stock + ' (' + a.fullName + ') -- Current Price: ' + a.currentPrice + ' EGP ==='];
  lines.push('Available TFs: ' + a.tfs.join(', '));
  if (a.confluence) lines.push('MTF Confluence: score=' + a.confluence.score + ', bias=' + a.confluence.bias + ', strength=' + a.confluence.strength);
  if (a.waveAlignment) lines.push('Wave Alignment: signal=' + a.waveAlignment.signal + ' | ' + a.waveAlignment.detail);
  if (a.error) lines.push('Data Note: ' + a.error);

  // Regime
  if (a.regime) lines.push('Regime: ' + a.regime.regime + ' (score=' + a.regime.score + ')');

  // Macro Baseline (EGX30 Index)
  if (a.macroBaseline) {
    lines.push('MacroBaseline(EGX30): regime=' + a.macroBaseline.regime + ', score=' + a.macroBaseline.score + ', trend=' + a.macroBaseline.trend + ', price=' + a.macroBaseline.price);
  }

  // CBE Rates
  if (a.cbeRates) {
    lines.push('CBE Rates: Deposit=' + a.cbeRates.overnightDeposit + '%, Lending=' + a.cbeRates.overnightLending + '% (as of ' + a.cbeRates.lastUpdate + ', source: ' + a.cbeRates.source + ')');
  }

  // Market Breadth
  if (a.marketBreadth) {
    const mb = a.marketBreadth;
    let breadthLine = 'Market Breadth: ' + mb.signal;
    for (const [idx, data] of Object.entries(mb.indices || {})) {
      breadthLine += ' | ' + idx + ': ' + data.latest + ' (' + (data.change5d > 0 ? '+' : '') + data.change5d + '% 5d)';
    }
    lines.push(breadthLine);
  }

  // Institutional Flow
  if (a.institutionalFlow) {
    const fl = a.institutionalFlow;
    if (!fl.error || fl.netForeign !== null) {
      let flowLine = 'Institutional Flow (' + (fl.date || 'today') + ')';
      if (fl.netForeign !== null) flowLine += ' | Foreign: ' + (fl.netForeign > 0 ? '+' : '') + fl.netForeign + 'M (' + fl.foreignSentiment + ')';
      if (fl.netArab    !== null) flowLine += ' | Arab: '    + (fl.netArab    > 0 ? '+' : '') + fl.netArab    + 'M (' + fl.arabSentiment + ')';
      lines.push(flowLine);
    } else {
      lines.push('Institutional Flow: unavailable (' + fl.error + ')');
    }
  }

  for (const [tf, data] of Object.entries(a.tf || {})) {
    const parts = ['[' + tf + ']', 'ema=' + data.ema];
    if (data.ema9) parts.push('EMA9=' + data.ema9 + ' EMA21=' + data.ema21 + ' EMA50=' + data.ema50);
    if (data.rsi != null) parts.push('RSI14=' + data.rsi + '(prev:' + data.rsiPrev + ',slope:' + data.rsiSlp + ')');
    if (data.rsi3 != null) parts.push('RSI3=' + data.rsi3 + '(' + data.rsi3Sig + ')');
    if (data.mH != null) parts.push('MACD:hist=' + data.mH + ',slope=' + data.mHS + ',xover=' + data.mX);
    if (data.mEgxH != null) parts.push('MACD_EGX:hist=' + data.mEgxH + ',slope=' + data.mEgxHS + ',xover=' + data.mEgxX);
    if (data.atr) parts.push('ATR=' + data.atr);
    if (data.sup?.length) parts.push('Sup=[' + data.sup.join(',') + ']');
    if (data.res?.length) parts.push('Res=[' + data.res.join(',') + ']');

    // Ichimoku
    if (data.ichi) parts.push('Ichimoku:cloud=' + data.ichi.cloud + ',TK=' + data.ichi.tk);

    // ADX
    if (data.adx) parts.push('ADX=' + data.adx.v + '(+DI=' + data.adx.pdi + ',-DI=' + data.adx.mdi + ',' + data.adx.sig + ')');

    // Bollinger
    if (data.bb) parts.push('BB:width=' + data.bb.w + ',%B=' + data.bb.pB + ',sig=' + data.bb.sig);

    // Stochastic
    if (data.stoch) parts.push('Stoch:K=' + data.stoch.k + ',D=' + data.stoch.d + ',' + data.stoch.sig + ',x=' + data.stoch.x);

    // Elliott Wave
    if (data.ew) {
      let ewStr = 'Elliott:' + data.ew.l + '(' + data.ew.p + ',q=' + data.ew.q + ')';
      if (data.ew.sub) ewStr += ' sub:ratio=' + data.ew.sub.ratio + ',fib=' + data.ew.sub.fibMatch;
      parts.push(ewStr);
    }

    // Divergence
    if (data.div) {
      const divParts = [];
      if (data.div.rsi !== 'none') divParts.push('RSI_div=' + data.div.rsi);
      if (data.div.macd !== 'none') divParts.push('MACD_div=' + data.div.macd);
      if (divParts.length) parts.push('DIVERGENCE: ' + divParts.join(', '));
    }

    // VVP
    if (data.vvp) {
      parts.push('VVP:POC=' + data.vvp.poc + ',VAH=' + data.vvp.vah + ',VAL=' + data.vvp.val + ',pos=' + data.vvp.pos);
    }

    // Structural Fibonacci
    if (data.fib) {
      const f = data.fib;
      if (f.f236 != null) {
        parts.push('FIB[' + (f.up ? '↑' : '↓') + ' ' + f.sl + '→' + f.sh + ']:' +
          '23.6%=' + f.f236 + ',38.2%=' + f.f382 +
          ',50%=' + f.f500 + ',61.8%=' + f.f618 +
          ',78.6%=' + f.f786 + ',ext162%=' + f.e162);
        // Flag triple confluence when Fibonacci level aligns with VVP POC
        if (data.vvp) {
          const poc = data.vvp.poc;
          for (const [label, level] of [['f618', f.f618], ['f500', f.f500], ['f382', f.f382]]) {
            if (poc > 0 && Math.abs(level - poc) / poc < 0.005) {
              parts.push('TRIPLE_CONFLUENCE: ' + label + '=' + level + ' ≈ VVP_POC=' + poc +
                ' (±' + (Math.abs(level - poc) / poc * 100).toFixed(2) + '%)');
              break;
            }
          }
        }
      } else {
        // fallback: nearest fib
        parts.push('Fib:nearest=' + f.nr + '(' + f.nd + '%)');
      }
    }

    // Volume/Smart Money
    if (data.vol) {
      parts.push('SmartMoney=' + data.vol.sm + '(conf=' + data.vol.smc + ')');
      parts.push('MFI=' + data.vol.mfi + '(' + data.vol.mfiSig + ')');
      parts.push('CMF=' + data.vol.cmf + '(' + data.vol.cmfSig + ')');
      if (data.vol.div !== 'none') parts.push('VolDiv=' + data.vol.div);
      if (data.vol.spike) parts.push('VOLUME_SPIKE(x' + data.vol.vr + ')');
    }

    // Turnover
    if (data.to) {
      parts.push('Turnover:latest=' + data.to.lat + ',avg20=' + data.to.avg + ',ratio=' + data.to.r);
    }

    // Patterns
    if (data.pat) {
      parts.push('Structure=' + data.pat.st);
      if (data.pat.p?.length) parts.push('Patterns=' + data.pat.p.join(','));
    }

    lines.push(parts.join(' | '));
  }

  // Smart Context — 2 most semantically similar past sessions (pgvector RAG)
  if (a.smartContext && a.smartContext.length > 0) {
    lines.push('');
    lines.push('>>> SMART CONTEXT (2 Most Similar Past Sessions):');
    for (const ctx of a.smartContext.slice(0, 2)) {
      const simPct = ctx.similarity != null ? (Number(ctx.similarity) * 100).toFixed(1) : '?';
      let ctxLine = '[' + ctx.date + '] similarity=' + simPct + '%' +
        ' | action=' + ctx.action + ' conf=' + ctx.confidence;
      if (ctx.targets?.pred24hLow != null)
        ctxLine += ' | pred24h=[' + ctx.targets.pred24hLow + '-' + ctx.targets.pred24hHigh + ']';
      if (ctx.targets?.pred5dLow != null)
        ctxLine += ' | pred5d=[' + ctx.targets.pred5dLow + '-' + ctx.targets.pred5dHigh + ']';
      if (ctx.invalidation) ctxLine += ' | invalidation=' + ctx.invalidation;
      lines.push(ctxLine);
      if (ctx.reasoning) lines.push('   reasoning: ' + ctx.reasoning.slice(0, 350));
    }
  }

  if (a.news?.length > 0) {
    lines.push('');
    lines.push('>>> NEWS (Mubasher):');
    a.news.forEach((n) => {
      const dateStr = n.date || 'unknown';
      lines.push('[' + dateStr + ']: "' + n.title + '"');
      if (n.content && n.content !== n.title) lines.push('   ' + n.content.substring(0, 300));
    });
    lines.push('You MAY web_search on mubasher.info or enterprise.press ONLY if breaking news is present.');
  } else {
    lines.push('');
    lines.push('[No news. TA ONLY. DO NOT web_search.]');
  }

  return lines.join('\\n');
}

// ─── callGLM ────────────────────────────────────────────────────────
async function callGLM(userMessage, useWebSearch) {
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const reqBody = {
        model: 'glm-5',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 6000
      };
      if (useWebSearch) {
        reqBody.tools = [{ type: 'web_search', web_search: { enable: true, search_engine: 'search-prime', search_result: true } }];
      }
      const resp = await httpReq({
        method: 'POST', url: ZAI_ENDPOINT,
        headers: { 'Authorization': 'Bearer ' + ZAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: HTTP_TIMEOUT
      });
      if (resp.statusCode !== 200) {
        const body = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
        throw new Error('Z.ai ' + resp.statusCode + ': ' + body.substring(0, 150));
      }
      const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
      return body.choices?.[0]?.message?.content || '';
    } catch (e) {
      lastError = e.message;
      if (attempt < maxRetries - 1) {
        const backoffMs = 2000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
  }

  throw new Error(lastError || 'API call failed after retries');
}

// ─── tryParseJSON ───────────────────────────────────────────────────
// Strips control chars and literal newlines (common in LLM string values)
const cleanJson = s => s.replace(/[\\u0000-\\u001F\\u007F\\u2028\\u2029]/g, ' ');

// Fix trailing commas before } or ] — common LLM mistake
const fixTrailingCommas = s => s.replace(/,([\\s\\n\\r]*[}\\]])/g, '$1');

// Normalise curly/smart quotes → straight ASCII double-quotes
const normQuotes = s => s.replace(/[\\u201C\\u201D\\u201E\\u201F\\u00AB\\u00BB]/g, '"')
                          .replace(/[\\u2018\\u2019\\u201A\\u201B]/g, "'");

function tryParseJSON(raw) {
  // 1. Strip code fences (triple-backtick json ... triple-backtick) and normalise quotes
  let txt = raw
    .replace(/\\\`\\\`\\\`json[\\s\\S]*?\\\`\\\`\\\`/gi, s => s.replace(/\\\`\\\`\\\`json\\s*/i, '').replace(/\\\`\\\`\\\`\\s*$/, ''))
    .replace(/\\\`\\\`\\\`json/gi, '').replace(/\\\`\\\`\\\`/g, '')
    .replace(/~~~[a-z]*\\n?/gi, '');
  txt = normQuotes(txt).trim();

  const si = txt.indexOf('{');
  if (si === -1) return null;

  // 2. Brace-balanced walk — correctly skips '}' inside string values
  let depth = 0, inStr = false, esc = false, jsonEnd = -1;
  for (let i = si; i < txt.length; i++) {
    const c = txt[i];
    if (esc)        { esc = false; continue; }
    if (c === '\\\\') { esc = true;  continue; }
    if (c === '"')  { inStr = !inStr; continue; }
    if (inStr)      continue;
    if      (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { jsonEnd = i; break; } }
  }

  // Helper: apply cleanJson + trailing-comma fix, then try JSON.parse
  const tryParse = str => {
    const s1 = cleanJson(str);
    const s2 = fixTrailingCommas(s1);
    for (const s of [s1, s2]) {
      try { const o = JSON.parse(s); if (o && o.stock) return o; } catch {}
    }
    return null;
  };

  // 3. Try the balanced span (ideal path)
  if (jsonEnd !== -1) {
    const r = tryParse(txt.substring(si, jsonEnd + 1));
    if (r) return r;
  }

  // 4. Truncation recovery — scan the last 30 closing-brace positions
  const candidates = [];
  for (let i = txt.length - 1; i > si + 10 && candidates.length < 30; i--) {
    if (txt[i] === '}') candidates.push(i);
  }
  for (const ei of candidates) {
    const r = tryParse(txt.substring(si, ei + 1));
    if (r) return r;
  }

  return null;
}

// ─── defaultAI ──────────────────────────────────────────────────────
function defaultAI(a, errMsg) {
  const p = a.currentPrice || 0;
  const atrVal = Object.values(a.tf || {}).find(t => t?.atr)?.atr?.value || p * 0.02;
  return {
    stock: a.stock, action: 'HOLD', confidence: 0,
    regime: 'neutral',
    breadthConfirmation: false,
    news_analysis: [],
    prediction_24h: { low: +(p - atrVal).toFixed(2), high: +(p + atrVal).toFixed(2) },
    prediction_5d:  { low: +(p - atrVal * 2).toFixed(2), high: +(p + atrVal * 2.2).toFixed(2) },
    entry: 0, entryWindow: 'N/A', stopLoss: 0, takeProfit: 0, riskLevel: 'HIGH',
    positionSizeModifier: 'half',
    volumeConfirmation: { obv: 'flat', cmf: 'neutral', mfi: 'neutral', confirmed: false },
    divergenceWarning: 'none',
    institutionalFlowAlignment: 'unavailable',
    fibVvpConfluence: { detected: false, level: 0, description: '' },
    catalystDecayApplied: false,
    invalidation: { price: +(p - atrVal * 2).toFixed(2), basis: 'ATR_2x' },
    reasoning_ar: 'فشل التحليل: ' + errMsg
  };
}

// ─── sanitise ───────────────────────────────────────────────────────
function sanitise(raw, fb) {
  const p = fb.currentPrice || 0;
  const atrVal = Object.values(fb.tf || {}).find(t => t?.atr)?.atr?.value || p * 0.02;
  return {
    stock:          raw.stock || fb.stock,
    action:         ['BUY', 'SELL', 'HOLD', 'WATCH'].includes(raw.action) ? raw.action : 'HOLD',
    confidence:     typeof raw.confidence === 'number' ? Math.min(100, Math.max(0, raw.confidence)) : 50,
    regime:         raw.regime || 'neutral',
    breadthConfirmation: typeof raw.breadthConfirmation === 'boolean' ? raw.breadthConfirmation : false,
    news_analysis:  Array.isArray(raw.news_analysis) ? raw.news_analysis : [],
    prediction_24h: raw.prediction_24h?.low != null ? { low: +raw.prediction_24h.low, high: +raw.prediction_24h.high } : { low: +(p - atrVal).toFixed(2), high: +(p + atrVal).toFixed(2) },
    prediction_5d:  raw.prediction_5d?.low != null ? { low: +raw.prediction_5d.low, high: +raw.prediction_5d.high } : { low: +(p - atrVal * 2).toFixed(2), high: +(p + atrVal * 2.2).toFixed(2) },
    entry:          raw.entry || 0,
    entryWindow:    raw.entryWindow || '1:30 PM – 3:00 PM Cairo (optimal depth)',
    stopLoss:       raw.stopLoss || 0,
    takeProfit:     raw.takeProfit || 0,
    riskLevel:      ['LOW', 'MEDIUM', 'HIGH'].includes(raw.riskLevel) ? raw.riskLevel : 'MEDIUM',
    positionSizeModifier: ['full', 'reduced_40pct', 'reduced_30pct', 'half'].includes(raw.positionSizeModifier) ? raw.positionSizeModifier : 'full',
    volumeConfirmation: raw.volumeConfirmation && typeof raw.volumeConfirmation === 'object' ? {
      obv:       ['rising', 'falling', 'flat'].includes(raw.volumeConfirmation.obv) ? raw.volumeConfirmation.obv : 'flat',
      cmf:       ['accumulation', 'distribution', 'neutral'].includes(raw.volumeConfirmation.cmf) ? raw.volumeConfirmation.cmf : 'neutral',
      mfi:       ['oversold', 'neutral', 'overbought'].includes(raw.volumeConfirmation.mfi) ? raw.volumeConfirmation.mfi : 'neutral',
      confirmed: typeof raw.volumeConfirmation.confirmed === 'boolean' ? raw.volumeConfirmation.confirmed : false
    } : { obv: 'flat', cmf: 'neutral', mfi: 'neutral', confirmed: false },
    divergenceWarning:        raw.divergenceWarning || 'none',
    institutionalFlowAlignment: raw.institutionalFlowAlignment || 'unavailable',
    fibVvpConfluence: raw.fibVvpConfluence && typeof raw.fibVvpConfluence === 'object' ? {
      detected:    typeof raw.fibVvpConfluence.detected === 'boolean' ? raw.fibVvpConfluence.detected : false,
      level:       raw.fibVvpConfluence.level || 0,
      description: raw.fibVvpConfluence.description || ''
    } : { detected: false, level: 0, description: '' },
    catalystDecayApplied: typeof raw.catalystDecayApplied === 'boolean' ? raw.catalystDecayApplied : false,
    invalidation: raw.invalidation && typeof raw.invalidation === 'object' ? {
      price: typeof raw.invalidation.price === 'number' ? raw.invalidation.price : 0,
      basis: ['VVP_VAL', 'fib_f618', 'fib_f786', 'ATR_2x', 'structure', 'ichimoku_cloud', 'none'].includes(raw.invalidation.basis) ? raw.invalidation.basis : 'none'
    } : { price: 0, basis: 'none' },
    reasoning_ar:   raw.reasoning_ar || 'لا يوجد تحليل.'
  };
}

// ─── Main loop ──────────────────────────────────────────────────────
const inputItems = $input.all();
const results = [];
const validItems = inputItems.filter(i => !i.json._fetchLog && i.json.currentPrice > 0 && !i.json.isIndex).map(i => i.json);
const errorItems = inputItems.filter(i => !i.json._fetchLog && (i.json.currentPrice <= 0 || (!i.json.ta && i.json.error)));
const logItems   = inputItems.filter(i => i.json._fetchLog);

for (let i = 0; i < validItems.length; i++) {
  const sd = validItems[i];
  const userMessage = 'Analyze this SINGLE EGX stock with full depth. Return JSON for this one stock only.\\n\\n' + buildContext(sd);
  const hasNews = sd.news && sd.news.length > 0;

  let parsedData = null;
  let errMsg = 'Unknown';
  let rawSnippet = '';

  try {
    // Attempt 1: with web_search if news available
    const rawOutput = await callGLM(userMessage, hasNews);
    rawSnippet = rawOutput.substring(0, 300);
    parsedData = tryParseJSON(rawOutput);

    // Attempt 2: retry without web_search and stricter prompt if JSON extraction failed
    if (!parsedData) {
      await sleep(2000);
      const strictPrefix = 'IMPORTANT: Respond ONLY with a valid JSON object. No text before or after. No markdown code fences. No commentary. Start your response with { and end with }.\\n\\n';
      const rawRetry = await callGLM(strictPrefix + userMessage, false);
      rawSnippet = rawRetry.substring(0, 300);
      parsedData = tryParseJSON(rawRetry);
      if (!parsedData) throw new Error('No JSON found after retry. Raw: ' + rawSnippet.substring(0, 150));
    }
  } catch (e) {
    errMsg = e.message;
  }

  results.push({ json: { ...sd, ai: parsedData ? sanitise(parsedData, sd) : defaultAI(sd, errMsg) } });

  if (i < validItems.length - 1) await sleep(SLEEP_MS);
}

for (const item of errorItems) {
  const d = item.json;
  d.ai = defaultAI(d, d.error || 'No price data');
  results.push({ json: d });
}

for (const item of logItems) results.push(item);
return results;
`;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------
function buildAIAnalysisNode(opts = {}) {
  const { prevNodeName = 'Attach History', startX = 1800, startY = 300 } = opts;

  const node = createCodeNode(
    'AI Analysis Per Stock',
    AI_ANALYSIS_CODE.trim(),
    [startX, startY]
  );

  const nodes = [node];
  const connections = {
    [prevNodeName]: {
      main: [[{ node: 'AI Analysis Per Stock', type: 'main', index: 0 }]],
    },
  };

  return { nodes, connections, lastNodeName: 'AI Analysis Per Stock' };
}

module.exports = { buildAIAnalysisNode };
