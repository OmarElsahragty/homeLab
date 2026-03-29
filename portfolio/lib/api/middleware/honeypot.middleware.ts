import { HONEYPOT_FIELD } from '../api.constants';
import type { Middleware } from '../api.types';
import { ApiResponse } from '../api.utils';

export function honeypot(field: string = HONEYPOT_FIELD): Middleware {
  return async (_req, ctx) => {
    if (ctx.body[field]) {
      // Silently succeed to not tip off bots
      return ApiResponse.success();
    }
  };
}
