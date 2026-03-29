import { z } from 'zod';
import { VALIDATION } from '../api.constants';

function sanitize(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

export const contactSchema = z
  .object({
    name: z
      .string()
      .transform(sanitize)
      .pipe(
        z
          .string()
          .min(1, 'Name is required')
          .max(VALIDATION.NAME_MAX, `Name must be ${VALIDATION.NAME_MAX} characters or fewer`)
      ),
    email: z
      .string()
      .transform(sanitize)
      .pipe(
        z.string().email('Invalid email address').max(VALIDATION.EMAIL_MAX, 'Email is too long')
      ),
    message: z
      .string()
      .transform(sanitize)
      .pipe(
        z
          .string()
          .min(
            VALIDATION.MESSAGE_MIN,
            `Message must be at least ${VALIDATION.MESSAGE_MIN} characters`
          )
          .max(
            VALIDATION.MESSAGE_MAX,
            `Message must be ${VALIDATION.MESSAGE_MAX} characters or fewer`
          )
      ),
    _honey: z.string().max(0, 'Bot detected').optional(),
  })
  .strict();

export type ContactPayload = z.infer<typeof contactSchema>;
