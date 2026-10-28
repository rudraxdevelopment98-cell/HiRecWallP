import Link from 'next/link';
import type { Metadata } from 'next';
import { XCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Payment failed' };

export default function PaymentFailurePage() {
  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-rose-600">
        <XCircle className="h-8 w-8" />
      </div>
      <h1 className="font-display text-2xl font-semibold">Payment Failed</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong and your payment didn’t go through. No money was taken — please try
        again or use a different method.
      </p>
      <div className="mt-2 flex gap-3">
        <Link href="/checkout" className={buttonVariants()}>
          Try Again
        </Link>
        <Link href="/cart" className={buttonVariants({ variant: 'outline' })}>
          Back to Cart
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Need help? <Link href="/contact" className="underline">Contact support</Link>.
      </p>
    </main>
  );
}
