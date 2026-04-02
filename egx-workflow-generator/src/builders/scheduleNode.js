/**
 * scheduleNode.js — Schedule Trigger + Holiday Gate Node Generators
 *
 * Produces n8n node definitions for:
 *   1. Schedule Trigger — EGX session-aware cron (14:30 Cairo, Sun–Thu)
 *   2. Holiday Gate — Skips Eid, national holidays, and weekends
 *   3. Manual Trigger — Alternative for on-demand runs
 *
 * @module scheduleNode
 */

'use strict';

const {
  createCodeNode,
  createScheduleTrigger,
  createManualTrigger,
  TIMEZONE_HELPERS,
} = require('../lib/utils');

// ──────────────────────────────────────────────────────────────────
// HOLIDAY GATE CODE — injected into an n8n Code node
// ──────────────────────────────────────────────────────────────────

const HOLIDAY_GATE_CODE = `
${TIMEZONE_HELPERS}

// EGX known closures for 2026 (update annually)
// Format: YYYY-MM-DD
const HOLIDAYS_2026 = [
  // Eid Al-Fitr 2026
  '2026-03-19', '2026-03-22', '2026-03-23',
  // Sinai Liberation Day
  '2026-04-25',
  // Labour Day
  '2026-05-01',
  // Eid Al-Adha 2026 (estimated — update when confirmed)
  '2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09',
  // Revolution Day
  '2026-07-23',
  // Islamic New Year (estimated)
  '2026-06-27',
  // Prophet's Birthday (estimated)
  '2026-09-05',
  // Armed Forces Day
  '2026-10-06',
];

const today = getCairoDate();
const isHoliday = HOLIDAYS_2026.includes(today);

// DST-safe: resolve weekday name from Cairo timezone
const cairoWeekday = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Cairo',
  weekday: 'long'
}).format(new Date());
const isWeekend = cairoWeekday === 'Friday' || cairoWeekday === 'Saturday';

// Manual executions always run — useful for testing and on-demand analysis
const isManual = $execution.mode === 'manual';

// Compute days to next holiday (for pre-holiday risk flagging)
let daysToNextHoliday = null;
let nextHolidayDate = null;
try {
  const todayDate = new Date(today);
  let minDays = Infinity;
  for (const h of HOLIDAYS_2026) {
    const hDate = new Date(h);
    const diff = Math.ceil((hDate - todayDate) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff < minDays) {
      minDays = diff;
      nextHolidayDate = h;
    }
  }
  if (minDays < Infinity) daysToNextHoliday = minDays;
} catch (e) { /* ignore */ }

if (!isManual && (isHoliday || isWeekend)) {
  return [{ json: { _skip: true, reason: isHoliday ? 'EGX holiday: ' + today : 'Weekend' } }];
}

return [{ json: { _skip: false, date: today, manualOverride: isManual && (isHoliday || isWeekend), daysToNextHoliday, nextHolidayDate } }];
`;

// ──────────────────────────────────────────────────────────────────
// NODE GENERATOR
// ──────────────────────────────────────────────────────────────────

/**
 * Build the scheduling + holiday gate nodes and their connections.
 *
 * @param {object} opts
 * @param {number[]} opts.startPosition - [x, y] for the first node
 * @returns {{ nodes: object[], connections: object }}
 */
function buildScheduleNodes(opts) {
  const [sx, sy] = opts?.startPosition || [6512, -1424];
  const GAP = 300; // horizontal spacing between nodes

  const nodes = [];

  // 1. Schedule Trigger — 14:30 Cairo, Sun–Thu (days 0-4 in n8n)
  const scheduleTrigger = createScheduleTrigger(
    'EGX Session Schedule',
    { hour: 14, minute: 30, daysOfWeek: [0, 1, 2, 3, 4] },
    [sx, sy]
  );
  nodes.push(scheduleTrigger);

  // 2. Manual Trigger — alternative for ad-hoc runs
  const manualTrigger = createManualTrigger(
    'Manual Trigger',
    [sx, sy + 200]
  );
  nodes.push(manualTrigger);

  // 3. Holiday Gate — Code node that emits _skip flag
  const holidayGate = createCodeNode(
    'Holiday Gate',
    HOLIDAY_GATE_CODE,
    [sx + GAP, sy]
  );
  nodes.push(holidayGate);

  // Connections: both triggers feed into the Holiday Gate
  const connections = {
    [scheduleTrigger.name]: {
      main: [[{ node: holidayGate.name, type: 'main', index: 0 }]],
    },
    [manualTrigger.name]: {
      main: [[{ node: holidayGate.name, type: 'main', index: 0 }]],
    },
  };

  return { nodes, connections };
}

module.exports = { buildScheduleNodes };
