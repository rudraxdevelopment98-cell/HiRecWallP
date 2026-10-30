'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { getCart, removeItem, type CartItem } from '@/lib/cart';
import { formatRegionPrice } from '@/lib/format';
import { isRegionCode, type RegionCode } from '@/lib/geo';

function regionFromCookie(): RegionCode {
  if (typeof document === 'undefined') return 'T3';
  const m = document.cookie.match(/(?:^|; )region=([^;]+)/);
  return isRegionCode(m?.[1]) ? (m![1] as RegionCode) : 'T3';
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const region = regionFromCookie();

  useEffect(() => {
    const update = () => setItems(getCart());
    update();
    window.addEventListener('cart:updated', update);
    return () => window.removeEventListener('cart:updated', update);
  }, []);

  const subtotal = items.reduce((s, i) => s + (i.price ?? 0), 0);

  return (
    <main className="container py-10">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Your Cart</h1>

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Link href="/explore" className={buttonVariants({ className: 'mt-4' })}>
            Browse wallpapers
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="divide-y rounded-2xl border bg-card">
            {items.map((i) => (
              <li key={`${i.id}:${i.licence}`} className="flex items-center gap-4 p-4">
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {i.image && <Image src={i.image} alt={i.title} fill sizes="80px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.resolution ?? '4K'} · {i.licence} licence
                  </p>
                </div>
                <span className="font-semibold">{i.priceLabel}</span>
                <button
                  type="button"
                  onClick={() => removeItem(i.id, i.licence)}
                  aria-label="Remove"
                  className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="h-fit rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatRegionPrice(subtotal, region)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd>{formatRegionPrice(subtotal, region)}</dd>
              </div>
            </dl>
            <Link href="/checkout" className={buttonVariants({ className: 'mt-5 w-full' })}>
              Proceed to Checkout
            </Link>
            <Link href="/explore" className="mt-2 block text-center text-sm text-muted-foreground hover:text-foreground">
              Continue shopping
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
