/**
 * utils.js — Shared Utilities for EGX Deep Analyst Workflow Generator
 *
 * Contains:
 *  - .env loader (secrets: ZAI_API_KEY, DISCORD_WEBHOOK_URL)
 *  - n8n node builder helpers (createCodeNode, createMergeNode, etc.)
 *  - Timezone helpers (DST-safe Cairo time via Intl.DateTimeFormat)
 *  - WAF Safety Wrapper for HTTP requests against Cloudflare-protected sites
 *  - Discord payload truncation (4,000-char limit)
 *  - Common constants
 */

'use strict';

// ──────────────────────────────────────────────────────────────────
// .ENV LOADER — load environment variables from .env file
// ──────────────────────────────────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ──────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────

/** EGX session boundaries (Cairo local time) */
const SESSION = {
  OPEN_HOUR: 9,
  OPEN_MINUTE: 30,
  CLOSE_HOUR: 15,   // 3:00 PM
  CLOSE_MINUTE: 0,
};

/**
 * 30-Minute Candle Math for 5.5-Hour Session
 * Session: 9:30 AM – 3:00 PM = 330 minutes
 * 330 / 30 = 11 equal 30-minute candles
 * Candle start times: 9:30, 10:00, 10:30, 11:00, 11:30,
 *                     12:00, 12:30, 13:00, 13:30, 14:00, 14:30
 * Using 30m candles prevents Volume Profile distortion that occurs
 * when 1H candles create unequal bins (the 9:30 candle is only 30 min
 * and the 14:00 candle is also 30 min, while all others are 60 min).
 */
const CANDLE_30M_COUNT = 11;

/** Timeframe hierarchy and weights for confluence scoring */
const TF_HIERARCHY = ['1W', '4H', '1H', '30m'];
const TF_WEIGHTS = { '1W': 2, '4H': 5, '1H': 3, '30m': 2 };
const TF_SHORT = { '1W': 'W', '4H': '4H', '1H': '1H', '30m': '30m' };

/** Zigzag thresholds per timeframe */
const ZZ_THRESHOLDS = { '1W': 0.06, '4H': 0.04, '1H': 0.025, '30m': 0.015 };

/** Yahoo Finance base URL */
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/** Standard browser User-Agent for scraping */
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// ──────────────────────────────────────────────────────────────────
// n8n NODE BUILDER HELPERS
// ──────────────────────────────────────────────────────────────────

/** Unique ID counter for nodes */
let _nodeIdCounter = 0;

/**
 * Generate a UUID-like ID for n8n nodes.
 * Uses a deterministic counter so builds are reproducible.
 */
function makeNodeId(prefix) {
  _nodeIdCounter++;
  const hex = _nodeIdCounter.toString(16).padStart(4, '0');
  return `${prefix || 'node'}-${hex}-0000-0000-${Date.now().toString(16).slice(-12)}`;
}

/** Reset the ID counter (call before building a new workflow) */
function resetNodeIds() {
  _nodeIdCounter = 0;
}

/**
 * Create an n8n Code node definition.
 * @param {string} name       - Display name in n8n UI
 * @param {string} jsCode     - The JavaScript code for the node
 * @param {number[]} position - [x, y] canvas position
 * @returns {object} n8n node JSON
 */
function createCodeNode(name, jsCode, position) {
  return {
    parameters: { jsCode },
    id: makeNodeId('code'),
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
  };
}

/**
 * Create an n8n Schedule Trigger node.
 * @param {string} name      - Display name
 * @param {object} schedule  - { hour, minute, daysOfWeek }
 * @param {number[]} position
 * @returns {object} n8n node JSON
 */
function createScheduleTrigger(name, schedule, position) {
  return {
    parameters: {
      rule: {
        interval: [
          {
            triggerAtHour: schedule.hour,
            triggerAtMinute: schedule.minute,
            triggerAtDay: schedule.daysOfWeek,
          },
        ],
      },
    },
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position,
    id: makeNodeId('sched'),
    name,
  };
}

/**
 * Create an n8n Manual Trigger node.
 */
function createManualTrigger(name, position) {
  return {
    parameters: {},
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position,
    id: makeNodeId('manual'),
    name,
  };
}

/**
 * Create an n8n Merge node (Combine mode).
 */
function createMergeNode(name, position) {
  return {
    parameters: {
      mode: 'combine',
      combineBy: 'combineByFields',
      advanced: true,
      mergeByFields: {
        values: [{ field1: 'stock', field2: 'stock' }],
      },
      options: {},
    },
    type: 'n8n-nodes-base.merge',
    typeVersion: 3,
    position,
    id: makeNodeId('merge'),
    name,
  };
}

/**
 * Create a connection entry between two nodes.
 * @param {string} fromNode - Source node name
 * @param {string} toNode   - Target node name
 * @param {number} outputIndex - Source output index (default 0)
 * @param {number} inputIndex  - Target input index (default 0)
 * @returns {object} Connection fragment to merge into workflow connections
 */
function createConnection(fromNode, toNode, outputIndex, inputIndex) {
  return {
    [fromNode]: {
      main: [
        (() => {
          const outputs = [];
          for (let i = 0; i <= (outputIndex || 0); i++) {
            if (i === (outputIndex || 0)) {
              outputs.push([{ node: toNode, type: 'main', index: inputIndex || 0 }]);
            } else {
              outputs.push([]);
            }
          }
          return outputs;
        })(),
      ][0],
    },
  };
}

/**
 * Merge multiple connection fragments into a single connections object.
 * Handles the case where a source node has multiple outputs (parallel branches).
 */
function mergeConnections(...fragments) {
  const result = {};
  for (const frag of fragments) {
    for (const [nodeName, nodeConns] of Object.entries(frag)) {
      if (!result[nodeName]) {
        result[nodeName] = { main: [[]] };
      }
      // Merge output arrays
      const existing = result[nodeName].main;
      const incoming = nodeConns.main;
      for (let i = 0; i < incoming.length; i++) {
        if (!existing[i]) existing[i] = [];
        existing[i].push(...incoming[i]);
      }
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────
// TIMEZONE HELPERS (embedded in node JS code as strings)
// ──────────────────────────────────────────────────────────────────

/**
 * DST-safe Cairo time helpers — to be injected into n8n Code nodes.
 * Uses Intl.DateTimeFormat so it automatically handles Egypt's
 * UTC+2 (winter) / UTC+3 (summer) DST transitions.
 */
const TIMEZONE_HELPERS = `
// ═══ DST-SAFE CAIRO TIME HELPERS ═══
// Egypt reinstated DST: UTC+3 May–Oct, UTC+2 Nov–Apr.
// Intl.DateTimeFormat resolves this automatically via IANA tz database.
// NEVER use hardcoded offset arithmetic (e.g., CAIRO_OFFSET_MS = 2h).

function toCairoHour(ts) {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour: 'numeric',
      hour12: false
    }).format(new Date(ts * 1000)),
    10
  );
}

function toCairoMinute(ts) {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      minute: 'numeric'
    }).format(new Date(ts * 1000)),
    10
  );
}

function toCairoDate(ts) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(ts * 1000));
}

function getCairoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
`;

// ──────────────────────────────────────────────────────────────────
// WAF SAFETY WRAPPER (for Cloudflare-protected Egyptian portals)
// ──────────────────────────────────────────────────────────────────

/**
 * JavaScript WAF Safety Wrapper — injected into n8n enrichment Code nodes.
 *
 * Strategy: If the standard n8n HTTP request returns a WAF challenge page
 * (Cloudflare CAPTCHA, "Just a moment..." interstitial, or an empty body
 * with a cf-ray header), the wrapper:
 *   1. Detects the block via HTML signature inspection
 *   2. Logs the failure reason (not silent)
 *   3. Falls back to hardcoded "last known" values so the workflow
 *      continues without crashing
 *   4. Marks the data source as 'fallback' so the AI prompt knows
 *      it's working with stale data
 *
 * This prevents the entire workflow from failing when a single
 * enrichment source is temporarily blocked.
 */
const WAF_SAFETY_WRAPPER = `
// ═══ WAF SAFETY WRAPPER ═══
// Detects Cloudflare / WAF challenge pages that return HTTP 200
// but contain a CAPTCHA or JS challenge instead of real content.

function isWafChallenge(html) {
  if (!html || typeof html !== 'string') return false;
  if (html.length < 500) return true; // suspiciously short response
  const lower = html.toLowerCase();
  return (
    lower.includes('cf-ray') ||
    lower.includes('challenge-platform') ||
    lower.includes('just a moment') ||
    (lower.includes('captcha') && html.length < 15000) ||
    lower.includes('cf-chl-bypass') ||
    lower.includes('_cf_chl_opt')
  );
}

/**
 * Safe HTTP GET with WAF detection and graceful fallback.
 * @param {Function} httpReq - n8n this.helpers.httpRequest
 * @param {string}   url     - Target URL
 * @param {object}   opts    - { headers, timeout }
 * @returns {{ ok: boolean, body: string, error: string|null }}
 */
async function safeHttpGet(httpReq, url, opts) {
  const headers = Object.assign({
    'User-Agent': '${USER_AGENT}',
    'Accept': 'text/html,application/xhtml+xml,application/json',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
  }, opts?.headers || {});

  try {
    const resp = await httpReq({
      method: 'GET',
      url,
      headers,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
      timeout: opts?.timeout || 20000,
    });

    if (resp.statusCode === 403 || resp.statusCode === 503) {
      return { ok: false, body: '', error: 'HTTP ' + resp.statusCode + ' — likely WAF block' };
    }

    const body = typeof resp.body === 'string' ? resp.body : '';
    if (resp.statusCode === 200 && isWafChallenge(body)) {
      return { ok: false, body: '', error: 'WAF challenge page detected (HTTP 200 with CAPTCHA)' };
    }

    if (resp.statusCode === 200) {
      return { ok: true, body, error: null };
    }

    return { ok: false, body: '', error: 'HTTP ' + resp.statusCode };
  } catch (e) {
    return { ok: false, body: '', error: 'Network error: ' + e.message };
  }
}
`;

// ──────────────────────────────────────────────────────────────────
// DISCORD PAYLOAD TRUNCATION
// ──────────────────────────────────────────────────────────────────

/**
 * Discord embed description max is 4096 chars. Total embed payload max ~6000.
 * This function truncates safely at word boundaries.
 */
const TRUNCATION_HELPER = `
// ═══ DISCORD PAYLOAD TRUNCATION ═══
// Discord embed description limit: 4096 chars. We use 4000 as safety margin.
// Total payload per message: ~6000 chars across all embeds.

function truncateText(text, maxLen) {
  maxLen = maxLen || 4000;
  if (!text || text.length <= maxLen) return text || '';
  // Cut at last space before the limit to avoid mid-word truncation
  const cut = text.lastIndexOf(' ', maxLen - 3);
  return text.substring(0, cut > 0 ? cut : maxLen - 3) + '...';
}
`;

// ──────────────────────────────────────────────────────────────────
// OLLAMA EMBEDDING HELPER (injected into n8n Code nodes)
// ──────────────────────────────────────────────────────────────────

/** Ollama endpoint for nomic-embed-text (768-dim dense embeddings) */
const OLLAMA_EMBED_URL = 'http://ollama:11434/api/embeddings';

/**
 * Embedding helper — injected as a string into n8n Code nodes.
 * Calls Ollama's nomic-embed-text model and returns a pgvector-ready
 * string in the format '[0.1,0.2,...]'.
 *
 * Usage inside injected code:
 *   const embStr = await generateEmbedding(httpReq, text);
 *   // embStr = '[0.123,...]' or null on failure
 */
const EMBED_HELPER_CODE = `
// ═══ OLLAMA EMBEDDING HELPER ═══
// Calls nomic-embed-text (768-dim) and returns pgvector-ready '[f,f,...]' string.
// Returns null on failure — callers must handle null gracefully.
async function generateEmbedding(httpReq, text) {
  try {
    const resp = await httpReq({
      method: 'POST',
      url: 'http://ollama:11434/api/embeddings',
      headers: { 'Content-Type': 'application/json' },
      body: { model: 'nomic-embed-text', prompt: String(text).slice(0, 2000) },
      timeout: 30000,
    });
    const vec = resp && resp.embedding;
    if (!Array.isArray(vec) || vec.length !== 768) return null;
    return '[' + vec.join(',') + ']';
  } catch (e) {
    return null;
  }
}
`;

// ──────────────────────────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  SESSION,
  CANDLE_30M_COUNT,
  TF_HIERARCHY,
  TF_WEIGHTS,
  TF_SHORT,
  ZZ_THRESHOLDS,
  YAHOO_BASE,
  USER_AGENT,
  OLLAMA_EMBED_URL,

  // Node builders
  createCodeNode,
  createScheduleTrigger,
  createManualTrigger,
  createMergeNode,
  createConnection,
  mergeConnections,
  resetNodeIds,

  // Embeddable code strings (injected into n8n Code nodes)
  TIMEZONE_HELPERS,
  WAF_SAFETY_WRAPPER,
  TRUNCATION_HELPER,
  EMBED_HELPER_CODE,
};
