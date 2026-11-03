import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createServiceClient } from '@/lib/supabase/service';
import { REGION_CODES, REGION_LABEL, countryName, regionForCountry, tierCountries, type RegionCode } from '@/lib/geo';
import { formatMoneyMinor } from '@/lib/format';
import { AdminForm } from '@/components/admin/admin-form';
import { CountryTiersForm } from '@/components/admin/country-tiers-form';

export const dynamic = 'force-dynamic';

export default async function AdminCountriesPage() {
  await requireAdmin();
  const [settings, { data: packs }] = await Promise.all([
    getSettings(),
    createServiceClient().from('credit_packs').select('region_code, country_codes, currency, amount_minor, credits, bonus_credits').eq('active', true),
  ]);
  const overrides = settings.country_tiers;
  const base = tierCountries();
  // Effective membership of each tier after overrides.
  const effective: Record<RegionCode, string[]> = { IN: [], T1: [], T2: [], T3: [], T4: [] };
  const all = new Set([...Object.values(base).flat(), ...Object.keys(overrides)]);
  for (const c of all) effective[regionForCountry(c, overrides)].push(c);
  // Cheapest per-credit price per tier (tier-wide packs) for a quick comparison.
  const perCredit = new Map<string, string>();
  for (const t of REGION_CODES) {
    const rows = (packs ?? []).filter((p) => p.region_code === t && (p.country_codes as string[]).length === 0);
    const best = rows.sort((a, b) => a.amount_minor / (a.credits + a.bonus_credits) - b.amount_minor / (b.credits + b.bonus_credits))[0];
    if (best) perCredit.set(t, `from ${formatMoneyMinor(Math.round(best.amount_minor / (best.credits + best.bonus_credits)), best.currency)} / credit`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Pricing by country</h1>
        <p className="text-sm text-muted-foreground">
          Visitors are auto-detected by country and shown their tier&rsquo;s prices (or a country&rsquo;s own prices where set in{' '}
          <Link href="/admin/credit-packs" className="underline">Credit packs</Link> / <Link href="/admin/membership" className="underline">Membership</Link>).
          At checkout the billing country is checked and the higher-priced tier wins. Unlisted countries use Tier 3.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {REGION_CODES.map((t) => (
          <div key={t} className="admin-card p-5 text-sm">
            <p className="font-semibold">
              {t} — {REGION_LABEL[t]}
            </p>
            <p className="text-xs text-muted-foreground">
              {effective[t].length} countries{perCredit.get(t) ? ` · ${perCredit.get(t)}` : ''}
            </p>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {effective[t]
                .map((c) => `${countryName(c)}${overrides[c] ? ' *' : ''}`)
                .sort()
                .join(' · ')}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="admin-card p-6">
          <h2 className="font-semibold">Move countries between tiers</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            One per line: country code and tier, e.g. <code>BR T4</code>. Marked * above. Takes effect within a minute.
          </p>
          <CountryTiersForm initial={overrides} />
        </div>
        <div className="admin-card p-6">
          <h2 className="font-semibold">Creator earnings: value of one credit</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Creators are paid on credits spent on their wallpapers and membership claims, at this rupee value per credit,
            minus commission. ⚠️ Confirm with your CA.
          </p>
          <AdminForm
            action="/api/admin/settings"
            method="PUT"
            fields={[{ name: 'creator_credit_value_inr', label: '₹ per credit', type: 'number', span: 2 }]}
            initial={{ creator_credit_value_inr: settings.creator_credit_value_inr }}
            wrapAs="creator_credit_value_inr"
          />
        </div>
      </section>
    </div>
  );
}
