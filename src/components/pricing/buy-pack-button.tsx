'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { payWithRazorpay } from '@/lib/razorpay-client';

interface Status {
  payments: boolean;
  signedIn: boolean;
  email: string | null;
}

/**
 * Buy something directly with Razorpay (credit pack or membership pass).
 * Nothing is granted here — only the verified webhook does that; the
 * success page shows it arriving.
 */
export function BuyButton({
  body,
  label,
  description,
  successUrl,
  next = '/pricing',
  variant = 'default',
}: {
  body: Record<string, unknown>;
  label: string;
  description: string;
  successUrl: string;
  next?: string;
  variant?: 'default' | 'outline';
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/checkout/status', { cache: 'no-store' })
      .then((r) => r.json() as Promise<Status>)
      .then(setStatus)
      .catch(() => setStatus({ payments: false, signedIn: false, email: null }));
  }, []);

  if (!status) return <Button className="w-full" variant={variant} disabled>…</Button>;
  if (!status.payments) {
    return (
      <Button className="w-full" variant="outline" disabled>
        {variant === 'outline' ? 'Autopay opening soon' : 'Payments opening soon'}
      </Button>
    );
  }
  if (!status.signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonVariants({ variant, className: 'w-full' })}>
        Sign in to buy
      </Link>
    );
  }

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Checkout unavailable');
      const outcome = await payWithRazorpay({
        checkout: data.checkout,
        name: 'HirecWallp',
        description,
        email: status?.email,
      });
      if (outcome.status === 'success') window.location.href = successUrl;
      else if (outcome.reason) setError(outcome.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button className="w-full" variant={variant} onClick={buy} disabled={busy}>
        {busy ? 'Opening…' : label}
      </Button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        By paying you agree to the{' '}
        <Link href="/refunds" className="underline">
          Refund policy
        </Link>
        .
      </p>
    </>
  );
}

export function BuyPackButton({ packId, credits }: { packId: string; credits: number }) {
  return (
    <BuyButton
      body={{ type: 'credit_pack', creditPackId: packId }}
      label="Buy credits"
      description={`${credits} credits`}
      successUrl="/account/credits?bought=1"
    />
  );
}
