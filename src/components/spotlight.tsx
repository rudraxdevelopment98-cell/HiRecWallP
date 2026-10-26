'use client';

import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Card surface with a cursor-following radial "spotlight" and a gradient hover
 * border. Pure CSS vars updated on pointer move; harmless without motion.
 */
export function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  return (
    <div ref={ref} onPointerMove={onMove} className={cn('spotlight-card', className)}>
      {children}
    </div>
  );
}
