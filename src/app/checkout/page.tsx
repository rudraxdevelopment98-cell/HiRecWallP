'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, Landmark, Lock, Wallet } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { clearCart, getCart, type CartItem } from '@/lib/cart';
import { formatMoneyMinor, formatRegionPrice } from '@/lib/format';
import {
  REGION_PRICING_UNIT,
  chargeRegionFor,
  isRegionCode,
  regionForCountry,
  type RegionCode,
} from '@/lib/geo';
import { payWithRazorpay } from '@/lib/razorpay-client';
import { cn } from '@/lib/utils';

function regionFromCookie(): RegionCode {
  if (typeof document === 'undefined') return 'T3';
  const m = document.cookie.match(/(?:^|; )region=([^;]+)/);
  return isRegionCode(m?.[1]) ? (m![1] as RegionCode) : 'T3';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const METHODS = [
  { key: 'upi', label: 'UPI', icon: Wallet },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'netbanking', label: 'Netbanking', icon: Landmark },
] as const;

const COUNTRIES: [string, string][] = [
  ['IN', 'India'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['IE', 'Ireland'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['ES', 'Spain'],
  ['IT', 'Italy'],
  ['NL', 'Netherlands'],
  ['AE', 'United Arab Emirates'],
  ['SA', 'Saudi Arabia'],
  ['SG', 'Singapore'],
  ['JP', 'Japan'],
  ['KR', 'South Korea'],
  ['HK', 'Hong Kong'],
  ['ZZ', 'Other'],
];

interface Status {
  payments: boolean;
  signedIn: boolean;
  email: string | null;
}

interface Pack {
  id: string;
  credits: number;
  amount_minor: number;
  currency: string;
}

interface Shortfall {
  needed: number;
  balance: number;
  packs: Pack[];
}

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<'loading' | 'demo' | 'real'>('loading');
  const [method, setMethod] = useState(0);
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<Shortfall | null>(null);
  const [displayRegion, setDisplayRegion] = useState<RegionCode>('T3');

  useEffect(() => {
    setItems(getCart());
    const region = regionFromCookie();
    setDisplayRegion(region);
    setCountry(region === 'IN' ? 'IN' : '');
    fetch('/api/checkout/status', { cache: 'no-store' })
      .then((r) => r.json() as Promise<Status>)
      .then((s) => {
        setStatus(s);
        setMode(s.payments ? 'real' : 'demo');
      })
      .catch(() => setMode('demo'));
  }, []);

  // Demo catalogue items (non-uuid ids) can't be bought for real.
  const payable = useMemo(
    () => (mode === 'real' ? items.filter((i) => UUID.test(i.id)) : items),
    [items, mode],
  );
  const skipped = items.length - payable.length;
  const chargeRegion = country ? chargeRegionFor(displayRegion, regionForCountry(country)) : displayRegion;
  const payInCredits = REGION_PRICING_UNIT[chargeRegion] === 'credits';
  const subtotal = payable.reduce((s, i) => s + (i.price ?? 0), 0);
  const cartPayload = payable.map((i) => ({ wallpaperId: i.id, licence: i.licence ?? 'personal' }));

  function done(query: string) {
    clearCart();
    router.push(`/checkout/success?${query}`);
  }

  async function payMoney() {
    const res = await fetch('/api/checkout/create-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'cart', items: cartPayload, billingCountry: country }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.code === 'use_credits') {
      setError('Your billing country uses international pricing — pay with credits below.');
      return;
    }
    if (!res.ok) throw new Error(data.error ?? 'Checkout unavailable');

    const outcome = await payWithRazorpay({
      checkout: data.checkout,
      name: 'HirecWallp',
      description: `${payable.length} wallpaper${payable.length === 1 ? '' : 's'}`,
      email: status?.email,
      method: METHODS[method]?.key,
    });
    if (outcome.status === 'success') done(`order=${data.orderId}`);
    else if (outcome.reason) router.push(`/checkout/failure?reason=${encodeURIComponent(outcome.reason)}`);
  }

  async function unlockWithCredits(): Promise<boolean> {
    const res = await fetch('/api/credits/unlock-cart', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: cartPayload }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      done('credits=1');
      return true;
    }
    if (res.status === 402 && data.code === 'insufficient_credits') {
      const packsRes = await fetch(`/api/credits/packs?billingCountry=${country}`, { cache: 'no-store' });
      const { packs } = (await packsRes.json().catch(() => ({ packs: [] }))) as { packs: Pack[] };
      setShortfall({ needed: Number(data.needed ?? 0), balance: Number(data.balance ?? 0), packs });
      return false;
    }
    throw new Error(data.error ?? 'Unlock unavailable');
  }

  async function buyPack(pack: Pack) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'credit_pack', creditPackId: pack.id, billingCountry: country }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Checkout unavailable');

      const outcome = await payWithRazorpay({
        checkout: data.checkout,
        name: 'HirecWallp',
        description: `${pack.credits} credits`,
        email: status?.email,
      });
      if (outcome.status !== 'success') {
        if (outcome.reason) setError(outcome.reason);
        return;
      }

      // Credits arrive via the verified webhook; wait for them, then unlock.
      const target = shortfall?.needed ?? 0;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const b = await fetch('/api/credits/balance', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
        if (b && Number(b.balance) >= target) {
          await unlockWithCredits();
          return;
        }
      }
      setError('Payment received — credits are still being confirmed. They will appear in your library shortly; come back to finish unlocking.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (mode === 'demo') {
      setBusy(true);
      const order = `WPC-${Math.floor(100000 + Math.random() * 900000)}`;
      setTimeout(() => done(`order=${order}`), 700);
      return;
    }

    if (payable.length === 0) return;
    setBusy(true);
    try {
      if (payInCredits) await unlockWithCredits();
      else await payMoney();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="container py-16 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link href="/explore" className="mt-3 inline-block underline">
          Browse wallpapers
        </Link>
      </main>
    );
  }

  if (mode === 'real' && status && !status.signedIn) {
    return (
      <main className="container flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-2xl font-semibold">Sign in to check out</h1>
        <p className="text-sm text-muted-foreground">
          Purchases are saved to your library so you can re-download any time.
        </p>
        <Link href="/login?next=/checkout" className={buttonVariants()}>
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="container py-10">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Secure Checkout</h1>
      {mode === 'demo' && (
        <p className="mb-6 rounded-xl border bg-secondary px-4 py-3 text-sm text-muted-foreground" data-testid="demo-banner">
          Demo checkout — no payment is taken. Real payments switch on automatically once Razorpay
          and accounts are configured.
        </p>
      )}
      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <Section title="Billing Country">
            <select
              required={mode === 'real'}
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setShortfall(null);
                setError(null);
              }}
              className="input"
              aria-label="Billing country"
            >
              <option value="">Select the country your card or account is from</option>
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Prices follow your billing country. India pays per item in INR; elsewhere you unlock
              with credits.
            </p>
          </Section>

          {!payInCredits ? (
            <Section title="Payment Method">
              <div className="grid gap-2 sm:grid-cols-3">
                {METHODS.map((m, i) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(i)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors',
                      i === method ? 'border-foreground bg-secondary' : 'hover:border-foreground/40',
                    )}
                  >
                    <m.icon className="h-4 w-4" /> {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Card and UPI details are entered in Razorpay’s secure
                window — we never see or store them.
              </p>
            </Section>
          ) : (
            <Section title="Pay with Credits">
              <p className="text-sm text-muted-foreground">
                Your credit balance is used first. If it’s short, you can top up with a credit pack
                (international cards accepted) and we’ll finish the unlock automatically.
              </p>
              {shortfall && (
                <div className="mt-4 space-y-3" data-testid="credit-packs">
                  <p className="text-sm">
                    You need <strong>{shortfall.needed}</strong> credits and have{' '}
                    <strong>{shortfall.balance}</strong>.
                  </p>
                  {shortfall.packs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No credit packs available for this region yet.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {shortfall.packs.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          disabled={busy}
                          onClick={() => buyPack(p)}
                          className={cn(
                            'rounded-xl border p-3 text-left text-sm transition-colors hover:border-foreground/40',
                            p.credits + shortfall.balance < shortfall.needed && 'opacity-60',
                          )}
                        >
                          <span className="block font-semibold">{p.credits} credits</span>
                          <span className="text-muted-foreground">{formatMoneyMinor(p.amount_minor, p.currency)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="h-fit rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {payable.map((i) => (
              <li key={`${i.id}:${i.licence}`} className="flex items-center gap-3 text-sm">
                <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {i.image && <Image src={i.image} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <span className="min-w-0 flex-1 truncate">
                  {i.title}
                  {i.licence === 'commercial' && <span className="ml-1 text-xs text-muted-foreground">(commercial)</span>}
                </span>
                <span>{i.priceLabel}</span>
              </li>
            ))}
          </ul>
          {skipped > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {skipped} demo item{skipped === 1 ? '' : 's'} can’t be purchased and {skipped === 1 ? 'was' : 'were'} left out.
            </p>
          )}
          <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{formatRegionPrice(subtotal, displayRegion)}</dd>
            </div>
          </dl>
          {mode === 'real' && chargeRegion !== displayRegion && (
            <p className="mt-2 text-xs text-muted-foreground">
              Final price is recalculated for your billing country.
            </p>
          )}
          <Button
            type="submit"
            className="mt-5 w-full"
            disabled={busy || mode === 'loading' || payable.length === 0}
          >
            {busy ? 'Processing…' : payInCredits && mode === 'real' ? 'Unlock with Credits' : 'Proceed to Payment'}
          </Button>
          {error && (
            <p className="mt-3 text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </form>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
