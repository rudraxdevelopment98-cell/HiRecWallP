'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CreditCard, Landmark, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearCart, getCart, type CartItem } from '@/lib/cart';
import { formatRegionPrice } from '@/lib/format';
import { isRegionCode, type RegionCode } from '@/lib/geo';
import { cn } from '@/lib/utils';

function regionFromCookie(): RegionCode {
  if (typeof document === 'undefined') return 'T3';
  const m = document.cookie.match(/(?:^|; )region=([^;]+)/);
  return isRegionCode(m?.[1]) ? (m![1] as RegionCode) : 'T3';
}

const METHODS = [
  { key: 'card', label: 'Credit / Debit Card', icon: CreditCard },
  { key: 'upi', label: 'UPI', icon: Wallet },
  { key: 'paypal', label: 'PayPal', icon: Landmark },
];

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [method, setMethod] = useState(0);
  const [busy, setBusy] = useState(false);
  const region = regionFromCookie();

  useEffect(() => {
    setItems(getCart());
  }, []);

  const subtotal = items.reduce((s, i) => s + (i.price ?? 0), 0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    // Demo flow: a real deployment hands off to Razorpay Checkout via
    // /api/checkout/create-order here. We simulate a confirmed order.
    const order = `WPC-${Math.floor(100000 + Math.random() * 900000)}`;
    setTimeout(() => {
      clearCart();
      router.push(`/checkout/success?order=${order}`);
    }, 700);
  }

  if (items.length === 0) {
    return (
      <main className="container py-16 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <a href="/explore" className="mt-3 inline-block underline">Browse wallpapers</a>
      </main>
    );
  }

  return (
    <main className="container py-10">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Secure Checkout</h1>
      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <Section title="Contact Information">
            <input required type="email" placeholder="Email address" className="input" />
          </Section>

          <Section title="Payment Method">
            <div className="grid gap-2 sm:grid-cols-3">
              {METHODS.map((m, i) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(i)}
                  className={cn('flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors', i === method ? 'border-foreground bg-secondary' : 'hover:border-foreground/40')}
                >
                  <m.icon className="h-4 w-4" /> {m.label}
                </button>
              ))}
            </div>
            {method === 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input placeholder="Card number" className="input sm:col-span-2" />
                <input placeholder="MM / YY" className="input" />
                <input placeholder="CVC" className="input" />
              </div>
            )}
          </Section>

          <Section title="Apply Coupon">
            <div className="flex gap-2">
              <input placeholder="Coupon code" className="input flex-1" />
              <Button type="button" variant="outline">Apply</Button>
            </div>
          </Section>

          <Section title="Billing Address">
            <div className="grid gap-2 sm:grid-cols-2">
              <input placeholder="Full name" className="input sm:col-span-2" />
              <input placeholder="Country" className="input" />
              <input placeholder="Postal code" className="input" />
            </div>
          </Section>
        </div>

        <div className="h-fit rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 text-sm">
                <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {i.image && <Image src={i.image} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <span className="min-w-0 flex-1 truncate">{i.title}</span>
                <span>{i.priceLabel}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{formatRegionPrice(subtotal, region)}</dd>
            </div>
          </dl>
          <Button type="submit" className="mt-5 w-full" disabled={busy}>
            {busy ? 'Processing…' : 'Proceed to Download'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Demo checkout — real payment uses Razorpay when configured.
          </p>
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
