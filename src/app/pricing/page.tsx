import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, Crown } from 'lucide-react';
import { REGION_PRICING_UNIT } from '@/lib/geo';
import { formatMoneyMinor } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
import { Reveal } from '@/components/reveal';
import { getDisplayRegion, listCreditPacks } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Membership & pricing',
  description: 'Go Premium for unlimited access, or buy credit packs — priced for your country.',
};

const PERKS = ['Full library access', 'Exclusive collections', 'No watermark', '8K downloads', 'Cancel anytime'];

export default async function PricingPage() {
  const region = getDisplayRegion();
  const money = REGION_PRICING_UNIT[region] === 'money';
  const monthly = money ? '₹299' : '$7.99';
  const yearly = money ? '₹2,499' : '$59.99';
  const packs = await listCreditPacks(region);

  return (
    <main className="container space-y-14 py-12">
      {/* Go Premium */}
      <section className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
          <Crown className="h-3.5 w-3.5 text-amber-500" /> Go Premium
        </span>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Unlimited beautiful screens</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Get exclusive access to thousands of premium wallpapers, creator exclusives and 8K downloads.
        </p>

        <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
          <Reveal>
            <PlanCard name="Monthly" price={monthly} per="/month" tag="Most Popular" />
          </Reveal>
          <Reveal delay={80}>
            <PlanCard name="Yearly" price={yearly} per="/year" tag="Best Value — save 30%" featured />
          </Reveal>
        </div>
      </section>

      {/* Credit packs / India per-item */}
      <section>
        <h2 className="mb-1 font-display text-2xl font-semibold tracking-tight">
          {money ? 'Per-wallpaper pricing (India)' : 'Credit packs'}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {money
            ? 'Prefer to pay per item? Each wallpaper is ₹9–₹99 via UPI. Bundles are fixed-price.'
            : 'Buy credits and spend them to unlock any wallpaper — the more you buy, the cheaper each credit.'}
        </p>
        {money ? (
          <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
            Per-wallpaper prices (₹9–₹99) are paid at checkout via Razorpay UPI. Festival packs are sold
            as fixed-price bundles.
          </div>
        ) : packs.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {packs.map((pack) => (
              <Reveal key={pack.id}>
                <div className="hover-lift rounded-2xl border bg-card p-6 text-center">
                  <p className="font-display text-4xl font-semibold">{pack.credits}</p>
                  <p className="text-sm text-muted-foreground">credits</p>
                  <p className="mt-4 text-lg font-medium">{formatMoneyMinor(pack.amount_minor, pack.currency)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Credit packs appear here once the database is seeded.
          </p>
        )}
      </section>
    </main>
  );
}

function PlanCard({
  name,
  price,
  per,
  tag,
  featured,
}: {
  name: string;
  price: string;
  per: string;
  tag: string;
  featured?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border p-7 text-left ${featured ? 'border-foreground bg-card shadow-lg' : 'bg-card'}`}>
      <span className={`absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-semibold ${featured ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
        {tag}
      </span>
      <p className="text-sm font-medium text-muted-foreground">{name}</p>
      <p className="mt-2">
        <span className="font-display text-4xl font-semibold">{price}</span>
        <span className="text-sm text-muted-foreground">{per}</span>
      </p>
      <ul className="mt-5 space-y-2 text-sm">
        {PERKS.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" /> {p}
          </li>
        ))}
      </ul>
      <Link href="/login" className={buttonVariants({ className: 'mt-6 w-full', variant: featured ? 'default' : 'outline' })}>
        Choose Plan
      </Link>
    </div>
  );
}
