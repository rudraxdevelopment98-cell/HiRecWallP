import Link from 'next/link';
import type { Metadata } from 'next';
import { Briefcase, CalendarRange, Check, Coins, Crown, Globe2, Tags } from 'lucide-react';
import { countryName } from '@/lib/geo';
import { formatMoneyMinor, formatPerUnit } from '@/lib/format';
import { NewsletterCard } from '@/components/newsletter-card';
import { BuyButton, BuyPackButton } from '@/components/pricing/buy-pack-button';
import { listPlanOffers, type PlanKind, type PlanOffer } from '@/lib/membership';
import { getSettings } from '@/lib/settings';
import { getPriceContext, listCreditPacks, type CreditPack } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Credit packs and memberships, priced for your country. 1 credit = 1 wallpaper in every size.',
};
export const dynamic = 'force-dynamic';

type Tab = 'credits' | PlanKind;
const TABS: { id: Tab; label: string; icon: typeof Coins; blurb: string }[] = [
  { id: 'credits', label: 'Credit packs', icon: Coins, blurb: 'Pay as you go. 1 credit = 1 wallpaper, every size.' },
  { id: 'monthly', label: 'Monthly', icon: Crown, blurb: 'A fresh allowance of wallpapers every month.' },
  { id: 'contract', label: 'Long-term', icon: CalendarRange, blurb: 'Commit for 3, 6 or 12 months and pay less per month.' },
  { id: 'category', label: 'Category passes', icon: Tags, blurb: 'Only love one style? Get a pass just for it.' },
  { id: 'business', label: 'Business', icon: Briefcase, blurb: 'Commercial licence included — ads, products, client work.' },
];

const BADGE = { recommended: 'Recommended', best_value: 'Best value' } as const;

export default async function PricingPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab: tabParam }, ctx, settings] = await Promise.all([props.searchParams, getPriceContext(), getSettings()]);
  const [packs, offers] = await Promise.all([
    listCreditPacks(ctx),
    settings.membership_enabled ? listPlanOffers(ctx) : Promise.resolve([] as PlanOffer[]),
  ]);
  const tabs = TABS.filter((t) => (t.id === 'credits' ? true : offers.some((o) => o.plan.kind === t.id)));
  const tab: Tab = tabs.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'credits';
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  const currency = packs[0]?.currency ?? offers[0]?.prepaid?.currency ?? offers[0]?.autopay?.currency ?? null;

  return (
    <main className="container space-y-10 py-12">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Pick how you want to pay</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Every wallpaper costs the same number of credits everywhere. What you pay for credits and plans is set for your
          country, and every price shown is the full price.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5" /> Prices for <strong className="text-foreground">{countryName(ctx.country)}</strong>
          {currency && <> in {currency}</>} · change country in the header
        </p>
      </section>

      <nav aria-label="Plan types" className="sticky top-16 z-20 -mx-4 overflow-x-auto border-b bg-background/90 px-4 backdrop-blur">
        <ul className="mx-auto flex w-max gap-1 py-2">
          {tabs.map((t) => (
            <li key={t.id}>
              <Link
                href={`/pricing?tab=${t.id}`}
                scroll={false}
                aria-current={t.id === tab ? 'page' : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                  t.id === tab ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="tab-title">
        <h2 id="tab-title" className="text-center font-display text-2xl font-semibold tracking-tight">{current.label}</h2>
        <p className="mb-8 mt-1 text-center text-sm text-muted-foreground">{current.blurb}</p>
        {tab === 'credits' ? <PackGrid packs={packs} /> : <PlanGrid offers={offers} kind={tab} />}
      </section>

      <FinePrint tab={tab} />

      <section className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 text-sm">
          <h2 className="font-semibold">What every wallpaper includes</h2>
          <ul className="mt-3 space-y-2">
            {[
              'Every size we make for it (phone, tablet, desktop)',
              `${settings.downloads_per_purchase} downloads, on all your devices`,
              'Full-quality file — the preview watermark is removed',
              'Personal licence; commercial licence = 5 credits or a Business plan',
            ].map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {p}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-muted-foreground">
            <Link href="/licence" className="underline">Licence terms</Link> · <Link href="/refunds" className="underline">Refunds</Link>
          </p>
        </div>
        {settings.newsletter_enabled && <NewsletterCard />}
      </section>
    </main>
  );
}

function Card({ badge, children }: { badge?: string | null; children: React.ReactNode }) {
  return (
    <div className={`relative flex h-full flex-col rounded-2xl border bg-card p-6 ${badge ? 'border-foreground shadow-lg' : ''}`}>
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-0.5 text-xs font-medium text-background">
          {badge}
        </span>
      )}
      {children}
    </div>
  );
}

function PackGrid({ packs }: { packs: CreditPack[] }) {
  if (packs.length === 0) {
    return <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Credit packs will appear here soon.</p>;
  }
  // Honest saving: per-credit price vs the smallest pack shown.
  const base = Math.max(...packs.map((p) => p.amount_minor / (p.credits + p.bonus_credits)));
  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {packs.map((p) => {
        const total = p.credits + p.bonus_credits;
        const save = Math.round((1 - p.amount_minor / total / base) * 100);
        return (
          <Card key={p.id} badge={p.badge ? BADGE[p.badge] : null}>
            <p className="text-sm font-medium text-muted-foreground">{p.name ?? 'Credits'}</p>
            <p className="mt-2 font-display text-4xl font-semibold">
              {total} <span className="text-base font-normal text-muted-foreground">credits</span>
            </p>
            {p.bonus_credits > 0 ? (
              <p className="text-xs text-emerald-600">
                {p.credits} + {p.bonus_credits} bonus <span className="text-muted-foreground">(bonus valid 12 months)</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Never expire</p>
            )}
            <p className="mt-4 text-2xl font-semibold">{formatMoneyMinor(p.amount_minor, p.currency)}</p>
            <p className="text-xs text-muted-foreground">
              {formatPerUnit(p.amount_minor, total, p.currency)}
              {save >= 5 && <span className="ml-1 font-medium text-emerald-600">· save {save}% per credit</span>}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">= {total} wallpapers in every size</p>
            <div className="mt-auto pt-2">
              <BuyPackButton packId={p.id} credits={total} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** Monthly price of a plan, prepaid or autopay. */
const perMonth = (o: PlanOffer) =>
  o.prepaid ? o.prepaid.amount_minor / o.plan.term_months : o.autopay ? o.autopay.amount_minor : Infinity;

function PlanGrid({ offers, kind }: { offers: PlanOffer[]; kind: PlanKind }) {
  const list = offers.filter((o) => o.plan.kind === kind);
  // For long-term plans, compare against paying monthly for the same allowance.
  const monthlyRef = (o: PlanOffer) =>
    offers.find((m) => m.plan.kind === 'monthly' && m.plan.download_limit === o.plan.download_limit && !m.plan.includes_commercial);
  return (
    <div className={`mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 ${list.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
      {list.map((o) => {
        const { plan } = o;
        const ref = kind === 'contract' ? monthlyRef(o) : undefined;
        const refMonthly = ref?.prepaid?.amount_minor ?? ref?.autopay?.amount_minor;
        const currency = (o.prepaid ?? o.autopay)!.currency;
        const save = refMonthly ? Math.round((1 - perMonth(o) / refMonthly) * 100) : 0;
        const autopaySave = refMonthly && o.autopay ? Math.round((1 - o.autopay.amount_minor / refMonthly) * 100) : 0;
        return (
          <Card key={plan.id} badge={plan.badge ? BADGE[plan.badge] : null}>
            <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
            <p className="mt-2">
              <span className="font-display text-4xl font-semibold">{plan.download_limit}</span>
              <span className="text-sm text-muted-foreground"> wallpapers / month</span>
            </p>
            {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}

            {o.prepaid && (
              <div className="mt-4">
                <p className="text-2xl font-semibold">
                  {formatMoneyMinor(o.prepaid.amount_minor, currency)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {plan.term_months === 1 ? ' / month' : ` for ${plan.term_months} months`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.term_months > 1 && <>= {formatMoneyMinor(Math.round(perMonth(o)), currency)} / month · </>}
                  {formatPerUnit(perMonth(o), plan.download_limit, currency, 'wallpaper')}
                  {save >= 5 && <span className="ml-1 font-medium text-emerald-600">· save {save}% vs monthly</span>}
                </p>
              </div>
            )}

            <ul className="mt-4 space-y-2 text-sm">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {perk}
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-2 pt-4">
              {o.prepaid && (
                <BuyButton
                  body={{ type: 'membership', planId: plan.id, billing: 'prepaid' }}
                  label={plan.term_months === 1 ? 'Pay for 1 month' : `Pay once · ${plan.term_months} months`}
                  description={plan.name}
                  successUrl="/account/membership?bought=1"
                />
              )}
              {o.autopay && (
                <>
                  <BuyButton
                    variant="outline"
                    body={{ type: 'membership', planId: plan.id, billing: 'autopay' }}
                    label={`Autopay ${formatMoneyMinor(o.autopay.amount_minor, currency)} / month`}
                    description={`${plan.name} — monthly autopay`}
                    successUrl="/account/membership?bought=1"
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    {plan.kind === 'contract' ? `${plan.term_months} monthly payments` : 'Renews monthly'} · cancel anytime in your account
                    {autopaySave >= 3 && <> · save {autopaySave}%</>}
                  </p>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function FinePrint({ tab }: { tab: Tab }) {
  const lines =
    tab === 'credits'
      ? [
          'Credits you pay for never expire. Bonus credits are valid for 12 months and are used first.',
          'Most wallpapers cost 1 credit; a commercial licence costs 5×.',
        ]
      : [
          'Your allowance refreshes every 30 days. Unused wallpapers in a month do not carry over.',
          'Wallpapers you add stay in your library forever, even after your plan ends.',
          'Autopay: we charge the same amount each month and never more. Cancel any time in Account → Membership — you keep the month you paid for.',
          'Pay-once plans never auto-renew. Buying again before yours ends adds the time on top.',
        ];
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border bg-card p-5 text-xs text-muted-foreground">
      <ul className="list-disc space-y-1 pl-4">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
        <li>Prices include applicable taxes. At checkout we confirm your billing country; prices follow it.</li>
      </ul>
    </section>
  );
}
