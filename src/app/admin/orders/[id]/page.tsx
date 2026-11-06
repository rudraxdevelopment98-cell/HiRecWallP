import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { RefundForm } from '@/components/admin/refund-form';

export const dynamic = 'force-dynamic';

export default async function AdminOrderPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = createServiceClient();
  const [{ data: o }, { data: ents }, { data: log }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, profiles!orders_user_id_fkey(id, email, display_name), order_items(unit_price, licence, wallpapers(id, title, slug), credit_packs(credits), membership_plans(name, duration_days))')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('entitlements').select('id, licence, downloads_used, max_downloads, wallpapers(title)').eq('order_id', id),
    supabase.from('admin_audit').select('action, actor_email, details, created_at').eq('target_type', 'order').eq('target_id', id).order('created_at', { ascending: false }),
  ]);
  if (!o) notFound();
  type Item = { unit_price: number | null; licence: string | null; wallpapers: { id: string; title: string; slug: string } | null; credit_packs: { credits: number } | null; membership_plans: { name: string; duration_days: number } | null };
  const items = (o.order_items ?? []) as unknown as Item[];
  const customer = o.profiles as unknown as { id: string; email: string | null; display_name: string | null } | null;

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/orders" className="text-sm underline">
        ← Orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{formatMoneyMinor(o.amount_minor as number, o.currency as string)}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(o.created_at as string).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })} · {o.provider as string}
            {o.invoice_no && ` · ${o.invoice_no}`}
          </p>
        </div>
        <Badge variant={o.status === 'paid' ? 'default' : 'secondary'}>{o.status as string}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="admin-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Customer</h2>
          {customer ? (
            <Link href={`/admin/customers/${customer.id}`} className="underline">
              {customer.email ?? customer.id}
            </Link>
          ) : (
            '—'
          )}
          <dl className="mt-3 space-y-1 text-muted-foreground">
            <div>Billing country: {(o.billing_country as string) ?? '—'}</div>
            <div>GSTIN: {(o.buyer_gstin as string) ?? '—'}</div>
            <div>Razorpay order: {(o.provider_order_id as string) ?? '—'}</div>
            <div>Razorpay payment: {(o.provider_payment_id as string) ?? '—'}</div>
          </dl>
        </section>
        <section className="admin-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Items</h2>
          <ul className="space-y-1">
            {items.map((i, n) => (
              <li key={n} className="flex justify-between gap-2">
                <span>
                  {i.credit_packs
                    ? `${i.credit_packs.credits} credits`
                    : i.membership_plans
                      ? `Pass: ${i.membership_plans.name} (${i.membership_plans.duration_days} days)`
                      : i.wallpapers
                        ? <Link href={`/admin/catalogue/${i.wallpapers.id}`} className="underline">{i.wallpapers.title}</Link>
                        : 'Wallpaper'}
                  {i.licence === 'commercial' && <span className="text-muted-foreground"> · commercial</span>}
                </span>
                {i.unit_price != null && o.currency === 'INR' && <span className="tabular-nums">₹{Number(i.unit_price)}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-card p-5 text-sm">
        <h2 className="mb-2 font-semibold">What this order unlocked</h2>
        {(ents ?? []).length === 0 ? (
          <p className="text-muted-foreground">No wallpapers currently unlocked by this order.</p>
        ) : (
          <ul className="space-y-1">
            {((ents ?? []) as unknown as { id: string; licence: string; downloads_used: number; max_downloads: number; wallpapers: { title: string } | null }[]).map((e) => (
              <li key={e.id}>
                {e.wallpapers?.title ?? 'Wallpaper'} · {e.licence} · {e.downloads_used}/{e.max_downloads} downloads used
              </li>
            ))}
          </ul>
        )}
      </section>

      {o.status === 'paid' && (
        <section className="admin-card p-5">
          <h2 className="mb-3 font-semibold">Refund</h2>
          <RefundForm orderId={id} canRefundAtProvider={Boolean(o.provider_payment_id)} />
        </section>
      )}

      {(log ?? []).length > 0 && (
        <section className="admin-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">History</h2>
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
