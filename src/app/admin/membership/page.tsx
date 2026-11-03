import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { emailsFor } from '@/lib/admin';
import { getSettings } from '@/lib/settings';
import { Badge } from '@/components/ui/badge';
import { AdminForm, SettingToggle, type FieldDef } from '@/components/admin/admin-form';
import { MemberActions } from '@/components/admin/member-actions';
import { formatMoneyMinor } from '@/lib/format';
import { REGION_CODES, REGION_LABEL } from '@/lib/geo';

export const dynamic = 'force-dynamic';

const KINDS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'contract', label: 'Long-term (contract)' },
  { value: 'category', label: 'Category pass' },
  { value: 'business', label: 'Business (commercial)' },
];
const BADGES = [
  { value: '', label: 'No badge' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'best_value', label: 'Best value' },
];
const TIERS = REGION_CODES.map((c) => ({ value: c, label: `${c} — ${REGION_LABEL[c]}` }));

function planFields(categories: { value: string; label: string }[]): FieldDef[] {
  return [
    { name: 'name', label: 'Plan name', span: 2 },
    { name: 'kind', label: 'Tab', type: 'select', options: KINDS },
    { name: 'badge', label: 'Badge', type: 'select', options: BADGES },
    { name: 'description', label: 'Short description', span: 4 },
    { name: 'term_months', label: 'Term (months)', type: 'number' },
    { name: 'download_limit', label: 'Wallpapers / month', type: 'number' },
    { name: 'category_id', label: 'Category (passes only)', type: 'select', options: [{ value: '', label: 'All categories' }, ...categories] },
    { name: 'sort_order', label: 'Order on page', type: 'number' },
    { name: 'includes_commercial', label: 'Commercial licence included', type: 'checkbox' },
    { name: 'active', label: 'On sale', type: 'checkbox' },
    { name: 'sale_starts_at', label: 'On sale from (IST, optional)', type: 'datetime', span: 2 },
    { name: 'sale_ends_at', label: 'On sale until (IST, optional — festival drops)', type: 'datetime', span: 2 },
    { name: 'perks', label: 'Bullet points on the card (one per line)', type: 'lines' },
  ];
}

const PRICE_FIELDS: FieldDef[] = [
  { name: 'billing', label: 'Billing', type: 'select', options: [{ value: 'prepaid', label: 'Pay once (whole term)' }, { value: 'autopay', label: 'Autopay (per month)' }] },
  { name: 'region_code', label: 'Tier', type: 'select', options: TIERS },
  { name: 'country_codes', label: 'Only these countries', placeholder: 'blank = whole tier, or GB, IE' },
  { name: 'currency', label: 'Currency', placeholder: 'INR / USD / GBP' },
  { name: 'amount_minor', label: 'Price', type: 'money' },
  { name: 'active', label: 'On', type: 'checkbox' },
];

interface Plan {
  id: string;
  name: string;
  kind: string;
  term_months: number;
  download_limit: number;
  includes_commercial: boolean;
  category_id: string | null;
  badge: string | null;
  description: string | null;
  perks: string[];
  active: boolean;
  sort_order: number;
}
interface Price {
  id: string;
  plan_id: string;
  billing: string;
  region_code: string;
  country_codes: string[];
  currency: string;
  amount_minor: number;
  active: boolean;
}

export default async function AdminMembershipPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const [settings, { data: plans }, { data: prices }, { data: cats }, { data: members }] = await Promise.all([
    getSettings(),
    supabase.from('membership_plans').select('*').order('sort_order'),
    supabase.from('plan_prices').select('*').order('billing').order('region_code'),
    supabase.from('categories').select('id, name').order('name'),
    supabase
      .from('memberships')
      .select('id, user_id, starts_at, ends_at, download_limit, downloads_used, status, note, membership_plans(name)')
      .order('ends_at', { ascending: false })
      .limit(300),
  ]);
  const categories = ((cats ?? []) as { id: string; name: string }[]).map((c) => ({ value: c.id, label: c.name }));
  const fields = planFields(categories);
  const pricesBy = new Map<string, Price[]>();
  for (const p of (prices ?? []) as Price[]) pricesBy.set(p.plan_id, [...(pricesBy.get(p.plan_id) ?? []), p]);
  const email = await emailsFor(((members ?? []) as { user_id: string }[]).map((m) => m.user_id));
  const now = Date.now();
  const rows = (members ?? []) as unknown as {
    id: string;
    user_id: string;
    starts_at: string;
    ends_at: string;
    download_limit: number;
    downloads_used: number;
    status: string;
    note: string | null;
    membership_plans: { name: string } | null;
  }[];
  const activeCount = rows.filter((m) => m.status === 'active' && new Date(m.ends_at).getTime() > now).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Membership</h1>
        <p className="text-sm text-muted-foreground">
          Plans appear on the Pricing page in tabs (Monthly, Long-term, Category passes, Business). Each gives a monthly
          allowance that refreshes every 30 days. Each plan can be sold as <strong>pay once</strong> (whole term) and/or
          <strong> autopay</strong> (charged monthly; customers can cancel any time) — with a price per tier and, optionally,
          per country. Members keep what they add.
        </p>
      </div>

      <section className="admin-card px-6 py-2">
        <SettingToggle
          settingKey="membership_enabled"
          value={settings.membership_enabled}
          label="Sell membership passes"
          hint={`Shows plans marked "On sale" on the Pricing page. ${activeCount} active member(s).`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Plans</h2>
        {((plans ?? []) as Plan[]).map((p) => {
          const planPrices = pricesBy.get(p.id) ?? [];
          return (
            <details key={p.id} className="admin-card p-5">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Badge variant="secondary">{KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}</Badge>
                <Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'on sale' : 'off'}</Badge>
                <span className="text-xs text-muted-foreground">
                  {p.download_limit}/month · {p.term_months} month{p.term_months === 1 ? '' : 's'} · {planPrices.length} price{planPrices.length === 1 ? '' : 's'}
                </span>
              </summary>
              <div className="mt-4 space-y-5">
                <AdminForm
                  action={`/api/admin/plans/${p.id}`}
                  deleteAction={`/api/admin/plans/${p.id}`}
                  deleteConfirm="Delete this plan? (If anyone bought it, it will be switched off instead.)"
                  fields={fields}
                  initial={{ ...p, badge: p.badge ?? '', category_id: p.category_id ?? '' }}
                />
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-medium">Prices</p>
                  {planPrices.map((pr) => (
                    <div key={pr.id} className="rounded-xl border p-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        {pr.billing === 'prepaid' ? 'Pay once' : 'Autopay / month'} · {pr.region_code}
                        {pr.country_codes.length ? ` · ${pr.country_codes.join(', ')}` : ''} ·{' '}
                        {formatMoneyMinor(pr.amount_minor, pr.currency)}
                        {!pr.active && ' · off'}
                      </p>
                      <AdminForm
                        compact
                        action={`/api/admin/plan-prices/${pr.id}`}
                        deleteAction={`/api/admin/plan-prices/${pr.id}`}
                        deleteConfirm="Delete this price? (If someone has autopay on it, it is switched off instead.)"
                        fields={PRICE_FIELDS}
                        initial={{ ...pr }}
                        extra={{ plan_id: p.id }}
                      />
                    </div>
                  ))}
                  <details className="rounded-xl border border-dashed p-3">
                    <summary className="cursor-pointer text-sm">+ Add a price</summary>
                    <div className="mt-3">
                      <AdminForm
                        compact
                        action="/api/admin/plan-prices"
                        method="POST"
                        submitLabel="Add price"
                        resetOnSuccess
                        fields={PRICE_FIELDS}
                        initial={{ billing: 'prepaid', region_code: 'IN', currency: 'INR', active: true }}
                        extra={{ plan_id: p.id }}
                      />
                    </div>
                  </details>
                </div>
              </div>
            </details>
          );
        })}
        <details className="rounded-xl border border-dashed bg-card p-5">
          <summary className="cursor-pointer font-medium">+ Add a plan</summary>
          <div className="mt-4">
            <AdminForm
              action="/api/admin/plans"
              method="POST"
              submitLabel="Create plan"
              resetOnSuccess
              fields={fields}
              initial={{ kind: 'monthly', term_months: 1, download_limit: 30, sort_order: 30, badge: '', category_id: '', active: false }}
            />
          </div>
        </details>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Members</h2>
        <details className="rounded-xl border border-dashed bg-card p-5">
          <summary className="cursor-pointer font-medium">+ Give someone a free pass</summary>
          <div className="mt-4">
            <AdminForm
              action="/api/admin/members"
              method="POST"
              submitLabel="Grant pass"
              resetOnSuccess
              fields={[
                { name: 'email', label: 'Their account email', span: 2 },
                { name: 'days', label: 'Days', type: 'number' },
                { name: 'download_limit', label: 'Wallpapers', type: 'number' },
                { name: 'includes_commercial', label: 'Commercial licence', type: 'checkbox' },
                { name: 'note', label: 'Note (e.g. influencer, giveaway)', span: 3 },
              ]}
              initial={{ days: 30, download_limit: 30 }}
            />
          </div>
        </details>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="divide-y admin-card text-sm">
            {rows.map((m) => {
              const live = m.status === 'active' && new Date(m.ends_at).getTime() > now;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{email.get(m.user_id) ?? m.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.membership_plans?.name ?? m.note ?? 'Pass'} · until {new Date(m.ends_at).toLocaleDateString('en-IN')} ·{' '}
                      {m.downloads_used}/{m.download_limit} used
                    </p>
                  </div>
                  <Badge variant={live ? 'default' : 'secondary'}>{m.status === 'revoked' ? 'revoked' : live ? 'active' : 'expired'}</Badge>
                  <MemberActions id={m.id} status={m.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Member payments appear in <Link href="/admin/orders" className="underline">Orders</Link> like any purchase.
      </p>
    </div>
  );
}
