'use client';

import { useState } from 'react';
import { useRefresh } from '@/lib/use-refresh';
import { Button } from '@/components/ui/button';

export function PublishButton({ wallpaperId }: { wallpaperId: string }) {
  const { refresh, refreshing } = useRefresh();
  const [busy, setBusy] = useState(false);

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallpaperId }),
      });
      if (res.ok) refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={publish} disabled={busy || refreshing}>
      {busy || refreshing ? 'Publishing…' : 'Publish'}
    </Button>
  );
}
