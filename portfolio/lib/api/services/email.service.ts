import { readFileSync } from 'fs';
import { join } from 'path';
import { Resend } from 'resend';
import { EMAIL } from '../api.constants';
import { escapeHtml } from '../api.utils';
import type { ContactPayload } from '../schemas/contact.schema';

const contactHtml = readFileSync(
  join(process.cwd(), 'lib/api/templates/contact.template.html'),
  'utf-8'
);

let resend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resend) resend = new Resend(apiKey);
  return resend;
}

type EmailResult = { ok: true } | { ok: false; error: string };

export const emailService = {
  async sendContactEmail(payload: ContactPayload): Promise<EmailResult> {
    const client = getResend();
    if (!client) {
      console.error('RESEND_API_KEY is not configured');
      return { ok: false, error: 'Email service not configured' };
    }

    const { name, email, message } = payload;

    const html = contactHtml
      .replaceAll('{{NAME}}', escapeHtml(name))
      .replaceAll('{{EMAIL}}', escapeHtml(email))
      .replaceAll('{{MESSAGE}}', escapeHtml(message));

    const { error } = await client.emails.send({
      from: EMAIL.FROM,
      to: [EMAIL.TO],
      replyTo: email,
      subject: `Portfolio Contact from ${name}`,
      html,
    });

    if (error) {
      return { ok: false, error: 'Failed to send email' };
    }

    return { ok: true };
  },
};
