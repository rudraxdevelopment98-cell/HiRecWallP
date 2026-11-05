'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

async function post(url: string, body: unknown = {}): Promise<string | null> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return null;
  return ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.';
}

/** Change sign-in email (confirmed by link). */
export function ChangeEmailForm({ current }: { current: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  if (state === 'sent') {
    return (
      <p className="text-sm text-emerald-700" role="status">
        Check <strong>{email}</strong> (and your current inbox) for a confirmation link. Your email changes once you confirm.
      </p>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('busy');
        const err = await post('/api/account/email', { email });
        if (err) {
          setMsg(err);
          setState('error');
        } else setState('sent');
      }}
    >
      <label className="sr-only" htmlFor="new-email">
        New email
      </label>
      <input id="new-email" type="email" required className="input flex-1" placeholder={`New email (now ${current})`} value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" variant="outline" disabled={state === 'busy'}>
        {state === 'busy' ? 'Sending…' : 'Change email'}
      </Button>
      {state === 'error' && (
        <p className="text-sm text-rose-600 sm:basis-full" role="alert">
          {msg}
        </p>
      )}
    </form>
  );
}

/** Sign out on every device. */
export function SignOutEverywhere() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm('Sign out on all your devices, including this one?')) return;
          setBusy(true);
          const e = await post('/api/account/signout-all');
          if (e) {
            setErr(e);
            setBusy(false);
          } else window.location.href = '/login?signedout=all';
        }}
      >
        {busy ? 'Signing out…' : 'Sign out everywhere'}
      </Button>
      {err && <p className="text-sm text-rose-600">{err}</p>}
    </div>
  );
}

/** Danger zone: type your email to close the account. */
export function CloseAccountForm({ email, blocked }: { email: string; blocked: string | null }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (blocked) return <p className="text-sm text-muted-foreground">{blocked}</p>;
  if (!open) {
    return (
      <Button type="button" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => setOpen(true)}>
        Close my account…
      </Button>
    );
  }
  const match = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        const r = await post('/api/account/close', { confirm: typed });
        if (r) {
          setErr(r);
          setBusy(false);
        } else window.location.href = '/?closed=1';
      }}
    >
      <label htmlFor="confirm-email" className="block text-sm">
        Type <strong>{email}</strong> to confirm. This can’t be undone.
      </label>
      <input id="confirm-email" className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      {err && (
        <p className="text-sm text-rose-600" role="alert">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!match || busy} className="bg-rose-600 text-white hover:bg-rose-700">
          {busy ? 'Closing…' : 'Close account permanently'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Keep my account
        </Button>
      </div>
    </form>
  );
}
