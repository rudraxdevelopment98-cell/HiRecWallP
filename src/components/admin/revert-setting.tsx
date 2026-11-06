'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';

export function RevertSettingButton({ id }: { id: number }) {
  const { refresh, refreshing } = useRefresh();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!confirm) {
    return (
      <Button size="sm" variant="outline" disabled={refreshing} onClick={() => setConfirm(true)}>
        Revert
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      <Button
        size="sm"
        disabled={busy || refreshing}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await fetch(`/api/admin/settings/history/${id}/revert`, { method: 'POST' }).catch(() => null);
          setBusy(false);
          if (res?.ok) {
            setConfirm(false);
            refresh();
          } else setErr(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not revert');
        }}
      >
        {busy ? '…' : 'Yes, revert'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Cancel
      </Button>
      {err && <span className="w-full text-xs text-rose-700">{err}</span>}
    </span>
  );
}
