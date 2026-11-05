import 'server-only';

import { sendEmail } from '@/lib/email';
import { publicEnv } from '@/lib/env';
import { escapeHtml } from '@/lib/gift-rules';

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const brand = () => publicEnv.NEXT_PUBLIC_BRAND_NAME;

/** Simple, accessible transactional email body. Paragraphs are trusted HTML (escape user text first). */
export function mail(title: string, paragraphs: string[], cta?: { href: string; label: string }, footer?: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;line-height:1.55;color:#111">
    <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
    ${paragraphs.filter(Boolean).map((p) => `<p style="margin:0 0 12px">${p}</p>`).join('')}
    ${cta ? `<p><a href="${cta.href}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${escapeHtml(cta.label)}</a></p>` : ''}
    <p style="color:#666;font-size:12px;margin-top:24px">${escapeHtml(footer ?? `${brand()} · ${siteUrl()}`)}</p>
  </div>`;
}

export const quote = (s: string) =>
  `<blockquote style="margin:0;padding:10px 14px;border-left:3px solid #ccc;background:#f6f6f6;white-space:pre-wrap">${escapeHtml(s.slice(0, 2000))}</blockquote>`;

/** Best effort: a failed email never fails the request (everything is on the site too). */
export async function safeSend(to: string | null | undefined, subject: string, html: string): Promise<boolean> {
  if (!to) return false;
  try {
    return (await sendEmail({ to, subject, html })).sent;
  } catch (err) {
    console.error('[email] failed', subject, err);
    return false;
  }
}
