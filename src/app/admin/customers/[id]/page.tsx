import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { CustomerActions } from '@/components/admin/customer-actions';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = createServiceClient();
  const [{ data: profile }, authUser, { data: orders }, { data: ents }, { data: balance }, { data: ledger }, { data: passes }, { data: log }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.auth.admin.getUserById(id),
    supabase.from('orders').select('id, status, currency, amount_minor, created_at, invoice_no').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('entitlements').select('id, licence, downloads_used, max_downloads, created_at, order_id, wallpapers(id, title)').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.rpc('credit_balance', { p_user: id }),
    supabase.from('credit_ledger').select('delta, reason, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('memberships').select('id, ends_at, status, downloads_used, download_limit, note').eq('user_id', id).order('ends_at', { ascending: false }),
    supabase.from('admin_audit').select('action, actor_email, created_at').eq('target_type', 'user').eq('target_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  if (!profile) notFound();
  const u = authUser.data?.user;
  const blocked = Boolean(u?.banned_until && new Date(u.banned_until).getTime() > Date.now());
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/customers" className="text-sm underline">
        ← Customers
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{(profile.email as string) ?? id}</h1>
          <p className="text-sm text-muted-foreground">
            Joined {fmt(profile.created_at as string)}
            {u?.last_sign_in_at && ` · last sign-in ${fmt(u.last_sign_in_at)}`}
            {profile.country_code && ` · ${profile.country_code as string}`}
            {profile.gstin && ` · GSTIN ${profile.gstin as string}`}
            {profile.price_country ? ` · priced as ${profile.price_country as string}` : ' · price country not locked yet'}
            {profile.referred_by && ' · joined via referral'}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>{profile.role as string}</Badge>
          {blocked && <Badge variant="secondary">blocked</Badge>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid orders" value={String((orders ?? []).filter((o) => o.status === 'paid').length)} />
        <Stat label="Wallpapers owned" value={String((ents ?? []).length)} />
        <Stat label="Credit balance" value={String(Number(balance ?? 0))} />
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Actions</h2>
        <CustomerActions userId={id} blocked={blocked} role={profile.role as string} priceCountry={(profile.price_country as string | null) ?? null} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Orders</h2>
          {(orders ?? []).length === 0 ? (
            <p className="text-muted-foreground">No orders.</p>
          ) : (
            <ul className="divide-y">
              {(orders ?? []).map((o) => (
                <li key={o.id as string} className="flex justify-between gap-2 py-2">
                  <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                    {fmt(o.created_at as string)} {o.invoice_no ? `· ${o.invoice_no as string}` : ''}
                  </Link>
                  <span className="flex items-center gap-2 tabular-nums">
                    {formatMoneyMinor(o.amount_minor as number, o.currency as string)}
                    <Badge variant={o.status === 'paid' ? 'default' : 'secondary'}>{o.status as string}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Library</h2>
          {(ents ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nothing owned yet.</p>
          ) : (
            <ul className="divide-y">
              {((ents ?? []) as unknown as { id: string; licence: string; downloads_used: number; max_downloads: number; order_id: string | null; wallpapers: { id: string; title: string } | null }[]).map((e) => (
                <li key={e.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {e.wallpapers?.title ?? 'Wallpaper'} <span className="text-muted-foreground">· {e.licence}{e.order_id ? '' : ' · gifted/pass'}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {e.downloads_used}/{e.max_downloads}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Credits history</h2>
          {(ledger ?? []).length === 0 ? (
            <p className="text-muted-foreground">No credit activity.</p>
          ) : (
            <ul className="divide-y">
              {(ledger ?? []).map((l, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span>
                    {l.reason as string} · {fmt(l.created_at as string)}
                  </span>
                  <span className="font-mono tabular-nums">{Number(l.delta) > 0 ? `+${l.delta}` : (l.delta as number)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Membership passes</h2>
          {(passes ?? []).length === 0 ? (
            <p className="text-muted-foreground">No passes.</p>
          ) : (
            <ul className="divide-y">
              {(passes ?? []).map((p) => (
                <li key={p.id as string} className="flex justify-between py-2">
                  <span>
                    until {fmt(p.ends_at as string)} · {p.downloads_used as number}/{p.download_limit as number} used
                  </span>
                  <Badge variant="secondary">{p.status as string}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/membership" className="mt-2 inline-block text-xs underline">
            Manage passes →
          </Link>
        </section>
      </div>

      {(log ?? []).length > 0 && (
        <section className="rounded-2xl border bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Admin history</h2>
          <ul className="space-y-1 text-muted-foreground">
            {(log ?? []).map((l, i) => (
              <li key={i}>
                {new Date(l.created_at as string).toLocaleString('en-IN')} · {l.action as string} by {(l.actor_email as string) ?? 'system'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
