'use client';

import { useState } from 'react';
import { Gift } from 'lucide-react';
import { BuyButton } from '@/components/pricing/buy-pack-button';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "Send as a gift": collect the friend's email + a note, then pay as usual. */
export function GiftPackButton({ packId, credits }: { packId: string; credits: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [from, setFrom] = useState('');
  const [message, setMessage] = useState('');
  const ready = EMAIL.test(email.trim()) && from.trim().length > 0;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground">
        <Gift className="h-3.5 w-3.5" /> Send as a gift
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-xl border p-3 text-left text-sm">
      <p className="font-medium">Gift {credits} credits</p>
      <label className="block">
        <span className="text-xs text-muted-foreground">Friend&rsquo;s email</span>
        <input id={`gift-email-${packId}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="friend@example.com" />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">From (your name)</span>
        <input id={`gift-from-${packId}`} value={from} maxLength={60} onChange={(e) => setFrom(e.target.value)} className="input" />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">Message (optional)</span>
        <textarea id={`gift-msg-${packId}`} value={message} maxLength={300} rows={2} onChange={(e) => setMessage(e.target.value)} className="input" placeholder="Happy Diwali!" />
      </label>
      {ready ? (
        <BuyButton
          body={{ type: 'credit_pack', creditPackId: packId, gift: { email: email.trim(), from: from.trim(), message: message.trim() } }}
          label="Pay and send gift"
          description={`Gift: ${credits} credits`}
          successUrl="/account/gifts?bought=1"
        />
      ) : (
        <p className="text-xs text-muted-foreground">Add their email and your name to continue.</p>
      )}
      <p className="text-xs text-muted-foreground">We email them a code (valid 12 months). You&rsquo;ll also see it in Account → Gifts to share yourself.</p>
      <button type="button" onClick={() => setOpen(false)} className="text-xs underline">
        Cancel
      </button>
    </div>
  );
}
