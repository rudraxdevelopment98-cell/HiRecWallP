'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin top progress bar that starts the moment an internal link is clicked
 * and completes when the new route renders, so every click gets instant
 * visual feedback (no "did that work?" double-clicking).
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Route changed → finish.
  useEffect(() => {
    setState((s) => (s === 'loading' ? 'done' : s));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 300);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (timer.current) clearTimeout(timer.current);
      setState('loading');
    }
    // Programmatic navigations (router.push from selects/forms) can opt in.
    const onStart = () => setState('loading');
    document.addEventListener('click', onClick, true);
    window.addEventListener('hw:navigate', onStart);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('hw:navigate', onStart);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      style={{ opacity: state === 'idle' ? 0 : 1, transition: 'opacity 200ms' }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
        style={{
          width: state === 'loading' ? '85%' : state === 'done' ? '100%' : '0%',
          transition: state === 'loading' ? 'width 8s cubic-bezier(0.1, 0.7, 0.2, 1)' : 'width 200ms ease-out',
        }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

/** Call before router.push() so the bar starts for programmatic navigation. */
export function startNavigationProgress() {
  window.dispatchEvent(new Event('hw:navigate'));
}
