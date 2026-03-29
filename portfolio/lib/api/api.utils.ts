import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// ─── Response Helpers ───────────────────────────────────────────

export const ApiResponse = {
  success: (data?: Record<string, unknown>) =>
    NextResponse.json({ success: true, ...(data && { data }) }),

  error: (message: string, status: number, fields?: Record<string, string>) =>
    NextResponse.json({ error: message, ...(fields && { fields }) }, { status }),
};

// ─── Request Helpers ────────────────────────────────────────────

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'unknown';
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
