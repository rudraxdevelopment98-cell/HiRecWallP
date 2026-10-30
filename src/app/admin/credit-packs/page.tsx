import { createServiceClient } from '@/lib/supabase/service';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { AdminForm, type FieldDef } from '@/components/admin/admin-form';

export const dynamic = 'force-dynamic';

const REGIONS = [
  { value: 'T1', label: 'Tier 1 (UK/US/EU/CA/AU)' },
  { value: 'T2', label: 'Tier 2 (Middle East / East Asia)' },
  { value: 'T3', label: 'Rest of world' },
];
const FIELDS: FieldDef[] = [
  { name: 'region_code', label: 'Region', type: 'select', options: REGIONS },
  { name: 'currency', label: 'Currency', placeholder: 'USD' },
  { name: 'amount_minor', label: 'Price', type: 'money' },
  { name: 'credits', label: 'Credits', type: 'number' },
  { name: 'active', label: 'On sale', type: 'checkbox' },
];

export default async function AdminCreditPacksPage() {
  const { data } = await createServiceClient().from('credit_packs').select('*').order('region_code').order('currency').order('credits');
  const packs = (data ?? []) as { id: string; region_code: string; currency: string; amount_minor: number; credits: number; active: boolean }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Credit packs</h1>
        <p className="text-sm text-muted-foreground">
          Sold outside India. A wallpaper costs 1–5 credits depending on region (set in Settings → Default prices).
        </p>
      </div>
      {packs.map((p) => (
        <div key={p.id} className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <p className="font-medium">
              {p.credits} credits · {formatMoneyMinor(p.amount_minor, p.currency)} · {p.region_code}
            </p>
            <Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'on sale' : 'off'}</Badge>
          </div>
          <AdminForm
            compact
            action={`/api/admin/credit-packs/${p.id}`}
            deleteAction={`/api/admin/credit-packs/${p.id}`}
            deleteConfirm="Delete this pack? (If it was ever bought it will be switched off instead.)"
            fields={FIELDS}
            initial={p}
          />
        </div>
      ))}
      <details className="rounded-2xl border border-dashed bg-card p-5">
        <summary className="cursor-pointer font-medium">+ Add a credit pack</summary>
        <div className="mt-4">
          <AdminForm action="/api/admin/credit-packs" method="POST" submitLabel="Create pack" resetOnSuccess fields={FIELDS} initial={{ region_code: 'T1', currency: 'USD', active: true }} />
        </div>
      </details>
    </div>
  );
}
