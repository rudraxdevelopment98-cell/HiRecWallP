'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Crown } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

/** For members: add this wallpaper to the library using the pass. */
export function MemberClaimButton({ wallpaperId, remaining }: { wallpaperId: string; remaining: number }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  if (state === 'done') {
    return (
      <Link href="/library" className={buttonVariants({ size: 'lg', className: 'flex-1' })}>
        In your library — download →
      </Link>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-1">
      <Button
        size="lg"
        disabled={state === 'busy' || remaining <= 0}
        onClick={async () => {
          setState('busy');
          const res = await fetch('/api/membership/claim', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ wallpaperId }),
          }).catch(() => null);
          if (res?.ok) setState('done');
          else {
            setState('error');
            setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Failed');
          }
        }}
      >
        <Crown className="mr-1 h-4 w-4" />
        {remaining > 0 ? `Add with membership (${remaining} left)` : 'Membership allowance used'}
      </Button>
      {state === 'error' && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
