import Link from 'next/link';
import type { Metadata } from 'next';
import { getCreator } from '@/lib/creator';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { OnboardForm } from '@/components/creator/onboard-form';

export const metadata: Metadata = { title: 'Creator' };

export default async function CreatorDashboardPage() {
  const creator = await getCreator();

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
