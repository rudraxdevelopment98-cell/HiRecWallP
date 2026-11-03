'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

/** Redeem a gift code; on success links to the catalogue. */
export function RedeemForm({ initialCode = '', signedIn }: { initialCode?: string; signedIn: boolean }) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  if (!signedIn) {
    const next = `/gift${initialCode ? `/${initialCode}` : ''}`;
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonVariants({ className: 'w-full' })}>
        Sign in to redeem
      </Link>
    );
  }
  if (state === 'done') {
    return (
      <div className="space-y-3 text-center">
        <p className="text-emerald-700">{msg}</p>
        <Link href="/explore" className={buttonVariants({ className: 'w-full' })}>
          Start choosing wallpapers
        </Link>
      </div>
    );
  }
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('busy');
        const res = await fetch('/api/gifts/redeem', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code }),
        }).catch(() => null);
        const data = (await res?.json().catch(() => null)) as { credits?: number; error?: string } | null;
        if (res?.ok) {
          setState('done');
          setMsg(`${data?.credits ?? ''} credits added to your account.`);
        } else {
          setState('error');
          setMsg(data?.error ?? 'Could not redeem right now.');
        }
      }}
    >
      <label htmlFor="gift-code" className="block text-sm font-medium">
        Gift code
      </label>
      <input
        id="gift-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABCD-EFGH-JKLM"
        autoComplete="off"
        className="input text-center font-mono tracking-widest"
        required
      />
      <Button type="submit" className="w-full" disabled={state === 'busy'}>
        {state === 'busy' ? 'Redeeming…' : 'Redeem gift'}
      </Button>
      {state === 'error' && (
        <p className="text-sm text-rose-600" role="alert">
          {msg}
        </p>
      )}
    </form>
  );
}
