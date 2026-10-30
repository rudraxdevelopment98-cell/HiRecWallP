'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), email: form.get('email'), message: form.get('message') }),
      });
      if (!res.ok) throw new Error();
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'ok') {
    return <p className="rounded-xl border border-emerald-500/50 bg-emerald-50 p-4 text-sm">Thanks — we’ll get back to you shortly.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input name="name" required placeholder="Your name" className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:border-ring" />
      <input name="email" type="email" required placeholder="Your email" className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:border-ring" />
      <textarea name="message" required rows={5} placeholder="How can we help?" className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:border-ring" />
      {status === 'error' && <p className="text-sm text-red-500">Couldn’t send — please email support@hirecwallp.com directly.</p>}
      <Button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send Message'}</Button>
    </form>
  );
}
