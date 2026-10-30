import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { listAuthUsers } from '@/lib/admin';
import { getSettings } from '@/lib/settings';
import { Badge } from '@/components/ui/badge';
import { AdminForm, SettingToggle, type FieldDef } from '@/components/admin/admin-form';
import { MemberActions } from '@/components/admin/member-actions';

export const dynamic = 'force-dynamic';

const PLAN_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Plan name', span: 2 },
  { name: 'duration_days', label: 'Length (days)', type: 'number' },
  { name: 'sort_order', label: 'Order on page', type: 'number' },
  { name: 'description', label: 'Short description', span: 4 },
  { name: 'price_in', label: 'Price India (₹)', type: 'money', hint: 'Blank = not sold in India' },
  { name: 'price_t1', label: 'Price Tier 1 ($)', type: 'money' },
  { name: 'price_t2', label: 'Price Tier 2 ($)', type: 'money' },
  { name: 'price_t3', label: 'Price Rest of world ($)', type: 'money' },
  { name: 'download_limit', label: 'Wallpapers per pass', type: 'number' },
  { name: 'includes_commercial', label: 'Commercial licence included', type: 'checkbox' },
  { name: 'active', label: 'On sale', type: 'checkbox' },
  { name: 'perks', label: 'Extra perks shown on the card (one per line)', type: 'lines' },
];

interface Plan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  prices: Record<string, number>;
  download_limit: number;
  includes_commercial: boolean;
  perks: string[];
  active: boolean;
  sort_order: number;
}

export default async function AdminMembershipPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const [settings, { data: plans }, { data: members }, users] = await Promise.all([
    getSettings(),
    supabase.from('membership_plans').select('*').order('sort_order'),
    supabase
      .from('memberships')
      .select('id, user_id, starts_at, ends_at, download_limit, downloads_used, status, note, membership_plans(name)')
      .order('ends_at', { ascending: false })
      .limit(300),
    listAuthUsers().catch(() => []),
  ]);
  const email = new Map(users.map((u) => [u.id, u.email]));
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
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Membership</h1>
        <p className="text-sm text-muted-foreground">
          Prepaid passes (no auto-renew). Members add wallpapers to their library up to the plan&rsquo;s allowance, and keep them.
        </p>
      </div>

      <section className="rounded-2xl border bg-card px-6 py-2">
        <SettingToggle
          settingKey="membership_enabled"
          value={settings.membership_enabled}
          label="Sell membership passes"
          hint={`Shows plans marked "On sale" on the Pricing page. ${activeCount} active member(s).`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Plans</h2>
        {((plans ?? []) as Plan[]).map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <p className="font-medium">{p.name}</p>
              <Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'on sale' : 'off'}</Badge>
            </div>
            <AdminForm
              action={`/api/admin/plans/${p.id}`}
              deleteAction={`/api/admin/plans/${p.id}`}
              deleteConfirm="Delete this plan? (If anyone bought it, it will be switched off instead.)"
              fields={PLAN_FIELDS}
              initial={{
                ...p,
                price_in: p.prices.IN ?? null,
                price_t1: p.prices.T1 ?? null,
                price_t2: p.prices.T2 ?? null,
                price_t3: p.prices.T3 ?? null,
              }}
            />
          </div>
        ))}
        <details className="rounded-2xl border border-dashed bg-card p-5">
          <summary className="cursor-pointer font-medium">+ Add a plan</summary>
          <div className="mt-4">
            <AdminForm
              action="/api/admin/plans"
              method="POST"
              submitLabel="Create plan"
              resetOnSuccess
              fields={PLAN_FIELDS}
              initial={{ duration_days: 30, download_limit: 30, sort_order: 30, active: false }}
            />
          </div>
        </details>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Members</h2>
        <details className="rounded-2xl border border-dashed bg-card p-5">
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
          <ul className="divide-y rounded-2xl border bg-card text-sm">
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
