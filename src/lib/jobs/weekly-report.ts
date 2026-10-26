import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/email';
import { formatMoneyMinor } from '@/lib/format';

/**
 * weekly_report: email the owner a 7-day summary — revenue, top sellers,
 * price changes, social performance and job failures. No-ops gracefully when
 * RESEND_API_KEY / OWNER_EMAIL are unset (still returns the computed summary).
 */
export async function runWeeklyReport(): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [{ data: orders }, { data: downloads }, { data: priceChanges }, { data: social }, { data: failures }] =
    await Promise.all([
      supabase.from('orders').select('amount_minor, currency').eq('status', 'paid').gte('created_at', since),
      supabase.from('downloads').select('wallpaper_id').not('entitlement_id', 'is', null).gte('created_at', since),
      supabase.from('price_history').select('id').gte('created_at', since),
      supabase.from('social_posts').select('status').gte('created_at', since),
      supabase.from('jobs_log').select('job_name').eq('status', 'failed').gte('started_at', since),
    ]);

  const revenueByCurrency: Record<string, number> = {};
  for (const o of orders ?? []) revenueByCurrency[o.currency] = (revenueByCurrency[o.currency] ?? 0) + o.amount_minor;

  const sales = new Map<string, number>();
  for (const d of downloads ?? []) sales.set(d.wallpaper_id, (sales.get(d.wallpaper_id) ?? 0) + 1);
  const topIds = [...sales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  let topTitles: { title: string; count: number }[] = [];
  if (topIds.length) {
    const { data: titles } = await supabase.from('wallpapers').select('id, title').in('id', topIds.map(([id]) => id));
    const titleMap = new Map((titles ?? []).map((t) => [t.id, t.title]));
    topTitles = topIds.map(([id, count]) => ({ title: titleMap.get(id) ?? id, count }));
  }

  const socialPosted = (social ?? []).filter((s) => s.status === 'posted').length;
  const socialFailed = (social ?? []).filter((s) => s.status === 'failed').length;

  const summary = {
    revenue: Object.entries(revenueByCurrency).map(([c, m]) => formatMoneyMinor(m, c)),
    paidDownloads: (downloads ?? []).length,
    topSellers: topTitles,
    priceChanges: (priceChanges ?? []).length,
    social: { posted: socialPosted, failed: socialFailed },
    jobFailures: (failures ?? []).length,
  };

  const html = `
    <h2>HirecWallp — weekly report</h2>
    <p><strong>Revenue (7d):</strong> ${summary.revenue.join(', ') || '—'}</p>
    <p><strong>Paid downloads:</strong> ${summary.paidDownloads}</p>
    <p><strong>Price changes:</strong> ${summary.priceChanges} · <strong>Social:</strong> ${socialPosted} posted, ${socialFailed} failed · <strong>Job failures:</strong> ${summary.jobFailures}</p>
    <h3>Top sellers</h3>
    <ol>${summary.topSellers.map((t) => `<li>${t.title} — ${t.count}</li>`).join('') || '<li>No sales yet</li>'}</ol>
  `;

  const owner = process.env.OWNER_EMAIL;
  let emailed = false;
  if (owner) {
    const res = await sendEmail({ to: owner, subject: 'HirecWallp — weekly report', html });
    emailed = res.sent;
  }

  return { emailed, ...summary };
}
