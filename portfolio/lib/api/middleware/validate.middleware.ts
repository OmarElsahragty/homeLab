import type { z } from 'zod';
import { ParseError, ValidationError } from '../errors/api.errors';
import type { Middleware } from '../api.types';

function formatZodErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0]?.toString() ?? 'unknown';
    if (!fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

export function validate(schema: z.ZodType): Middleware {
  return async (req, ctx) => {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ParseError();
    }

    const result = schema.safeParse(rawBody);
    if (!result.success) {
      throw new ValidationError(formatZodErrors(result.error));
    }

    ctx.body = result.data as Record<string, unknown>;
  };
}
