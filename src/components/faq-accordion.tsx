'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface Faq {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-medium"
          >
            {item.q}
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</p>}
        </div>
      ))}
    </div>
  );
}
