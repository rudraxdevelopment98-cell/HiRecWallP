'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { addItem, type CartItem } from '@/lib/cart';

/** Add every paid wallpaper in a set to the cart in one click. */
export function AddSetToCart({ items }: { items: CartItem[] }) {
  const [added, setAdded] = useState(false);
  if (items.length === 0) return null;
  if (added) {
    return (
      <Link href="/cart" className={buttonVariants({ size: 'lg' })}>
        Added {items.length} — go to cart →
      </Link>
    );
  }
  return (
    <Button
      size="lg"
      onClick={() => {
        items.forEach(addItem);
        setAdded(true);
      }}
    >
      <ShoppingBag className="mr-1 h-4 w-4" /> Add all {items.length} to cart
    </Button>
  );
}
