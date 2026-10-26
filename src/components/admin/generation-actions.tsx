'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/** Approve (→ publish) or reject a generation job from the review queue. */
export function GenerationActions({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(kind: 'approve' | 'reject') {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/generation/${jobId}/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => act('approve')} disabled={busy !== null}>
        {busy === 'approve' ? 'Publishing…' : 'Approve & publish'}
      </Button>
      <Button size="sm" variant="outline" onClick={() => act('reject')} disabled={busy !== null}>
        Reject
      </Button>
      {msg && <span className="text-xs text-red-500">{msg}</span>}
    </div>
  );
}
