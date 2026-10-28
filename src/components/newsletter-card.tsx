'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';

/** Newsletter sign-up (visual; stores nothing — wire to an ESP later). */
export function NewsletterCard() {
  const [done, setDone] = useState(false);
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
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
          className="flex gap-2"
        >
          <input
            type="email"
            required
            placeholder="Your email address"
            className="w-full rounded-full border bg-card px-4 py-2 text-sm outline-none focus:border-ring"
          />
          <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Subscribe
          </button>
        </form>
      )}
    </div>
  );
}
