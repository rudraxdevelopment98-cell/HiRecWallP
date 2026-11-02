'use client';

import { useEffect, useRef } from 'react';

import { track, type TrackType } from '@/lib/track';

/** Fires a single analytics event on mount (fire-and-forget). */
export function TrackEvent({ type, wallpaperId }: { type: TrackType; wallpaperId?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(type, wallpaperId);
  }, [type, wallpaperId]);
  return null;
}
