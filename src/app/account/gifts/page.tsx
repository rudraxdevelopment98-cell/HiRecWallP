import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatGiftCode } from '@/lib/gift-rules';
import { CopyField } from '@/components/account/copy-field';
import { RedeemForm } from '@/components/gift/redeem-form';
import { AutoRefresh } from '@/components/account/auto-refresh';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Gifts' };

interface GiftRow {
  id: string;
  code: string;
  recipient_email: string | null;
  credits: number;
  bonus_credits: number;
  status: string;
  created_at: string;
  redeemed_at: string | null;
  purchaser_id: string;
}

export default async function GiftsPage(props: { searchParams: Promise<{ bought?: string }> }) {
  const user = await requireUser('/account/gifts');
  const { bought } = await props.searchParams;
  const { data } = await (await createClient())
    .from('gift_codes')
    .select('id, code, recipient_email, credits, bonus_credits, status, created_at, redeemed_at, purchaser_id')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as GiftRow[];
  const sent = rows.filter((g) => g.purchaser_id === user.id);
  const received = rows.filter((g) => g.purchaser_id !== user.id);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">Gifts</h1>
      {bought === '1' && sent.length === 0 && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Payment received — your gift code appears here as soon as the bank confirms.
          <AutoRefresh />
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Gifts you sent</h2>
          <Link href="/pricing" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            <Gift className="mr-1 h-4 w-4" /> Send a gift
          </Link>
        </div>
        {sent.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
            Pick a credit pack on the Pricing page and choose <strong>Send as a gift</strong>.
          </p>
        ) : (
          sent.map((g) => (
            <div key={g.id} className="space-y-2 rounded-2xl border bg-card p-5 text-sm">
              <p className="font-medium">
                {g.credits + g.bonus_credits} credits{g.recipient_email ? ` for ${g.recipient_email}` : ''}
                <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">{g.status === 'pending' ? 'not redeemed yet' : g.status}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Sent {fmt(g.created_at)}
                {g.redeemed_at ? ` · redeemed ${fmt(g.redeemed_at)}` : ''} · code {formatGiftCode(g.code)}
              </p>
              {g.status === 'pending' && (
                <>
                  <CopyField value={`${site}/gift/${g.code}`} label={`Gift link ${g.code}`} />
                  <a
                    className="text-xs underline"
                    href={`https://wa.me/?text=${encodeURIComponent(`I sent you ${g.credits + g.bonus_credits} wallpaper credits! Redeem here: ${site}/gift/${g.code}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Share on WhatsApp
                  </a>
                </>
              )}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Redeem a gift</h2>
        <div className="rounded-2xl border bg-card p-6">
          <RedeemForm signedIn />
        </div>
        {received.length > 0 && (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {received.map((g) => (
              <li key={g.id} className="flex justify-between p-4">
                <span>{g.credits + g.bonus_credits} credits received</span>
                <span className="text-muted-foreground">{g.redeemed_at ? fmt(g.redeemed_at) : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
