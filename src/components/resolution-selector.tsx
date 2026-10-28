'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { key: 'mobile', label: 'Mobile', size: '1080×2340' },
  { key: 'desktop_4k', label: 'Desktop 4K', size: '3840×2160' },
  { key: 'ultrawide', label: 'Ultrawide', size: '5120×2160' },
  { key: 'desktop_5k', label: '5K', size: '5120×2880' },
];

/** Visual resolution/device picker for the product detail page. */
export function ResolutionSelector() {
  const [active, setActive] = useState(1);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Choose Your Resolution</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPTIONS.map((o, i) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              'rounded-xl border p-3 text-left transition-colors',
              i === active ? 'border-foreground bg-secondary' : 'hover:border-foreground/40',
            )}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.size}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
