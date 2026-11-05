import Link from 'next/link';
import type { Metadata } from 'next';
import { getCreator } from '@/lib/creator';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { OnboardForm } from '@/components/creator/onboard-form';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';
import { CopyField } from '@/components/account/copy-field';
import { formatMoneyMinor } from '@/lib/format';
import { publicEnv } from '@/lib/env';
import { wallpaperPath } from '@/lib/wallpaper-url';

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'In review',
  published: 'Live',
  draft: 'Not published',
  archived: 'Archived',
};

export const metadata: Metadata = { title: 'Creator' };

export default async function CreatorDashboardPage() {
  const creator = await getCreator();

  if (!creator && !(await getSettings()).creator_signups) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Creator sign-ups are closed</h1>
        <p className="text-sm text-muted-foreground">We&rsquo;re not accepting new creators right now. Please check back soon.</p>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Become a creator</h1>
          <p className="text-sm text-muted-foreground">
            Sell your own ultra-HD wallpapers. Automated checks + manual review keep quality and
            rights clean; you earn on every sale.
          </p>
        </div>
        <OnboardForm />
      </div>
    );
  }

  // Creators can't read their own unpublished rows under RLS; scope by their id.
  const service = createServiceClient();
  const [{ data: submissions }, { data: code }, { data: comms }, settings] = await Promise.all([
    service
      .from('wallpapers')
      .select('id, slug, code, title, status, created_at')
      .eq('creator_id', creator.user_id)
      .order('created_at', { ascending: false })
      .limit(100),
    service.rpc('ensure_referral_code', { p_user: creator.user_id }),
    service.from('affiliate_commissions').select('currency, commission_minor, status').eq('affiliate_id', creator.user_id),
    getSettings(),
  ]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const affLink = `${site}/?via=${code as string}`;
  const sums = new Map<string, { pending: number; paid: number; orders: number }>();
  for (const c of (comms ?? []) as { currency: string; commission_minor: number; status: string }[]) {
    if (c.status === 'void') continue;
    const s = sums.get(c.currency) ?? { pending: 0, paid: 0, orders: 0 };
    s.orders += 1;
    if (c.status === 'paid') s.paid += c.commission_minor;
    else s.pending += c.commission_minor;
    sums.set(c.currency, s);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Welcome, {creator.display_name ?? 'creator'}</h1>
        <Link href="/creator/upload" className={buttonVariants()}>
          Upload a wallpaper
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="KYC status">
          <Badge variant={creator.kyc_status === 'verified' ? 'free' : 'secondary'}>
            {creator.kyc_status}
          </Badge>
        </Card>
        <Card label="Commission">{creator.commission_pct}%</Card>
        <Card label="Payout method">{creator.payout_provider ?? '—'}</Card>
      </div>

      {settings.growth.affiliate_enabled && (
        <section className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">Your affiliate link · earn {settings.growth.affiliate_pct}% of what your followers spend</h2>
          <CopyField value={affLink} label="Affiliate link" />
          <p className="text-xs text-muted-foreground">
            Add <code>?via={code as string}</code> to any {publicEnv.NEXT_PUBLIC_BRAND_NAME} link (for example your wallpaper pages).
            Anyone who buys within 30 days of clicking earns you {settings.growth.affiliate_pct}% of their order, paid with your monthly payout. Refunded orders don&rsquo;t count.
          </p>
          {sums.size === 0 ? (
            <p className="text-muted-foreground">No referred sales yet.</p>
          ) : (
            <ul className="space-y-1">
              {[...sums.entries()].map(([cur, v]) => (
                <li key={cur}>
                  {v.orders} order{v.orders === 1 ? '' : 's'} · {formatMoneyMinor(v.pending, cur)} pending · {formatMoneyMinor(v.paid, cur)} paid
                </li>
              ))}
            </ul>
          )}
        </section>
      )}


      {creator.kyc_status !== 'verified' && (
        <p className="glass rounded-xl p-4 text-sm text-muted-foreground">
          Your KYC is <strong>{creator.kyc_status}</strong>. Payouts are released once verified.
        </p>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Your submissions</h2>
        {(submissions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {(submissions ?? []).map((w) => (
              <li key={w.id as string} className="flex items-center justify-between gap-3 p-3">
                {w.status === 'published' ? (
                  <Link href={wallpaperPath({ slug: w.slug as string, code: w.code as string | null })} className="font-medium hover:underline">
                    {w.title as string}
                  </Link>
                ) : (
                  <span className="font-medium">{w.title as string}</span>
                )}
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {new Date(w.created_at as string).toLocaleDateString('en-IN')}
                  <Badge variant={w.status === 'published' ? 'free' : 'secondary'}>{STATUS_LABEL[w.status as string] ?? (w.status as string)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 text-lg font-semibold">{children}</div>
    </div>
  );
}
