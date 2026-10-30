'use client';

import { useEffect, useState } from 'react';

/**
 * Favourites, shared across every heart on the page. Real wallpapers are
 * saved to the account (needs sign-in); demo catalogue items (non-uuid ids)
 * are kept in this browser so the preview site stays fully usable.
 */
const LOCAL_KEY = 'hw_favs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let ids = new Set<string>();
let signedIn = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function writeLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids].filter((id) => !UUID.test(id))));
  } catch {
    /* storage blocked */
  }
}

function load(): Promise<void> {
  if (!loading) {
    loading = fetch('/api/favourites', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ signedIn: boolean; ids: string[] }>)
      .catch(() => ({ signedIn: false, ids: [] as string[] }))
      .then((res) => {
        signedIn = res.signedIn;
        ids = new Set([...res.ids, ...readLocal()]);
        emit();
      });
  }
  return loading;
}

export async function toggleFavourite(id: string): Promise<void> {
  await load();
  const on = !ids.has(id);
  if (!UUID.test(id)) {
    if (on) ids.add(id);
    else ids.delete(id);
    writeLocal();
    emit();
    return;
  }
  if (!signedIn) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  // Optimistic update; revert on failure.
  if (on) ids.add(id);
  else ids.delete(id);
  emit();
  const res = await fetch('/api/favourites', {
    method: on ? 'POST' : 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallpaperId: id }),
  }).catch(() => null);
  if (!res?.ok) {
    if (on) ids.delete(id);
    else ids.add(id);
    emit();
  }
}

export function useFavourite(id: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(ids.has(id));
    listeners.add(update);
    load().then(update);
    return () => {
      listeners.delete(update);
    };
  }, [id]);
  return on;
}

export function localFavouriteIds(): string[] {
  return readLocal();
}
