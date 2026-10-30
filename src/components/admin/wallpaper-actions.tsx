'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/** Row actions: publish / unpublish / archive / edit / delete. */
export function WallpaperActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Failed');
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status !== 'published' && (
        <Button size="sm" disabled={busy} onClick={() => call('/api/admin/publish', 'POST', { wallpaperId: id })}>
          Publish
        </Button>
      )}
      {status === 'published' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => call(`/api/admin/wallpapers/${id}`, 'PATCH', { status: 'draft' })}>
          Unpublish
        </Button>
      )}
      {status !== 'archived' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => call(`/api/admin/wallpapers/${id}`, 'PATCH', { status: 'archived' })}>
          Archive
        </Button>
      )}
      <Link href={`/admin/catalogue/${id}`} className="rounded-md border px-3 py-1.5 text-xs hover:bg-secondary">
        Edit
      </Link>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          if (confirm('Delete this wallpaper and its files permanently?')) void call(`/api/admin/wallpapers/${id}`, 'DELETE');
        }}
      >
        Delete
      </Button>
      {error && <span className="w-full text-right text-xs text-rose-600">{error}</span>}
    </div>
  );
}
