import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/email';
import { getSettings } from '@/lib/settings';
import { istToday } from '@/lib/daily';
import { unsubscribeUrl } from '@/lib/unsubscribe';
import { escapeHtml } from '@/lib/gift-rules';
import { publicEnv } from '@/lib/env';

/**
 * Nightly (00:05 IST): choose today's free wallpaper and email opted-in
 * subscribers once (capped per day; skipped without RESEND_API_KEY). Every
 * email carries a one-click unsubscribe link.
 */
export async function runDailyPick(): Promise<Record<string, unknown>> {
  const settings = await getSettings();
  if (!settings.growth.daily_enabled) return { skipped: 'daily wallpaper is off' };
  const supabase = createServiceClient();
  const day = istToday();
  const { data: id } = await supabase.rpc('pick_daily', { p_day: day });
  if (!id) return { day, picked: null, note: 'no published premium wallpapers' };

  const { data: pick } = await supabase.from('daily_picks').select('emailed_at, wallpapers(slug, title)').eq('day', day).maybeSingle();
  const w = (pick as unknown as { emailed_at: string | null; wallpapers: { slug: string; title: string } | null } | null);
  if (!process.env.RESEND_API_KEY || !w?.wallpapers) return { day, picked: id, emailed: 0, note: 'email not configured' };
  if (w.emailed_at) return { day, picked: id, emailed: 0, note: 'already emailed today' };

  const cap = settings.growth.daily_email_cap;
  const { data: subs } = await supabase.from('newsletter_subscribers').select('email').eq('daily', true).order('created_at').limit(cap);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const link = `${site}/w/${w.wallpapers.slug}`;
  const brand = escapeHtml(publicEnv.NEXT_PUBLIC_BRAND_NAME);
  let sent = 0;
  let failed = 0;
  for (const s of (subs ?? []) as { email: string }[]) {
    try {
      await sendEmail({
        to: s.email,
        subject: `Free today: ${w.wallpapers.title}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;line-height:1.5">
          <h2 style="margin:0 0 8px">Today&rsquo;s free wallpaper</h2>
          <p><strong>${escapeHtml(w.wallpapers.title)}</strong> is free on ${brand} until midnight (IST). Every size, yours to keep.</p>
          <p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Get it free</a></p>
          <p style="color:#888;font-size:12px">You get this because you asked for the daily free wallpaper. <a href="${unsubscribeUrl(s.email)}">Unsubscribe</a></p>
        </div>`,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  await supabase.from('daily_picks').update({ emailed_at: new Date().toISOString() }).eq('day', day);
  return { day, picked: id, emailed: sent, failed, cap };
}
