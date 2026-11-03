'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/** Creator onboarding: payout setup, KYC, and agreement acceptance. */
export function OnboardForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch('/api/creator/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: form.get('displayName'),
          payoutProvider: form.get('payoutProvider'),
          payoutAccountId: form.get('payoutAccountId'),
          acceptAgreement: form.get('acceptAgreement') === 'on',
          taxResident: form.get('taxResident'),
          entityType: form.get('entityType'),
          pan: form.get('pan') ?? '',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Onboarding failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          Creator display name
        </label>
        <input id="displayName" name="displayName" required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor="payoutProvider" className="text-sm font-medium">
          Payout method
        </label>
        <select id="payoutProvider" name="payoutProvider" className="w-full rounded-md border bg-background px-3 py-2 text-sm">
          <option value="razorpay_route">Razorpay Route (India)</option>
          <option value="paypal_payouts">PayPal Payouts (international)</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="payoutAccountId" className="text-sm font-medium">
          Payout account id / email
        </label>
        <input id="payoutAccountId" name="payoutAccountId" required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Tax details (for TDS on payouts)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Tax residence</span>
            <select id="taxResident" name="taxResident" className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="IN">India</option>
              <option value="foreign">Outside India</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">You are</span>
            <select id="entityType" name="entityType" className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="individual">An individual</option>
              <option value="huf">An HUF</option>
              <option value="firm">A firm / LLP</option>
              <option value="company">A company</option>
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">PAN (Indian residents)</span>
          <input id="pan" name="pan" maxLength={10} placeholder="ABCDE1234F" className="w-full rounded-md border bg-background px-3 py-2 text-sm uppercase" />
          <span className="block text-xs text-muted-foreground">
            By law we deduct TDS from creator payouts: 0.1% on sales (none for individuals under ₹5 lakh a year with PAN) and 2% on
            affiliate commission above ₹20,000 a year. Without a PAN the rates are higher (5% / 20%). You can claim TDS back in your tax return.
          </span>
        </label>
      </fieldset>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Creator agreement (summary)</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>You warrant you hold all rights to what you upload and grant {`HirecWallp`} a licence to sell it.</li>
          <li>No trademarked characters, brand logos, real people/celebrities, or NSFW content.</li>
          <li>Platform commission is 30% (configurable); payouts are monthly after KYC.</li>
          <li>AI-generated work must be disclosed. Placeholder terms — full agreement pending legal review.</li>
        </ul>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptAgreement" required /> I accept the creator agreement.
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? 'Submitting…' : 'Become a creator'}
      </Button>
    </form>
  );
}
