'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Variant = 'phone' | 'desktop_4k' | 'tablet' | 'free_phone' | 'free_desktop';

/**
 * Requests a short-lived signed URL from /api/download and navigates to it.
 * The URL expires in ~60s and is never stored.
 */
export function DownloadButton({
  wallpaperId,
  variant,
  label,
}: {
  wallpaperId: string;
  variant: Variant;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallpaperId, variant }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Download failed');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <Button size="sm" variant="outline" onClick={download} disabled={busy}>
        {busy ? '…' : label}
      </Button>
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </span>
  );
}
