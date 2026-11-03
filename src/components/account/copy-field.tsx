'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Read-only value with a Copy button (falls back to selecting the text). */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const id = `copy-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="flex gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} readOnly value={value} className="input font-mono" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            (document.getElementById(id) as HTMLInputElement | null)?.select();
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
