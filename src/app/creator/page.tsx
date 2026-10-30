import Link from 'next/link';
import type { Metadata } from 'next';
import { getCreator } from '@/lib/creator';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { OnboardForm } from '@/components/creator/onboard-form';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';

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
  const { data: submissions } = await createServiceClient()
    .from('wallpapers')
    .select('id, slug, title, status, created_at')
    .eq('creator_id', creator.user_id)
    .order('created_at', { ascending: false })
    .limit(100);

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
                  <Link href={`/w/${w.slug}`} className="font-medium hover:underline">
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
