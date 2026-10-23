'use client';

import { useState } from 'react';
import { LegalNotice } from '@/components/legal-notice';
import { Button } from '@/components/ui/button';

type Status = 'idle' | 'submitting' | 'ok' | 'error';

export default function ContactTakedownPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch('/api/takedown', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reporter_email: form.get('reporter_email'),
          url: form.get('url'),
          details: form.get('details'),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('ok');
      setMessage('Thanks — we have received your report and will review it.');
    } catch {
      setStatus('error');
      setMessage('Could not submit right now. Please email us directly.');
    }
  }

  return (
    <main className="container max-w-2xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Contact & takedown</h1>
      <p className="text-sm text-muted-foreground">
        Report copyright/IP concerns, trademarked content, or any wallpaper that should be removed.
      </p>
      <LegalNotice />

      {status === 'ok' ? (
        <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm">
          {message}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="reporter_email" className="text-sm font-medium">
              Your email
            </label>
            <input
              id="reporter_email"
              name="reporter_email"
              type="email"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="url" className="text-sm font-medium">
              Wallpaper URL (if applicable)
            </label>
            <input
              id="url"
              name="url"
              type="url"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="details" className="text-sm font-medium">
              Details
            </label>
            <textarea
              id="details"
              name="details"
              required
              rows={5}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          {status === 'error' && <p className="text-sm text-red-500">{message}</p>}
          <Button type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Submitting…' : 'Submit report'}
          </Button>
        </form>
      )}
    </main>
  );
}
