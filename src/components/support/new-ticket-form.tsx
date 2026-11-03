'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABEL, TICKET_CATEGORIES, type TicketCategory } from '@/lib/support-rules';
import { startNavigationProgress } from '@/components/navigation-progress';

interface OrderOption {
  id: string;
  label: string;
}

const HINT: Record<TicketCategory, string> = {
  refund: 'Tell us which order and why. Unused packs, unused passes and unredeemed gifts can also be refunded instantly from Orders.',
  download: 'Which wallpaper, which size, and what happened (error message, file won’t open…).',
  wrong_charge: 'When you were charged, the amount, and the last 4 digits or UPI id if you have them.',
  quality: 'Which wallpaper and size, your device and screen resolution, and what looks wrong.',
  account: 'What you were trying to do and what happened.',
  other: 'Tell us what you need.',
};

/** Customer support request form. */
export function NewTicketForm({ orders, initialOrderId, initialCategory }: { orders: OrderOption[]; initialOrderId?: string; initialCategory?: TicketCategory }) {
  const router = useRouter();
  const [category, setCategory] = useState<TicketCategory>(initialCategory ?? (initialOrderId ? 'refund' : 'download'));
  const [orderId, setOrderId] = useState(initialOrderId ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const form = new FormData(e.currentTarget);
        const res = await fetch('/api/support/tickets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ category, subject, body, orderId: orderId || null, website: form.get('website') || undefined }),
        }).catch(() => null);
        const data = (await res?.json().catch(() => null)) as { id?: string; error?: string } | null;
        if (res?.ok && data?.id) {
          startNavigationProgress();
          router.push(`/account/support/${data.id}?new=1`);
          return;
        }
        setBusy(false);
        setError(data?.error ?? 'Could not send your request. Please try again.');
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">What is it about?</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Order (optional)</span>
          <select className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Not about a specific order</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Subject</span>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} required minLength={3} placeholder="e.g. 4K download doesn’t open" />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Details</span>
        <textarea className="input min-h-36" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required minLength={10} />
        <span className="block text-xs text-muted-foreground">{HINT[category]}</span>
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send request'}
      </Button>
    </form>
  );
}
