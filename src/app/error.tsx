'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

/** Route-level error boundary: friendly message + retry. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        Sorry — that didn&rsquo;t load. Please try again; if it keeps happening, contact us.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/contact" className={buttonVariants({ variant: 'outline' })}>
          Contact support
        </Link>
      </div>
    </main>
  );
}
