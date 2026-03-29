import { createHandler } from '@/lib/api/middleware/pipeline.middleware';
import { honeypot } from '@/lib/api/middleware/honeypot.middleware';
import { rateLimit } from '@/lib/api/middleware/rate-limit.middleware';
import { validate } from '@/lib/api/middleware/validate.middleware';
import { contactSchema } from '@/lib/api/schemas/contact.schema';
import type { ContactPayload } from '@/lib/api/schemas/contact.schema';
import { emailService } from '@/lib/api/services/email.service';
import { ApiResponse } from '@/lib/api/api.utils';

export const POST = createHandler(
  rateLimit(),
  validate(contactSchema),
  honeypot(),
  async (_req, ctx) => {
    const result = await emailService.sendContactEmail(ctx.body as ContactPayload);
    if (!result.ok) return ApiResponse.error(result.error, 500);
    return ApiResponse.success();
  }
);
