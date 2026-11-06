import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard, audit } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { escapeHtml } from '@/lib/gift-rules';
import { mail, safeSend, siteUrl } from '@/lib/mail-template';
import { allowRequest } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const schema = z.object({ subject: z.string().trim().min(3).max(120), message: z.string().trim().min(5).max(4000) });

/** Staff email to one customer (sales area). Logged on the customer's timeline. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  if (!(await allowRequest(request, `staff-email:${id}`, 10, 3600))) return NextResponse.json({ error: 'Too many emails to this customer in an hour' }, { status: 429 });

  const { data: profile } = await createServiceClient().from('profiles').select('email, deleted_at').eq('id', id).maybeSingle();
  if (!profile?.email || profile.deleted_at) return NextResponse.json({ error: 'This account has no email address' }, { status: 400 });
  const paragraphs = parsed.data.message.split(/\n{2,}/).map((p) => escapeHtml(p).replace(/\n/g, '<br>'));
  const html = mail(parsed.data.subject, [...paragraphs, `Reply to this email or open <a href="${siteUrl()}/account/support">Help &amp; support</a> on the site.`]);
  const sent = await safeSend(profile.email as string, parsed.data.subject, html);
  await audit('customer.email', 'user', id, { subject: parsed.data.subject, message: parsed.data.message, sent });
  if (!sent) return NextResponse.json({ error: 'Email isn’t set up yet (add RESEND_API_KEY), so nothing was sent. The note is kept on the timeline.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
