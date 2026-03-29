// ─── Rate Limiting ───────────────────────────────────────────────
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 3,
  CLEANUP_INTERVAL_MS: 60 * 1000, // cleanup stale entries every 60s
} as const;

// ─── Validation Limits ──────────────────────────────────────────
export const VALIDATION = {
  NAME_MAX: 100,
  EMAIL_MAX: 254,
  MESSAGE_MIN: 10,
  MESSAGE_MAX: 5000,
} as const;

// ─── Email ──────────────────────────────────────────────────────
export const EMAIL = {
  FROM: 'Portfolio Contact <contact@sahragty.me>',
  TO: 'omar@sahragty.me',
} as const;

// ─── Honeypot ───────────────────────────────────────────────────
export const HONEYPOT_FIELD = '_honey';
