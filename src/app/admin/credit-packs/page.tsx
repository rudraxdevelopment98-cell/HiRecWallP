import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { AdminForm, type FieldDef } from '@/components/admin/admin-form';
import { REGION_CODES, REGION_LABEL } from '@/lib/geo';

export const dynamic = 'force-dynamic';

const REGIONS = REGION_CODES.map((c) => ({ value: c, label: `${c} — ${REGION_LABEL[c]}` }));
const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Pack name', placeholder: 'Starter / Popular / Mega' },
  { name: 'region_code', label: 'Tier', type: 'select', options: REGIONS },
  { name: 'country_codes', label: 'Only these countries', placeholder: 'blank = whole tier, or GB' },
  { name: 'currency', label: 'Currency', placeholder: 'INR / USD / GBP' },
  { name: 'amount_minor', label: 'Price', type: 'money' },
  { name: 'credits', label: 'Paid credits', type: 'number' },
  { name: 'bonus_credits', label: 'Bonus credits (expire in 12 months)', type: 'number' },
  {
    name: 'badge',
    label: 'Badge',
    type: 'select',
    options: [
      { value: '', label: 'No badge' },
      { value: 'recommended', label: 'Recommended' },
      { value: 'best_value', label: 'Best value' },
    ],
  },
  { name: 'sort_order', label: 'Order', type: 'number' },
  { name: 'active', label: 'On sale', type: 'checkbox' },
];

export default async function AdminCreditPacksPage() {
  await requireAdmin();
  const { data } = await createServiceClient().from('credit_packs').select('*').order('region_code').order('sort_order').order('currency');
  const packs = (data ?? []) as {
    id: string; name: string | null; region_code: string; country_codes: string[]; currency: string;
    amount_minor: number; credits: number; bonus_credits: number; badge: string | null; sort_order: number; active: boolean;
  }[];
  const tiers = REGION_CODES.filter((t) => packs.some((p) => p.region_code === t));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Credit packs</h1>
        <p className="text-sm text-muted-foreground">
          Sold in every country. A wallpaper costs 1 credit by default (Settings → Default prices); what a credit costs is set here per tier, with optional country-specific prices.
        </p>
      </div>
      {tiers.map((tier) => (
        <section key={tier} className="space-y-3">
          <h2 className="font-semibold">{tier} — {REGION_LABEL[tier]}</h2>
          {packs
            .filter((p) => p.region_code === tier)
            .map((p) => (
              <details key={p.id} className="rounded-2xl border bg-card p-5">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">
                    {p.name ?? 'Pack'} · {p.credits}
                    {p.bonus_credits ? ` + ${p.bonus_credits} bonus` : ''} credits · {formatMoneyMinor(p.amount_minor, p.currency)}
                  </span>
                  {p.country_codes.length > 0 && <Badge variant="secondary">{p.country_codes.join(', ')}</Badge>}
                  <Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'on sale' : 'off'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatMoneyMinor(Math.round(p.amount_minor / (p.credits + (p.bonus_credits ?? 0))), p.currency)} / credit
                  </span>
                </summary>
                <div className="mt-4">
                  <AdminForm
                    compact
                    action={`/api/admin/credit-packs/${p.id}`}
                    deleteAction={`/api/admin/credit-packs/${p.id}`}
                    deleteConfirm="Delete this pack? (If it was ever bought it will be switched off instead.)"
                    fields={FIELDS}
                    initial={{ ...p, badge: p.badge ?? '' }}
                  />
                </div>
              </details>
            ))}
        </section>
      ))}
      <details className="rounded-2xl border border-dashed bg-card p-5">
        <summary className="cursor-pointer font-medium">+ Add a credit pack</summary>
        <div className="mt-4">
          <AdminForm action="/api/admin/credit-packs" method="POST" submitLabel="Create pack" resetOnSuccess fields={FIELDS} initial={{ region_code: 'T1', currency: 'USD', bonus_credits: 0, badge: '', sort_order: 10, active: true }} />
        </div>
      </details>
    </div>
  );
}
