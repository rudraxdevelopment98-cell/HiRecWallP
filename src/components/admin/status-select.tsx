'use client';

import { useState } from 'react';
import { useRefresh } from '@/lib/use-refresh';

/** Inline status dropdown that PATCHes `url` with `{ ...extra, [field]: value }`. */
export function StatusSelect({
  url,
  value,
  options,
  field = 'status',
  extra,
}: {
  url: string;
  value: string;
  options: string[];
  field?: string;
  extra?: Record<string, unknown>;
}) {
  const { refresh, refreshing } = useRefresh();
  const [busy, setBusy] = useState(false);
  return (
    <select
      defaultValue={value}
      disabled={busy || refreshing}
      aria-label="Status"
      className="rounded-md border bg-background px-2 py-1 text-xs"
      onChange={async (e) => {
        setBusy(true);
        await fetch(url, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...extra, [field]: e.target.value }),
        }).catch(() => null);
        setBusy(false);
        refresh();
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
