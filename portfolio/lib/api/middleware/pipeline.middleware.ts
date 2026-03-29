import { handleApiError } from '../errors/api.errors';
import type { ApiContext, Middleware } from '../api.types';
import { ApiResponse, getClientIp } from '../api.utils';

/**
 * Compose middlewares into a single Next.js route handler.
 * Each middleware can short-circuit by returning a Response.
 * The last step (the handler) must always return a Response.
 */
export function createHandler(...steps: Middleware[]) {
  return async (request: Request): Promise<Response> => {
    const ctx: ApiContext = { ip: await getClientIp(), body: {} };

    try {
      for (const step of steps) {
        const result = await step(request, ctx);
        if (result) return result;
      }
      return ApiResponse.error('No response generated', 500);
    } catch (err) {
      return handleApiError(err);
    }
  };
}
