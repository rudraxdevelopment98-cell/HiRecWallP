'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-render the server page a few times (e.g. while a webhook lands). */
export function AutoRefresh({ times = 10, everyMs = 3000 }: { times?: number; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= times) clearInterval(t);
    }, everyMs);
    return () => clearInterval(t);
  }, [router, times, everyMs]);
  return null;
}
