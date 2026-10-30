import 'server-only';

import { createClient } from '@/lib/supabase/server';

export interface OrderLine {
  label: string;
  detail: string;
  amount: number | null; // unit price in rupees for INR lines; null for packs (priced on the order)
}

export interface OrderSummary {
  id: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  currency: string;
  amount_minor: number;
  created_at: string;
  paid_at: string | null;
  invoice_no: string | null;
  buyer_gstin: string | null;
  billing_country: string | null;
  lines: OrderLine[];
}

type Row = Omit<OrderSummary, 'lines'> & {
  order_items: {
    unit_price: number | null;
    licence: string | null;
    wallpapers: { title: string; slug: string } | null;
    credit_packs: { credits: number } | null;
  }[];
};

const SELECT =
  'id, status, currency, amount_minor, created_at, paid_at, invoice_no, buyer_gstin, billing_country, order_items(unit_price, licence, wallpapers(title, slug), credit_packs(credits))';

function toSummary(r: Row): OrderSummary {
  const { order_items, ...rest } = r;
  return {
    ...rest,
    lines: (order_items ?? []).map((i) =>
      i.credit_packs
        ? { label: `${i.credit_packs.credits} credits`, detail: 'Credit pack', amount: null }
        : {
            label: i.wallpapers?.title ?? 'Wallpaper',
            detail: `${i.licence === 'commercial' ? 'Commercial' : 'Personal'} licence`,
            amount: i.unit_price != null ? Number(i.unit_price) : null,
          },
    ),
  };
}

/** The signed-in user's orders, newest first (RLS limits to own rows). */
export async function listMyOrders(): Promise<OrderSummary[]> {
  const { data } = await createClient()
    .from('orders')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<Row[]>();
  return (data ?? []).map(toSummary);
}

export async function getMyOrder(id: string): Promise<OrderSummary | null> {
  const { data } = await createClient().from('orders').select(SELECT).eq('id', id).maybeSingle<Row>();
  return data ? toSummary(data) : null;
}
