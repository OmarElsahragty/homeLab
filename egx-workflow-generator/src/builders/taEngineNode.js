/**
 * taEngineNode.js — Technical Analysis Engine Node Generator
 *
 * Produces an n8n Code node containing the full TA Engine with:
 *   - Indicators: EMA, RSI, MACD, ATR, RSI-3, MACD-EGX, Ichimoku,
 *     MFI, CMF, ADX, Bollinger, Stochastic, OBV, A/D Line,
 *     Volume Spikes, Volume Analysis, Elliott Wave, Fibonacci, Patterns, S/R
 *   - Advanced: Divergence, RSI Array, VVP, Regime Score,
 *     structural Fibonacci retracements, updated confluence scoring
 *
 * @module taEngineNode
 */

'use strict';

const { createCodeNode } = require('../lib/utils');

// ──────────────────────────────────────────────────────────────────
// TA ENGINE CODE
// ──────────────────────────────────────────────────────────────────

const TA_ENGINE_CODE = `
/*
 * TA ENGINE — EGX Deep Analyst
 * All Timeframes: EMA, RSI, MACD, ATR, RSI-3, MACD-EGX, Ichimoku, MFI, CMF,
 *   ADX, Bollinger, Stochastic, OBV, A/D Line, Volume Spikes, Elliott Wave,
 *   Fibonacci, Patterns, S/R + Divergence, VVP, Regime Filter, Confluence
 */
if ($input.all()[0]?.json?._skip) return $input.all();

// ═══ CONSTANTS ═══
const TF_HIERARCHY = ['1W', '1D', '4H', '1H'];
const TF_WEIGHTS   = { '1W': 2, '1D': 5, '4H': 3, '1H': 1 };
const ZZ_THRESHOLDS = { '1W': 0.06, '1D': 0.035, '4H': 0.04, '1H': 0.025 };

// ═══ CORE INDICATORS ═══

function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSI(closes, p) {
  p = p || 14;
  if (closes.length < p + 2) return { value: 50, signal: 'neutral' };
  let ag = 0, al = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al -= d;
  }
  ag /= p; al /= p;
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
    al = (al * (p - 1) + (d < 0 ? -d : 0)) / p;
  }
  const rs = al === 0 ? 100 : ag / al;
  const value = +(100 - 100 / (1 + rs)).toFixed(2);
  return {
    value,
    signal: value > 70 ? 'overbought' : value < 30 ? 'oversold' : 'neutral'
  };
}

function calcMACD(closes) {
  if (closes.length < 27) return { histogram: 0, signal: 0, histSlope: 0, crossover: 'none' };
  const e12 = calcEMA(closes, 12), e26 = calcEMA(closes, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const sigLine = calcEMA(macdLine, 9);
  const n = closes.length - 1;
  const hist = +(macdLine[n] - sigLine[n]).toFixed(4);
  const prevHist = +(macdLine[n-1] - sigLine[n-1]).toFixed(4);
  return {
    histogram: hist,
    signal: +sigLine[n].toFixed(4),
    histSlope: +(hist - prevHist).toFixed(4),
    crossover: (prevHist <= 0 && hist > 0) ? 'bullish'
             : (prevHist >= 0 && hist < 0) ? 'bearish' : 'none'
  };
}

function calcATR(highs, lows, closes, p) {
  p = p || 14;
  if (closes.length < p + 1) return { value: 0, pct: 0 };
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  let atr = trs.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < trs.length; i++) atr = (atr * (p - 1) + trs[i]) / p;
  return { value: +atr.toFixed(4), pct: +(atr / closes[closes.length - 1] * 100).toFixed(2) };
}

function calcRSIShort(closes) {
  const p = 3;
  if (closes.length < p + 2) return { value: 50, signal: 'neutral' };
  let ag = 0, al = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al -= d;
  }
  ag /= p; al /= p;
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
    al = (al * (p - 1) + (d < 0 ? -d : 0)) / p;
  }
  const rs = al === 0 ? 100 : ag / al;
  const value = +(100 - 100 / (1 + rs)).toFixed(2);
  return {
    value,
    signal: value >= 85 ? 'overbought' : value <= 15 ? 'oversold' : 'neutral'
  };
}

function calcMACDEGX(closes) {
  if (closes.length < 18) return { histogram: 0, signal: 0, histSlope: 0, crossover: 'none' };
  const e8 = calcEMA(closes, 8), e17 = calcEMA(closes, 17);
  const macdLine = e8.map((v, i) => v - e17[i]);
  const sigLine = calcEMA(macdLine, 9);
  const n = closes.length - 1;
  const hist = +(macdLine[n] - sigLine[n]).toFixed(4);
  const prevHist = +(macdLine[n-1] - sigLine[n-1]).toFixed(4);
  return {
    histogram: hist,
    signal: +sigLine[n].toFixed(4),
    histSlope: +(hist - prevHist).toFixed(4),
    crossover: (prevHist <= 0 && hist > 0) ? 'bullish'
             : (prevHist >= 0 && hist < 0) ? 'bearish' : 'none'
  };
}

function calcIchimoku(highs, lows, closes) {
  const n = closes.length;
  if (n < 44) return { cloud: 'unknown', tkCross: 'none' };
  const hl = (h, l, p) => {
    const hSlice = h.slice(-p), lSlice = l.slice(-p);
    return (Math.max(...hSlice) + Math.min(...lSlice)) / 2;
  };
  const tenkan = hl(highs, lows, 7);
  const kijun = hl(highs, lows, 22);
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = hl(highs, lows, 44);
  const price = closes[n - 1];
  let cloud = 'inside_cloud';
  if (price > Math.max(senkouA, senkouB)) cloud = 'above_cloud';
  else if (price < Math.min(senkouA, senkouB)) cloud = 'below_cloud';
  const prevTenkan = hl(highs.slice(0, -1), lows.slice(0, -1), 7);
  const prevKijun = hl(highs.slice(0, -1), lows.slice(0, -1), 22);
  let tkCross = 'none';
  if (prevTenkan <= prevKijun && tenkan > kijun) tkCross = 'bullish';
  else if (prevTenkan >= prevKijun && tenkan < kijun) tkCross = 'bearish';
  return { cloud, tkCross, tenkan: +tenkan.toFixed(4), kijun: +kijun.toFixed(4) };
}

function calcMFI(highs, lows, closes, volumes) {
  const p = 14;
  if (closes.length < p + 1) return { value: 50, signal: 'neutral' };
  let posFlow = 0, negFlow = 0;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  for (let i = closes.length - p; i < closes.length; i++) {
    const mf = tp[i] * volumes[i];
    if (tp[i] > tp[i - 1]) posFlow += mf;
    else negFlow += mf;
  }
  const mfi = negFlow === 0 ? 100 : +(100 - 100 / (1 + posFlow / negFlow)).toFixed(2);
  return {
    value: mfi,
    signal: mfi > 80 ? 'overbought' : mfi < 20 ? 'oversold' : 'neutral'
  };
}

function calcCMF(highs, lows, closes, volumes) {
  const p = 20;
  if (closes.length < p) return { value: 0, signal: 'neutral' };
  let mfvSum = 0, volSum = 0;
  for (let i = closes.length - p; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    if (range > 0) {
      const mfm = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
      mfvSum += mfm * volumes[i];
    }
    volSum += volumes[i];
  }
  const cmf = volSum === 0 ? 0 : +(mfvSum / volSum).toFixed(4);
  return {
    value: cmf,
    signal: cmf > 0.05 ? 'accumulation' : cmf < -0.05 ? 'distribution' : 'neutral'
  };
}

function calcADX(highs, lows, closes) {
  const p = 14;
  if (closes.length < p * 2) return { value: 0, pdi: 0, mdi: 0, signal: 'no_trend' };
  const pdm = [], mdm = [], trs = [];
  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i-1];
    const dnMove = lows[i-1] - lows[i];
    pdm.push(upMove > dnMove && upMove > 0 ? upMove : 0);
    mdm.push(dnMove > upMove && dnMove > 0 ? dnMove : 0);
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  let atr = trs.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let aPdm = pdm.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let aMdm = mdm.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < trs.length; i++) {
    atr = (atr * (p - 1) + trs[i]) / p;
    aPdm = (aPdm * (p - 1) + pdm[i]) / p;
    aMdm = (aMdm * (p - 1) + mdm[i]) / p;
  }
  const pdi = atr === 0 ? 0 : +(aPdm / atr * 100).toFixed(2);
  const mdi = atr === 0 ? 0 : +(aMdm / atr * 100).toFixed(2);
  const dx = pdi + mdi === 0 ? 0 : Math.abs(pdi - mdi) / (pdi + mdi) * 100;
  const adxVal = +dx.toFixed(2);
  let signal = 'no_trend';
  if (adxVal > 25) signal = pdi > mdi ? 'strong_uptrend' : 'strong_downtrend';
  else if (adxVal > 15) signal = pdi > mdi ? 'weak_uptrend' : 'weak_downtrend';
  return { value: adxVal, pdi, mdi, signal };
}

function calcBollinger(closes) {
  const p = 10, mult = 2.5;
  if (closes.length < p) return { upper: 0, lower: 0, width: 0, pctB: 50, signal: 'neutral' };
  const slice = closes.slice(-p);
  const sma = slice.reduce((a, b) => a + b, 0) / p;
  const std = Math.sqrt(slice.map(x => (x - sma) ** 2).reduce((a, b) => a + b, 0) / p);
  const upper = +(sma + mult * std).toFixed(4);
  const lower = +(sma - mult * std).toFixed(4);
  const price = closes[closes.length - 1];
  const width = upper - lower > 0 ? +((upper - lower) / sma * 100).toFixed(2) : 0;
  const pctB = upper - lower > 0 ? +((price - lower) / (upper - lower) * 100).toFixed(2) : 50;
  let signal = 'neutral';
  if (pctB > 100) signal = 'above_upper';
  else if (pctB < 0) signal = 'below_lower';
  else if (width < 2) signal = 'squeeze';
  return { upper, lower, width, pctB, signal };
}

function calcStochastic(highs, lows, closes) {
  const kP = 9, dP = 3, smooth = 2;
  if (closes.length < kP + dP) return { k: 50, d: 50, signal: 'neutral', crossover: 'none' };
  const kArr = [];
  for (let i = kP - 1; i < closes.length; i++) {
    const hSlice = highs.slice(i - kP + 1, i + 1);
    const lSlice = lows.slice(i - kP + 1, i + 1);
    const hh = Math.max(...hSlice), ll = Math.min(...lSlice);
    kArr.push(hh === ll ? 50 : (closes[i] - ll) / (hh - ll) * 100);
  }
  // Smooth %K
  const smoothK = [];
  for (let i = smooth - 1; i < kArr.length; i++) {
    smoothK.push(kArr.slice(i - smooth + 1, i + 1).reduce((a, b) => a + b, 0) / smooth);
  }
  // %D
  const dArr = [];
  for (let i = dP - 1; i < smoothK.length; i++) {
    dArr.push(smoothK.slice(i - dP + 1, i + 1).reduce((a, b) => a + b, 0) / dP);
  }
  const k = +smoothK[smoothK.length - 1].toFixed(2);
  const d = +dArr[dArr.length - 1].toFixed(2);
  const prevK = smoothK.length >= 2 ? smoothK[smoothK.length - 2] : k;
  const prevD = dArr.length >= 2 ? dArr[dArr.length - 2] : d;
  let crossover = 'none';
  if (prevK <= prevD && k > d) crossover = 'bullish';
  else if (prevK >= prevD && k < d) crossover = 'bearish';
  return {
    k, d,
    signal: k < 20 ? 'oversold' : k > 80 ? 'overbought' : 'neutral',
    crossover
  };
}

// ═══ ZIGZAG + WAVE ANALYSIS ═══

function zigzag(highs, lows, threshold) {
  if (highs.length < 5) return [];
  const swings = [];
  let dir = 0, lastH = highs[0], lastL = lows[0], lastHi = 0, lastLi = 0;
  for (let i = 1; i < highs.length; i++) {
    if (dir >= 0 && highs[i] > lastH) { lastH = highs[i]; lastHi = i; }
    if (dir <= 0 && lows[i] < lastL) { lastL = lows[i]; lastLi = i; }
    if (dir >= 0 && lastH > 0 && (lastH - lows[i]) / lastH >= threshold) {
      swings.push({ type: 'H', price: lastH, idx: lastHi });
      dir = -1; lastL = lows[i]; lastLi = i;
    }
    if (dir <= 0 && lastL > 0 && (highs[i] - lastL) / lastL >= threshold) {
      swings.push({ type: 'L', price: lastL, idx: lastLi });
      dir = 1; lastH = highs[i]; lastHi = i;
    }
  }
  if (dir > 0) swings.push({ type: 'H', price: lastH, idx: lastHi });
  else if (dir < 0) swings.push({ type: 'L', price: lastL, idx: lastLi });
  return swings;
}

function detectElliott(swings) {
  const result = {
    label: 'unknown', phase: 'unknown', position: 0,
    direction: 'unknown', quality: 0, subWave: null
  };
  if (swings.length < 5) return result;
  const last5 = swings.slice(-5);
  const prices = last5.map(s => s.price);

  // Check impulse (5-wave)
  if (last5[0].type === 'L') {
    // Potential up impulse: L-H-L-H-L or L-H-L-H-H
    if (prices[1] > prices[0] && prices[2] > prices[0] && prices[2] < prices[1]) {
      if (prices[3] > prices[1]) {
        const wave1 = prices[1] - prices[0];
        const wave3 = prices[3] - prices[2];
        const ratio = wave3 / wave1;

        let position = 5;
        if (swings.length > 5) {
          const wave5check = prices[4];
          if (wave5check > prices[3]) position = 5;
          else if (wave5check > prices[2]) position = 4;
          else position = 3;
        }

        let fibMatch = 'none';
        if (Math.abs(ratio - 1.618) < 0.15) fibMatch = '161.8%';
        else if (Math.abs(ratio - 2.618) < 0.2) fibMatch = '261.8%';
        else if (Math.abs(ratio - 1.0) < 0.1) fibMatch = '100%';
        else if (Math.abs(ratio - 0.618) < 0.1) fibMatch = '61.8%';

        result.label = 'Wave ' + position;
        result.phase = ratio > 1.3 ? 'extended' : 'impulse';
        result.position = position;
        result.direction = 'up';
        result.quality = Math.min(95, Math.round(50 + ratio * 15 + (position === 3 ? 20 : 0)));
        result.subWave = { ratio: +ratio.toFixed(3), fibMatch };
      }
    }
  }

  if (result.phase === 'unknown' && last5[0].type === 'H') {
    // Potential down impulse
    if (prices[1] < prices[0] && prices[2] < prices[0] && prices[2] > prices[1]) {
      if (prices[3] < prices[1]) {
        const wave1 = prices[0] - prices[1];
        const wave3 = prices[2] - prices[3];
        const ratio = wave3 / wave1;

        let position = 5;
        if (swings.length > 5) {
          const wave5check = prices[4];
          if (wave5check < prices[3]) position = 5;
          else if (wave5check < prices[2]) position = 4;
          else position = 3;
        }

        let fibMatch = 'none';
        if (Math.abs(ratio - 1.618) < 0.15) fibMatch = '161.8%';
        else if (Math.abs(ratio - 2.618) < 0.2) fibMatch = '261.8%';
        else if (Math.abs(ratio - 1.0) < 0.1) fibMatch = '100%';
        else if (Math.abs(ratio - 0.618) < 0.1) fibMatch = '61.8%';

        result.label = 'Wave ' + position;
        result.phase = ratio > 1.3 ? 'extended' : 'impulse';
        result.position = position;
        result.direction = 'down';
        result.quality = Math.min(95, Math.round(50 + ratio * 15 + (position === 3 ? 20 : 0)));
        result.subWave = { ratio: +ratio.toFixed(3), fibMatch };
      }
    }
  }

  // Check corrective (ABC)
  if (result.phase === 'unknown' && swings.length >= 3) {
    const last3 = swings.slice(-3);
    const p = last3.map(s => s.price);
    if (last3[0].type === 'H') {
      if (p[1] < p[0] && p[2] > p[1] && p[2] < p[0]) {
        result.label = 'Wave C'; result.phase = 'corrective';
        result.position = 3; result.direction = 'up';
        result.quality = 40;
      }
    } else {
      if (p[1] > p[0] && p[2] < p[1] && p[2] > p[0]) {
        result.label = 'Wave C'; result.phase = 'corrective';
        result.position = 3; result.direction = 'down';
        result.quality = 40;
      }
    }
  }

  return result;
}

// ═══ WAVE TRADING SIGNAL CLASSIFICATION ═══

function classifyWaveTradingSignal(elliott) {
  if (!elliott || elliott.phase === 'unknown') return 'unknown';
  const { phase, position, direction } = elliott;
  if (phase === 'impulse' || phase === 'extended') {
    if (position === 1) return 'setup';
    if (position === 2) return 'trigger_zone';
    if (position === 3) return 'momentum_core';
    if (position === 4) return 'avoid_consolidation';
    if (position === 5) return direction === 'up' ? 'take_profit_zone' : 'avoid_exhaustion';
  }
  if (phase === 'corrective') {
    if (position <= 2) return 'trigger_zone';
    return 'avoid_exhaustion';
  }
  return 'unknown';
}

// ═══ WAVE 2 VOLUME CONTRACTION CHECK ═══

function checkWave2VolumeContraction(swings, volumes) {
  if (!swings || swings.length < 3) return null;
  const last5 = swings.slice(-5);
  if (last5.length < 3) return null;
  const s0 = last5[0], s1 = last5[1], s2 = last5[2];
  if (s0.idx >= s1.idx || s1.idx >= s2.idx) return null;

  const w1Vols = volumes.slice(s0.idx, s1.idx + 1).filter(v => v > 0);
  const w2Vols = volumes.slice(s1.idx, s2.idx + 1).filter(v => v > 0);
  if (w1Vols.length === 0 || w2Vols.length === 0) return null;

  const avgW1 = w1Vols.reduce((a, b) => a + b, 0) / w1Vols.length;
  const avgW2 = w2Vols.reduce((a, b) => a + b, 0) / w2Vols.length;
  const ratio = avgW1 > 0 ? +(avgW2 / avgW1).toFixed(3) : 1;
  return { contracted: ratio < 0.7, ratio, avgW1: Math.round(avgW1), avgW2: Math.round(avgW2) };
}

// ═══ WAVE TAKE-PROFIT TIERS ═══

function computeWaveTakeProfit(swings, currentPrice, elliott) {
  if (!swings || swings.length < 3 || !elliott || elliott.phase === 'unknown') return null;
  const last5 = swings.slice(-5);
  if (last5.length < 3) return null;
  const s0 = last5[0], s1 = last5[1], s2 = last5[2];
  const wave1Range = Math.abs(s1.price - s0.price);
  if (wave1Range <= 0) return null;

  let tp1, tp2, tp3;
  if (elliott.direction === 'up' && s0.type === 'L') {
    tp1 = +(s2.price + wave1Range * 1.0).toFixed(4);
    tp2 = +(s2.price + wave1Range * 1.618).toFixed(4);
    tp3 = +(s2.price + wave1Range * 2.618).toFixed(4);
  } else if (elliott.direction === 'down' && s0.type === 'H') {
    tp1 = +(s2.price - wave1Range * 1.0).toFixed(4);
    tp2 = +(s2.price - wave1Range * 1.618).toFixed(4);
    tp3 = +(s2.price - wave1Range * 2.618).toFixed(4);
  } else {
    return null;
  }

  return {
    tp1: { price: tp1, action: 'partial_exit_50pct', extension: '100%' },
    tp2: { price: tp2, action: 'exit_bulk', extension: '161.8%' },
    tp3: { price: tp3, action: 'trail_runner_20pct', extension: '261.8%' },
    wave1Range: +wave1Range.toFixed(4),
    basePrice: s2.price
  };
}

function calcFibonacci(swings, currentPrice) {
  if (swings.length < 2) return null;
  const lastH = swings.filter(s => s.type === 'H').pop();
  const lastL = swings.filter(s => s.type === 'L').pop();
  if (!lastH || !lastL) return null;
  const diff = lastH.price - lastL.price;
  if (diff <= 0) return null;
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786];
  const retracements = ratios.map(r => +(lastH.price - diff * r).toFixed(2));
  const extensions = [1.272, 1.618, 2.618].map(r => +(lastL.price + diff * r).toFixed(2));
  let nearest = null, minDist = Infinity;
  for (const lvl of [...retracements, ...extensions]) {
    const d = Math.abs(currentPrice - lvl);
    if (d < minDist) { minDist = d; nearest = lvl; }
  }
  return {
    retracements, extensions,
    nearest: nearest ? +nearest.toFixed(2) : null,
    nearestDist: nearest ? +(minDist / currentPrice * 100).toFixed(2) : null
  };
}

// ═══ VOLUME ANALYSIS ═══

function calcOBV(closes, volumes) {
  if (closes.length < 10) return { trend: 'neutral', divergence: 'none' };
  let obv = 0;
  const obvArr = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvArr.push(obv);
  }
  const lb = Math.min(10, obvArr.length - 1);
  const obvStart = obvArr[obvArr.length - 1 - lb];
  const obvEnd = obvArr[obvArr.length - 1];
  const obvTrend = obvEnd > obvStart * 1.05 ? 'rising' : obvEnd < obvStart * 0.95 ? 'falling' : 'flat';
  const priceStart = closes[closes.length - 1 - lb];
  const priceEnd = closes[closes.length - 1];
  const priceUp = priceEnd > priceStart;
  const obvUp = obvTrend === 'rising';
  let divergence = 'none';
  if (priceUp && !obvUp) divergence = 'bearish_divergence';
  else if (!priceUp && obvUp) divergence = 'bullish_divergence';
  return { trend: obvTrend, divergence };
}

function calcADLine(highs, lows, closes, volumes) {
  if (closes.length < 10) return { trend: 'neutral' };
  let ad = 0, adPrev = 0;
  const startPrev = Math.max(0, closes.length - 11);
  for (let i = 0; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    if (range > 0) {
      const mfm = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
      ad += mfm * volumes[i];
      if (i >= startPrev && i < closes.length - 1) adPrev += mfm * volumes[i];
    }
  }
  return { trend: ad > adPrev * 1.05 ? 'accumulation' : ad < adPrev * 0.95 ? 'distribution' : 'neutral' };
}

function detectVolumeSpikes(volumes) {
  if (volumes.length < 21) return { hasSpike: false, ratio: 1 };
  const recent = volumes.slice(-21, -1);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const lastVol = volumes[volumes.length - 1];
  const ratio = avg > 0 ? +(lastVol / avg).toFixed(2) : 1;
  return { hasSpike: ratio > 2, ratio };
}

function volumeAnalysis(highs, lows, closes, volumes) {
  const obv = calcOBV(closes, volumes);
  const ad = calcADLine(highs, lows, closes, volumes);
  const spikes = detectVolumeSpikes(volumes);
  const mfi = calcMFI(highs, lows, closes, volumes);
  const cmf = calcCMF(highs, lows, closes, volumes);

  let smartMoney = 'neutral';
  let smConfidence = 0;

  if (obv.divergence === 'bullish_divergence') smConfidence += 2;
  else if (obv.divergence === 'bearish_divergence') smConfidence -= 2;

  if (ad.trend === 'accumulation') smConfidence += 1;
  else if (ad.trend === 'distribution') smConfidence -= 1;

  if (mfi.signal === 'oversold') smConfidence += 2;
  else if (mfi.signal === 'overbought') smConfidence -= 2;

  if (cmf.signal === 'accumulation') smConfidence += 2;
  else if (cmf.signal === 'distribution') smConfidence -= 2;

  if (spikes.hasSpike) {
    if (smConfidence > 0) smConfidence += 1;
    else if (smConfidence < 0) smConfidence -= 1;
  }

  if (smConfidence >= 4) smartMoney = 'strong_accumulation';
  else if (smConfidence >= 2) smartMoney = 'accumulation';
  else if (smConfidence <= -4) smartMoney = 'strong_distribution';
  else if (smConfidence <= -2) smartMoney = 'distribution';
  else if (spikes.hasSpike) smartMoney = 'high_activity';

  return {
    obv: obv.trend, obvDivergence: obv.divergence,
    adLine: ad.trend,
    volumeSpike: spikes.hasSpike, volumeRatio: spikes.ratio,
    mfi: mfi.value, mfiSignal: mfi.signal,
    cmf: cmf.value, cmfSignal: cmf.signal,
    smartMoney, smConfidence
  };
}

// ═══ PATTERN DETECTION ═══

function detectPatterns(swings) {
  if (swings.length < 4) return { structure: 'unknown', patterns: [] };
  const patterns = [];
  const recentHighs = swings.filter(s => s.type === 'H').slice(-4).map(s => s.price);
  const recentLows = swings.filter(s => s.type === 'L').slice(-4).map(s => s.price);
  let structure = 'unknown';
  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const hh = recentHighs[recentHighs.length - 1] > recentHighs[recentHighs.length - 2];
    const hl = recentLows[recentLows.length - 1] > recentLows[recentLows.length - 2];
    const lh = recentHighs[recentHighs.length - 1] < recentHighs[recentHighs.length - 2];
    const ll = recentLows[recentLows.length - 1] < recentLows[recentLows.length - 2];
    if (hh && hl) structure = 'uptrend (HH/HL)';
    else if (lh && ll) structure = 'downtrend (LH/LL)';
    else if (hh && ll) structure = 'expanding';
    else if (lh && hl) structure = 'contracting';
    else structure = 'ranging';
  }
  if (recentLows.length >= 2) {
    const l = recentLows.slice(-2);
    if (Math.abs(l[0] - l[1]) / l[0] < 0.02) patterns.push('Double Bottom');
  }
  if (recentHighs.length >= 2) {
    const h = recentHighs.slice(-2);
    if (Math.abs(h[0] - h[1]) / h[0] < 0.02) patterns.push('Double Top');
  }
  return { structure, patterns };
}

// ═══ LEGACY S/R + MERGE ═══

function calcLegacySR(H, L, C) {
  const raw = [];
  for (let i = 2; i < C.length - 2; i++) {
    if (H[i] > H[i-1] && H[i] > H[i-2] && H[i] > H[i+1] && H[i] > H[i+2]) raw.push({ price: H[i], type: 'R' });
    if (L[i] < L[i-1] && L[i] < L[i-2] && L[i] < L[i+1] && L[i] < L[i+2]) raw.push({ price: L[i], type: 'S' });
  }
  const used = new Set(), cl = [];
  for (let i = 0; i < raw.length; i++) {
    if (used.has(i)) continue;
    let sum = raw[i].price, cnt = 1;
    for (let j = i + 1; j < raw.length; j++)
      if (!used.has(j) && Math.abs(raw[j].price - raw[i].price) / raw[i].price < 0.02) {
        sum += raw[j].price; cnt++; used.add(j);
      }
    used.add(i);
    cl.push({ p: +(sum / cnt).toFixed(2), s: cnt });
  }
  cl.sort((a, b) => b.s - a.s);
  const price = C[C.length - 1];
  return {
    supports: cl.filter(x => x.p < price).sort((a, b) => b.p - a.p).slice(0, 3).map(x => x.p),
    resistances: cl.filter(x => x.p >= price).sort((a, b) => a.p - b.p).slice(0, 3).map(x => x.p)
  };
}

function mergeSR(legacy, fib, price) {
  const supports = [...(legacy?.supports || [])];
  const resistances = [...(legacy?.resistances || [])];
  if (fib) {
    for (const lvl of fib.retracements) {
      if (lvl < price && !supports.find(s => Math.abs(s - lvl) / price < 0.01)) supports.push(lvl);
      else if (lvl >= price && !resistances.find(r => Math.abs(r - lvl) / price < 0.01)) resistances.push(lvl);
    }
    for (const lvl of fib.extensions) {
      if (lvl >= price && !resistances.find(r => Math.abs(r - lvl) / price < 0.01)) resistances.push(lvl);
    }
  }
  supports.sort((a, b) => b - a);
  resistances.sort((a, b) => a - b);
  return { supports: supports.slice(0, 5), resistances: resistances.slice(0, 5) };
}

// ═══ RSI/MACD vs PRICE DIVERGENCE ═══

function calcRSIArray(closes, p) {
  p = p || 14;
  if (closes.length < p + 2) return [];
  const g = [], l = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g.push(d > 0 ? d : 0);
    l.push(d < 0 ? -d : 0);
  }
  let ag = g.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let al = l.slice(0, p).reduce((a, b) => a + b, 0) / p;
  const rsiArr = new Array(p + 1).fill(50);
  for (let i = p; i < g.length; i++) {
    ag = (ag * (p - 1) + g[i]) / p;
    al = (al * (p - 1) + l[i]) / p;
    rsiArr.push(al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2));
  }
  return rsiArr;
}

function calcDivergence(closes, rsiValues, macdHist, swings) {
  const result = { rsi: 'none', macd: 'none' };
  if (!swings || swings.length < 4 || closes.length < 20) return result;

  const highs = swings.filter(s => s.type === 'H').slice(-3);
  const lows  = swings.filter(s => s.type === 'L').slice(-3);

  // RSI divergence
  if (rsiValues && rsiValues.length >= closes.length) {
    if (highs.length >= 2) {
      const h1 = highs[highs.length - 2];
      const h2 = highs[highs.length - 1];
      if (h2.price > h1.price && rsiValues[h2.idx] < rsiValues[h1.idx]) {
        result.rsi = 'bearish';
      }
    }
    if (lows.length >= 2) {
      const l1 = lows[lows.length - 2];
      const l2 = lows[lows.length - 1];
      if (l2.price < l1.price && rsiValues[l2.idx] > rsiValues[l1.idx]) {
        result.rsi = 'bullish';
      }
    }
  }

  // MACD histogram divergence
  if (macdHist && macdHist.length >= closes.length) {
    if (highs.length >= 2) {
      const h1 = highs[highs.length - 2];
      const h2 = highs[highs.length - 1];
      if (h2.price > h1.price && macdHist[h2.idx] < macdHist[h1.idx]) {
        result.macd = 'bearish';
      }
    }
    if (lows.length >= 2) {
      const l1 = lows[lows.length - 2];
      const l2 = lows[lows.length - 1];
      if (l2.price < l1.price && macdHist[l2.idx] > macdHist[l1.idx]) {
        result.macd = 'bullish';
      }
    }
  }

  return result;
}

// ═══ VOLUME-WEIGHTED PRICE PROFILE (VVP) ═══

function calcVVP(closes, volumes, bins) {
  bins = bins || 20;
  if (closes.length < 20) return null;

  const validPairs = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] > 0 && volumes[i] > 0) {
      validPairs.push({ price: closes[i], vol: volumes[i] });
    }
  }
  if (validPairs.length < 10) return null;

  const prices = validPairs.map(p => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP;
  if (range <= 0) return null;

  const binSize = range / bins;
  const profile = new Array(bins).fill(0);
  const binCenters = [];

  for (let i = 0; i < bins; i++) {
    binCenters.push(+(minP + binSize * (i + 0.5)).toFixed(4));
  }

  for (const { price, vol } of validPairs) {
    const idx = Math.min(bins - 1, Math.floor((price - minP) / binSize));
    profile[idx] += vol;
  }

  // POC — highest volume bin
  let pocIdx = 0;
  for (let i = 1; i < bins; i++) {
    if (profile[i] > profile[pocIdx]) pocIdx = i;
  }

  // Value Area (70% of total volume around POC)
  const totalVol = profile.reduce((a, b) => a + b, 0);
  const vaTarget = totalVol * 0.70;
  let vaVol = profile[pocIdx];
  let vaHigh = pocIdx, vaLow = pocIdx;
  while (vaVol < vaTarget && (vaLow > 0 || vaHigh < bins - 1)) {
    const upVol = vaHigh < bins - 1 ? profile[vaHigh + 1] : 0;
    const dnVol = vaLow > 0 ? profile[vaLow - 1] : 0;
    if (upVol >= dnVol && vaHigh < bins - 1) { vaHigh++; vaVol += upVol; }
    else if (vaLow > 0) { vaLow--; vaVol += dnVol; }
    else if (vaHigh < bins - 1) { vaHigh++; vaVol += upVol; }
    else break;
  }

  const currentPrice = closes[closes.length - 1];
  const currentBin = Math.min(bins - 1, Math.floor((currentPrice - minP) / binSize));
  let pricePosition = 'inside_value';
  if (currentBin > vaHigh) pricePosition = 'above_value';
  else if (currentBin < vaLow) pricePosition = 'below_value';

  return {
    poc: binCenters[pocIdx],
    valueAreaHigh: binCenters[vaHigh],
    valueAreaLow: binCenters[vaLow],
    pricePosition,
    volumeAtPrice: profile[currentBin],
    pocVolume: profile[pocIdx]
  };
}

// ═══ REGIME FILTER ═══

function calcRegimeScore(taResults) {
  const anchor = taResults['4H'] || taResults['1H'];
  if (!anchor) return { regime: 'unknown', score: 0 };

  let score = 0;

  if (anchor.emaAlign === 'bullish') score += 2;
  else if (anchor.emaAlign === 'bearish') score -= 2;

  if (anchor.adx) {
    if (anchor.adx.signal === 'strong_uptrend') score += 2;
    else if (anchor.adx.signal === 'strong_downtrend') score -= 2;
    else if (anchor.adx.signal === 'weak_uptrend') score += 1;
    else if (anchor.adx.signal === 'weak_downtrend') score -= 1;
  }

  if (anchor.rsi?.value > 55) score += 1;
  else if (anchor.rsi?.value < 45) score -= 1;

  if (anchor.volume) {
    if (anchor.volume.smartMoney === 'strong_accumulation') score += 2;
    else if (anchor.volume.smartMoney === 'accumulation') score += 1;
    else if (anchor.volume.smartMoney === 'strong_distribution') score -= 2;
    else if (anchor.volume.smartMoney === 'distribution') score -= 1;
  }

  if (anchor.ichimoku) {
    if (anchor.ichimoku.cloud === 'above_cloud') score += 1;
    else if (anchor.ichimoku.cloud === 'below_cloud') score -= 1;
  }

  let regime = 'neutral';
  if (score >= 5) regime = 'strong_bullish';
  else if (score >= 2) regime = 'bullish';
  else if (score <= -5) regime = 'strong_bearish';
  else if (score <= -2) regime = 'bearish';

  return { regime, score };
}

// ═══ COMPUTE ONE TIMEFRAME ═══

function computeTF(ohlcv, tfId) {
  const { opens, highs, lows, closes, volumes: rawVolumes } = ohlcv;
  if (closes.length < 20) return null;
  const n = closes.length;

  // Zero-volume guard: replace trailing zero with short-term SMA fallback
  const volumes = rawVolumes.slice();
  if (volumes[n - 1] === 0 || volumes[n - 1] == null) {
    const lookback5 = volumes.slice(Math.max(0, n - 6), n - 1).filter(v => v > 0);
    if (lookback5.length > 0) {
      volumes[n - 1] = Math.round(lookback5.reduce((a, b) => a + b, 0) / lookback5.length);
    } else {
      const lookback20 = volumes.slice(Math.max(0, n - 21), n - 1).filter(v => v > 0);
      volumes[n - 1] = lookback20.length > 0
        ? Math.round(lookback20.reduce((a, b) => a + b, 0) / lookback20.length)
        : 1;
    }
  }

  let price = closes[n - 1];
  if (price == null || price <= 0) {
    for (let i = n - 2; i >= 0; i--) { if (closes[i] != null && closes[i] > 0) { price = closes[i]; break; } }
  }
  if (price == null || price <= 0) return null;

  // Core EMAs
  const e9 = calcEMA(closes, 9), e21 = calcEMA(closes, 21);
  const e50 = calcEMA(closes, Math.min(50, closes.length));
  const ema9 = +e9[n-1].toFixed(4), ema21 = +e21[n-1].toFixed(4), ema50 = +e50[n-1].toFixed(4);
  const align = ema9 > ema21 && ema21 > ema50 ? 'bullish'
              : ema9 < ema21 && ema21 < ema50 ? 'bearish' : 'mixed';

  const rsi = calcRSI(closes, 14);
  const rsiShort = calcRSIShort(closes);
  const macd = calcMACD(closes);
  const macdEgx = calcMACDEGX(closes);
  const atr = calcATR(highs, lows, closes, 14);
  const ichimoku = calcIchimoku(highs, lows, closes);
  const adx = calcADX(highs, lows, closes);
  const bollinger = calcBollinger(closes);
  const stochastic = calcStochastic(highs, lows, closes);

  // Zigzag + Elliott
  const zzThreshold = ZZ_THRESHOLDS[tfId] || 0.03;
  const swings = zigzag(highs, lows, zzThreshold);
  const elliott = detectElliott(swings);
  const waveTradingSignal = classifyWaveTradingSignal(elliott);
  const wave2VolContraction = checkWave2VolumeContraction(swings, volumes);
  const fib = calcFibonacci(swings, price);
  const legacySR = calcLegacySR(highs, lows, closes);
  const mergedSR = mergeSR(legacySR, fib, price);

  // Volume analysis
  const vol = volumeAnalysis(highs, lows, closes, volumes);

  // Pattern detection
  const pats = detectPatterns(swings);

  // RSI/MACD divergence
  const rsiArr = calcRSIArray(closes, 14);
  const macdHistArr = (function() {
    if (closes.length < 27) return [];
    const e12 = calcEMA(closes, 12), e26 = calcEMA(closes, 26);
    const ml = e12.map((v, i) => v - e26[i]);
    const sl = calcEMA(ml, 9);
    return ml.map((v, i) => v - sl[i]);
  })();
  const divergence = calcDivergence(closes, rsiArr, macdHistArr, swings);

  // VVP
  const vvp = calcVVP(closes, volumes, 20);

  // Structural Fibonacci Retracements
  const lastSwingHigh = swings.filter(s => s.type === 'H').pop();
  const lastSwingLow  = swings.filter(s => s.type === 'L').pop();

  let fibonacci = null;
  if (lastSwingHigh && lastSwingLow) {
    const waveRange = Math.abs(lastSwingHigh.price - lastSwingLow.price);
    const isUptrend = lastSwingHigh.idx > lastSwingLow.idx;
    const base = isUptrend ? lastSwingHigh.price : lastSwingLow.price;
    const dir  = isUptrend ? -1 : 1;

    fibonacci = {
      isUptrend,
      swingHigh: +lastSwingHigh.price.toFixed(4),
      swingLow:  +lastSwingLow.price.toFixed(4),
      waveRange: +waveRange.toFixed(4),
      f0236: +(base + dir * waveRange * 0.236).toFixed(4),
      f0382: +(base + dir * waveRange * 0.382).toFixed(4),
      f0500: +(base + dir * waveRange * 0.500).toFixed(4),
      f0618: +(base + dir * waveRange * 0.618).toFixed(4),
      f0786: +(base + dir * waveRange * 0.786).toFixed(4),
      ext1618: +(base - dir * waveRange * 0.618).toFixed(4),
      ext2618: +(base - dir * waveRange * 1.618).toFixed(4),
    };
  }

  // Turnover (Close × Volume in EGP)
  const latestTurnover = closes[n - 1] * volumes[n - 1];
  const toSlice = [];
  const lookback = Math.min(20, n);
  for (let i = n - lookback; i < n; i++) {
    if (closes[i] > 0 && volumes[i] > 0) toSlice.push(closes[i] * volumes[i]);
  }
  const avgTurnover = toSlice.length > 0 ? toSlice.reduce((a, b) => a + b, 0) / toSlice.length : 0;
  const turnover = {
    latest: +latestTurnover.toFixed(0),
    avg20: +avgTurnover.toFixed(0),
    ratio: avgTurnover > 0 ? +(latestTurnover / avgTurnover).toFixed(2) : 1
  };

  const waveTakeProfit = computeWaveTakeProfit(swings, price, elliott);

  return {
    ema9, ema21, ema50, emaAlign: align,
    rsi, rsiShort,
    macd, macdEgx,
    atr,
    ichimoku, adx, bollinger, stochastic,
    sr: mergedSR, elliott, fib,
    volume: vol, patterns: pats,
    divergence,
    vvp,
    fibonacci,
    turnover,
    waveTradingSignal,
    wave2VolContraction,
    waveTakeProfit,
  };
}

// ═══ CROSS-TF WAVE ALIGNMENT ═══

function waveAlignment(tfs) {
  const waves = {};
  for (const [tf, data] of Object.entries(tfs)) {
    if (data?.elliott) waves[tf] = data.elliott;
  }
  const entries = Object.entries(waves);
  if (entries.length < 2) return { aligned: false, signal: 'insufficient_data', detail: '' };
  const directions = entries.map(([_, w]) => w.direction);
  const allUp = directions.every(d => d === 'up');
  const allDown = directions.every(d => d === 'down');
  const higherTF = waves['1W'] || waves['1D'];
  const lowerTF = waves['4H'] || waves['1H'];
  let signal = 'neutral';
  let detail = entries.map(([tf, w]) => tf + ':' + w.label).join(' | ');
  if (allUp) {
    signal = higherTF && higherTF.phase === 'impulse' && higherTF.position === 3
           ? 'strong_bullish_alignment' : 'bullish_alignment';
  } else if (allDown) {
    signal = higherTF && higherTF.phase === 'impulse' && higherTF.position === 3
           ? 'strong_bearish_alignment' : 'bearish_alignment';
  } else if (higherTF && lowerTF) {
    if (higherTF.direction === 'up' && lowerTF.phase === 'corrective') signal = 'pullback_in_uptrend';
    else if (higherTF.direction === 'down' && lowerTF.phase === 'corrective') signal = 'bounce_in_downtrend';
    else signal = 'divergent';
  }

  // 3-of-3 nesting detection: Wave 3 on higher TF containing Wave 3 on lower TF
  let nesting3of3 = false;
  let nestingDepth = 0;
  let nestingDetail = '';
  const tfsWithWave3 = [];
  for (const [tf, w] of entries) {
    if (w.phase === 'impulse' && w.position === 3) tfsWithWave3.push(tf);
  }
  if (tfsWithWave3.length >= 2) {
    nesting3of3 = true;
    nestingDepth = tfsWithWave3.length;
    nestingDetail = tfsWithWave3.join('+') + ' Wave 3 nesting';
    if (allUp) signal = 'nested_bullish_wave3';
    else if (allDown) signal = 'nested_bearish_wave3';
  }

  return { aligned: allUp || allDown, signal, detail, nesting3of3, nestingDepth, nestingDetail };
}

// ═══ ENHANCED MTF CONFLUENCE ═══

function confluence(tfs, waveAlign) {
  let bull = 0, bear = 0, total = 0;
  for (const [tf, data] of Object.entries(tfs)) {
    if (!data) continue;
    const w = TF_WEIGHTS[tf] || 1;
    total += w;

    // EMA alignment (10%)
    if (data.emaAlign === 'bullish') bull += w * 0.10;
    else if (data.emaAlign === 'bearish') bear += w * 0.10;

    // RSI-14 trend (8%)
    if (data.rsi?.value > 55) bull += w * 0.08;
    else if (data.rsi?.value < 45) bear += w * 0.08;

    // RSI-3 extreme signals (3%)
    if (data.rsiShort?.signal === 'oversold') bull += w * 0.03;
    else if (data.rsiShort?.signal === 'overbought') bear += w * 0.03;

    // MACD EGX (10%)
    if (data.macdEgx) {
      if (data.macdEgx.histogram > 0 && data.macdEgx.histSlope > 0) bull += w * 0.06;
      else if (data.macdEgx.histogram < 0 && data.macdEgx.histSlope < 0) bear += w * 0.06;
      if (data.macdEgx.crossover === 'bullish') bull += w * 0.04;
      else if (data.macdEgx.crossover === 'bearish') bear += w * 0.04;
    }

    // Ichimoku (7%)
    if (data.ichimoku) {
      if (data.ichimoku.cloud === 'above_cloud') bull += w * 0.05;
      else if (data.ichimoku.cloud === 'below_cloud') bear += w * 0.05;
      if (data.ichimoku.tkCross === 'bullish') bull += w * 0.02;
      else if (data.ichimoku.tkCross === 'bearish') bear += w * 0.02;
    }

    // ADX + DMI (7%)
    if (data.adx) {
      if (data.adx.signal === 'strong_uptrend') bull += w * 0.07;
      else if (data.adx.signal === 'strong_downtrend') bear += w * 0.07;
      else if (data.adx.signal === 'weak_uptrend') bull += w * 0.03;
      else if (data.adx.signal === 'weak_downtrend') bear += w * 0.03;
    }

    // Bollinger (5%)
    if (data.bollinger) {
      if (data.bollinger.signal === 'below_lower') bull += w * 0.05;
      else if (data.bollinger.signal === 'above_upper') bear += w * 0.05;
    }

    // Stochastic (5%)
    if (data.stochastic) {
      if (data.stochastic.signal === 'oversold') bull += w * 0.03;
      else if (data.stochastic.signal === 'overbought') bear += w * 0.03;
      if (data.stochastic.crossover === 'bullish') bull += w * 0.02;
      else if (data.stochastic.crossover === 'bearish') bear += w * 0.02;
    }

    // Elliott Wave (10%)
    if (data.elliott) {
      const ew = data.elliott;
      if (ew.phase === 'impulse') {
        if (ew.direction === 'up') {
          if (ew.position === 3) bull += w * 0.10;
          else if (ew.position === 1 || ew.position === 5) bull += w * 0.06;
          else bull += w * 0.03;
        } else {
          if (ew.position === 3) bear += w * 0.10;
          else if (ew.position === 1 || ew.position === 5) bear += w * 0.06;
          else bear += w * 0.03;
        }
      } else if (ew.phase === 'corrective') {
        if (ew.direction === 'up') bear += w * 0.05;
        else bull += w * 0.05;
      }
    }

    // Smart Money / Volume (10%)
    if (data.volume) {
      if (data.volume.smartMoney === 'strong_accumulation') bull += w * 0.10;
      else if (data.volume.smartMoney === 'accumulation') bull += w * 0.06;
      else if (data.volume.smartMoney === 'strong_distribution') bear += w * 0.10;
      else if (data.volume.smartMoney === 'distribution') bear += w * 0.06;
    }

    // Patterns (5%)
    if (data.patterns?.structure) {
      if (data.patterns.structure.includes('uptrend')) bull += w * 0.05;
      else if (data.patterns.structure.includes('downtrend')) bear += w * 0.05;
      if (data.patterns.patterns?.includes('Double Bottom')) bull += w * 0.03;
      if (data.patterns.patterns?.includes('Double Top')) bear += w * 0.03;
    }

    // Divergence detection (8%)
    if (data.divergence) {
      if (data.divergence.rsi === 'bullish') bull += w * 0.05;
      else if (data.divergence.rsi === 'bearish') bear += w * 0.05;
      if (data.divergence.macd === 'bullish') bull += w * 0.03;
      else if (data.divergence.macd === 'bearish') bear += w * 0.03;
    }

    // VVP position (5%)
    if (data.vvp) {
      if (data.vvp.pricePosition === 'below_value') bull += w * 0.05;
      else if (data.vvp.pricePosition === 'above_value') bear += w * 0.05;
    }
  }

  // Cross-TF wave alignment bonus (10%)
  if (waveAlign && total > 0) {
    const alignW = total * 0.10;
    if (waveAlign.signal.includes('bullish')) bull += alignW;
    else if (waveAlign.signal.includes('bearish')) bear += alignW;
    if (waveAlign.signal.includes('strong_')) {
      if (waveAlign.signal.includes('bullish')) bull += alignW * 0.5;
      else bear += alignW * 0.5;
    }
  }

  // 3-of-3 nesting bonus (additional 15%)
  if (waveAlign?.nesting3of3 && total > 0) {
    const nestW = total * 0.15;
    if (waveAlign.signal.includes('bullish') || waveAlign.signal.includes('nested_bullish')) bull += nestW;
    else if (waveAlign.signal.includes('bearish') || waveAlign.signal.includes('nested_bearish')) bear += nestW;
  }

  if (total === 0) return { score: 0, bias: 'neutral', strength: 'NONE' };
  const net = +((bull - bear) / total * 100).toFixed(1);
  return {
    score: net,
    bias: net > 15 ? 'bullish' : net < -15 ? 'bearish' : 'neutral',
    strength: Math.abs(net) > 50 ? 'STRONG' : Math.abs(net) > 25 ? 'MODERATE' : 'WEAK'
  };
}

// ═══ MAIN ═══
const allItems = $input.all();
const processed = [];
let macroBaseline = null;

// Phase 1: Compute TA for all stocks (including EGX30 index)
for (const item of allItems) {
  const d = item.json;
  if (d._fetchLog) { processed.push({ data: d, isLog: true }); continue; }
  if (d.error && Object.keys(d.mtf || {}).length === 0) { processed.push({ data: d, isLog: false }); continue; }
  const taResults = {};
  for (const tf of TF_HIERARCHY) {
    if (d.mtf?.[tf]) {
      const ta = computeTF(d.mtf[tf], tf);
      if (ta) taResults[tf] = ta;
    }
  }
  const waveAlign = waveAlignment(taResults);
  const conf = confluence(taResults, waveAlign);
  const regimeFilter = calcRegimeScore(taResults);
  const result = {
    stock: d.stock, fullName: d.fullName, runDate: d.runDate,
    currentPrice: d.currentPrice, error: d.error,
    isIndex: d.isIndex || false,
    ta: taResults, confluence: conf,
    waveAlignment: waveAlign,
    availableTFs: Object.keys(taResults),
    regime: regimeFilter,
  };
  processed.push({ data: result, isLog: false });

  // Capture EGX30 macro baseline
  if (d.isIndex && d.stock === '^CASE30') {
    const anchor = taResults['1D'] || taResults['4H'] || taResults['1H'];
    macroBaseline = {
      regime: regimeFilter.regime,
      score: regimeFilter.score,
      trend: anchor?.emaAlign || 'unknown',
      price: d.currentPrice,
    };
  }
}

// Phase 2: Attach macroBaseline to all non-index stocks
const results = [];
for (const p of processed) {
  if (p.isLog) {
    results.push({ json: p.data });
  } else {
    if (!p.data.isIndex && macroBaseline) {
      p.data.macroBaseline = macroBaseline;
    }
    results.push({ json: p.data });
  }
}
return results;
`;

// ──────────────────────────────────────────────────────────────────
// NODE GENERATOR
// ──────────────────────────────────────────────────────────────────

/**
 * Build the TA Engine node and its connection from the previous node.
 *
 * @param {object} opts
 * @param {string} opts.previousNodeName - Name of the upstream node (Fetch Yahoo OHLCV)
 * @param {number[]} opts.startPosition  - [x, y] for the node
 * @returns {{ nodes: object[], connections: object, lastNodeName: string }}
 */
function buildTAEngineNode(opts) {
  const sx = opts?.startX ?? 7912;
  const sy = opts?.startY ?? -1424;
  const prevNode = opts?.prevNodeName || 'Fetch Yahoo OHLCV';

  const taNode = createCodeNode(
    'TA Engine',
    TA_ENGINE_CODE,
    [sx, sy]
  );

  const connections = {
    [prevNode]: {
      main: [[{ node: taNode.name, type: 'main', index: 0 }]],
    },
  };

  return {
    nodes: [taNode],
    connections,
    lastNodeName: taNode.name,
  };
}

module.exports = { buildTAEngineNode };
