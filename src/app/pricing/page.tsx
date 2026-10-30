import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, Coins, Crown, IndianRupee } from 'lucide-react';
import { REGION_PRICING_UNIT } from '@/lib/geo';
import { formatMoneyMinor } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
import { Reveal } from '@/components/reveal';
import { NewsletterCard } from '@/components/newsletter-card';
import { BuyButton, BuyPackButton } from '@/components/pricing/buy-pack-button';
import { listPlansFor } from '@/lib/membership';
import { getSettings } from '@/lib/settings';
import { getDisplayRegion, listCreditPacks } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Pay per wallpaper in India, or use credits worldwide — priced fairly for your country.',
};

const INCLUDED = [
  'Every size we make for that wallpaper',
  '5 downloads per purchase',
  'Full-quality file (preview watermark removed)',
  'Personal licence — commercial available',
];

export default async function PricingPage() {
  const region = (await getDisplayRegion());
  const money = REGION_PRICING_UNIT[region] === 'money';
  const [packs, settings] = await Promise.all([money ? Promise.resolve([]) : listCreditPacks(region), getSettings()]);
  const plans = settings.membership_enabled ? await listPlansFor(region) : [];
  // One currency per row keeps the grid readable (T1 has GBP/USD/EUR packs).
  const currencies = [...new Set(packs.map((p) => p.currency))];

  return (
    <main className="container space-y-14 py-12">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Simple, fair pricing</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Pay once per wallpaper and get every size. Prices are set for your country and checked
          against your billing country at checkout.
        </p>
      </section>

      <section className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <Reveal>
          <div className={`h-full rounded-2xl border p-7 ${money ? 'border-foreground bg-card shadow-lg' : 'bg-card'}`}>
            <IndianRupee className="h-6 w-6" />
            <h2 className="mt-3 text-lg font-semibold">India — pay per wallpaper</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Typically ₹19 (₹9–₹99), paid by UPI, card or netbanking via Razorpay.
            </p>
            <Included />
            {money && (
              <Link href="/explore" className={buttonVariants({ className: 'mt-6 w-full' })}>
                Browse wallpapers
              </Link>
            )}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className={`h-full rounded-2xl border p-7 ${!money ? 'border-foreground bg-card shadow-lg' : 'bg-card'}`}>
            <Coins className="h-6 w-6" />
            <h2 className="mt-3 text-lg font-semibold">Everywhere else — credits</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buy a credit pack by card, then unlock wallpapers for 1–5 credits each. Credits never
              expire.
            </p>
            <Included />
          </div>
        </Reveal>
      </section>

      {plans.length > 0 && (
        <section id="membership" className="scroll-mt-24">
          <h2 className="mb-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <Crown className="h-5 w-5 text-amber-500" /> Membership passes
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Pay once, add lots of wallpapers to your library. No auto-renew — extend whenever you like.
          </p>
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            {plans.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 60}>
                <div className={`h-full rounded-2xl border p-7 ${i === plans.length - 1 ? 'border-foreground bg-card shadow-lg' : 'bg-card'}`}>
                  <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                  <p className="mt-2">
                    <span className="font-display text-4xl font-semibold">{formatMoneyMinor(plan.amountMinor, plan.currency)}</span>
                    <span className="text-sm text-muted-foreground"> / {plan.duration_days} days</span>
                  </p>
                  {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
                  <ul className="mt-5 space-y-2 text-sm">
                    {[`Up to ${plan.download_limit} wallpapers`, ...(plan.includes_commercial ? ['Commercial licence included'] : []), ...plan.perks].map((perk) => (
                      <li key={perk} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" /> {perk}
                      </li>
                    ))}
                  </ul>
                  <BuyButton
                    body={{ type: 'membership', planId: plan.id }}
                    label="Get pass"
                    description={plan.name}
                    successUrl="/account/membership?bought=1"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {!money && (
        <section>
          <h2 className="mb-1 font-display text-2xl font-semibold tracking-tight">Credit packs</h2>
          <p className="mb-6 text-sm text-muted-foreground">The bigger the pack, the cheaper each credit.</p>
          {packs.length === 0 ? (
            <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Credit packs will appear here soon.
            </p>
          ) : (
            <div className="space-y-6">
              {currencies.map((cur) => (
                <div key={cur} className="grid gap-4 sm:grid-cols-3">
                  {packs
                    .filter((p) => p.currency === cur)
                    .map((pack) => (
                      <Reveal key={pack.id}>
                        <div className="hover-lift rounded-2xl border bg-card p-6 text-center">
                          <p className="font-display text-4xl font-semibold">{pack.credits}</p>
                          <p className="text-sm text-muted-foreground">credits</p>
                          <p className="mt-4 text-lg font-medium">{formatMoneyMinor(pack.amount_minor, pack.currency)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatMoneyMinor(Math.round(pack.amount_minor / pack.credits), pack.currency)} per credit
                          </p>
                          <BuyPackButton packId={pack.id} credits={pack.credits} />
                        </div>
                      </Reveal>
                    ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 text-sm">
          <h2 className="font-semibold">Commercial licence</h2>
          <p className="mt-1 text-muted-foreground">
            Using a wallpaper in a product, ad or client project? Add the commercial licence from the
            wallpaper&rsquo;s page — 5× the personal price. <Link href="/licence" className="underline">Licence terms</Link>
          </p>
        </div>
        {settings.newsletter_enabled && <NewsletterCard />}
      </section>
    </main>
  );
}

function Included() {
  return (
    <ul className="mt-5 space-y-2 text-sm">
      {INCLUDED.map((p) => (
        <li key={p} className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" /> {p}
        </li>
      ))}
    </ul>
  );
}
