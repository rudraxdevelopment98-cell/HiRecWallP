'use client';

import { useEffect, useRef } from 'react';

type EventType = 'view' | 'detail_view' | 'preview_zoom' | 'free_download';

/** Fires a single analytics event on mount (fire-and-forget). */
export function TrackEvent({ type, wallpaperId }: { type: EventType; wallpaperId?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, wallpaperId }),
      keepalive: true,
    }).catch(() => {});
  }, [type, wallpaperId]);
  return null;
}
