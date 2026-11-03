'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

/** "Get it free today" for today's pick. */
export function DailyClaimButton({ signedIn, next, size = 'default' }: { signedIn: boolean; next: string; size?: 'default' | 'lg' }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonVariants({ size, className: 'w-full' })}>
        Sign in to get it free
      </Link>
    );
  }
  if (state === 'done') {
    return (
      <Link href="/library" className={buttonVariants({ size, className: 'w-full' })}>
        In your library — download →
      </Link>
    );
  }
  return (
    <div className="w-full space-y-1">
      <Button
        size={size}
        className="w-full"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          const res = await fetch('/api/daily/claim', { method: 'POST' }).catch(() => null);
          const data = (await res?.json().catch(() => null)) as { error?: string } | null;
          if (res?.ok) setState('done');
          else {
            setState('error');
            setMsg(data?.error ?? 'Please try again.');
          }
        }}
      >
        {state === 'busy' ? 'Adding…' : 'Get it free today'}
      </Button>
      {state === 'error' && <p className="text-xs text-rose-600">{msg}</p>}
    </div>
  );
}
