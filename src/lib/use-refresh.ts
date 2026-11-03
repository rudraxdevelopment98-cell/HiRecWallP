'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * `router.refresh()` inside a transition: `refreshing` stays true until the
 * re-rendered server data is on screen, so buttons can keep their busy state
 * through the whole save → refresh cycle (no "did it work?" double clicks).
 */
export function useRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  return { refresh, refreshing };
}
