'use client';

export type TrackType = 'view' | 'detail_view' | 'preview_zoom' | 'free_download' | 'add_to_cart' | 'checkout_start';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fire-and-forget analytics event (funnel: view → detail → cart → checkout → purchase). */
export function track(type: TrackType, wallpaperId?: string): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, wallpaperId: wallpaperId && UUID.test(wallpaperId) ? wallpaperId : undefined }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics never breaks the page */
  }
}
