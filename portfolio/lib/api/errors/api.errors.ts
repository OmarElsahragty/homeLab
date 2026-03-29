import { NextResponse } from 'next/server';

// ─── Base Error ──────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields?: Record<string, string>,
    public readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Specific Errors ─────────────────────────────────────────────

export class ValidationError extends ApiError {
  constructor(fields: Record<string, string>) {
    super('Validation failed', 400, fields);
    this.name = 'ValidationError';
  }
}

export class ParseError extends ApiError {
  constructor() {
    super('Invalid JSON body', 400);
    this.name = 'ParseError';
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfterSeconds: number) {
    super('Too many requests. Please try again later.', 429, undefined, {
      'Retry-After': String(retryAfterSeconds),
    });
    this.name = 'RateLimitError';
  }
}

// ─── Generic Error Handler ───────────────────────────────────────

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, ...(err.fields && { fields: err.fields }) },
      { status: err.status, headers: err.headers }
    );
  }

  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
