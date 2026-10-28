import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Payment successful' };

export default function PaymentSuccessPage({ searchParams }: { searchParams: { order?: string } }) {
  const order = searchParams.order ?? 'WPC-000000';
  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="font-display text-2xl font-semibold">Payment Successful!</h1>
      <p className="text-sm text-muted-foreground">
        Your order has been confirmed. Order <strong>{order}</strong>. You can download your
        wallpapers any time from your library.
      </p>
      <div className="mt-2 flex gap-3">
        <Link href="/library" className={buttonVariants()}>
          View My Downloads
        </Link>
        <Link href="/explore" className={buttonVariants({ variant: 'outline' })}>
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
