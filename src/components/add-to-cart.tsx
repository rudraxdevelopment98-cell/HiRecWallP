'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { addItem, getCart, type CartItem } from '@/lib/cart';

/** "Add to Cart" for the product detail page (client-side cart). */
export function AddToCart({
  item,
  label = 'Add to Cart',
  variant = 'default',
}: {
  item: CartItem;
  label?: string;
  variant?: 'default' | 'outline';
}) {
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    const sync = () => setInCart(getCart().some((i) => i.id === item.id && i.licence === item.licence));
    sync();
    window.addEventListener('cart:updated', sync);
    return () => window.removeEventListener('cart:updated', sync);
  }, [item.id, item.licence]);

  if (inCart) {
    return (
      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
        <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-medium text-emerald-600">
          <Check className="h-4 w-4" /> In your cart
        </span>
        <Link href="/cart" className={buttonVariants({ size: 'lg' })}>
          Go to cart →
        </Link>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      variant={variant}
      className="flex-1"
      onClick={() => {
        addItem(item);
        setInCart(true);
      }}
    >
      <ShoppingBag className="mr-1 h-4 w-4" /> {label}
    </Button>
  );
}
