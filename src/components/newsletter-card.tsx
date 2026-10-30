'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';

/** Newsletter sign-up → /api/newsletter (export from Admin → Newsletter). */
export function NewsletterCard() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6">
      <div className="mb-2 inline-flex items-center gap-2 font-semibold">
        <Mail className="h-4 w-4" /> Stay Updated
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Get new collections, offers and wallpaper drops straight to your inbox.
      </p>
      {done ? (
        <p className="text-sm font-medium text-violet-700">Thanks — you’re on the list!</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const email = new FormData(e.currentTarget).get('email');
            const res = await fetch('/api/newsletter', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, source: 'home' }),
            }).catch(() => null);
            setBusy(false);
            if (res?.ok) setDone(true);
            else setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Please try again.');
          }}
          className="flex gap-2"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Your email address"
            className="w-full rounded-full border bg-card px-4 py-2 text-sm outline-none focus:border-ring"
          />
          <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? '…' : 'Subscribe'}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
