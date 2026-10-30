'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Row actions for a membership: +30 days, +allowance, revoke/restore. */
export function MemberActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/members/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  const btn = 'rounded-md border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50';
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <button className={btn} disabled={busy} onClick={() => act({ action: 'extend', days: 30 })}>
        +30 days
      </button>
      <button className={btn} disabled={busy} onClick={() => act({ action: 'allowance', add: 10 })}>
        +10 wallpapers
      </button>
      {status === 'active' ? (
        <button className={btn} disabled={busy} onClick={() => confirm('Revoke this pass?') && act({ action: 'revoke' })}>
          Revoke
        </button>
      ) : (
        <button className={btn} disabled={busy} onClick={() => act({ action: 'restore' })}>
          Restore
        </button>
      )}
    </div>
  );
}
