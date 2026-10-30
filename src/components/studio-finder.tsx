'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Laptop, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Each choice maps to a real Explore filter.
const DEVICES = [
  { key: 'Mobile', label: 'Mobile', icon: Smartphone },
  { key: 'Tablet', label: 'Tablet', icon: Tablet },
  { key: 'Desktop', label: 'Laptop / Desktop', icon: Laptop },
  { key: 'Ultrawide', label: 'Ultrawide', icon: Monitor },
];
const RESOLUTIONS = [
  { key: '', label: 'Any (recommended)' },
  { key: '4K', label: '4K or higher' },
  { key: '5K', label: '5K' },
];
const MOODS = ['Any', 'Calm', 'Dark', 'Nature', 'Minimal'];
const PREVIEWS = ['/demo/scene-1061.jpg', '/demo/scene-1039.jpg', '/demo/scene-1018.jpg', '/demo/scene-1022.jpg'];

export function StudioFinder() {
  const router = useRouter();
  const [device, setDevice] = useState(0);
  const [mood, setMood] = useState(0);
  const [res, setRes] = useState('');

  function showMatches() {
    const params = new URLSearchParams({ device: DEVICES[device]!.key });
    if (res) params.set('res', res);
    if (mood > 0) params.set('q', MOODS[mood]!.toLowerCase());
    router.push(`/explore?${params.toString()}`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-7">
        <Step n={1} title="Choose Your Device">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DEVICES.map((d, i) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDevice(i)}
                className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-colors', i === device ? 'border-foreground bg-secondary' : 'hover:border-foreground/40')}
              >
                <d.icon className="h-5 w-5" />
                <span className="text-xs">{d.label}</span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="Select Resolution">
          <select
            value={res}
            onChange={(e) => setRes(e.target.value)}
            aria-label="Resolution"
            className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:border-ring"
          >
            {RESOLUTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </Step>

        <Step n={3} title="Choose Mood">
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m, i) => (
              <button key={m} type="button" onClick={() => setMood(i)} className={cn('rounded-full border px-4 py-1.5 text-sm', i === mood ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}>
                {m}
              </button>
            ))}
          </div>
        </Step>

        <Button size="lg" onClick={showMatches}>
          Show my matches →
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Example</p>
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border">
          <Image src={PREVIEWS[mood % PREVIEWS.length]!} alt="preview" fill sizes="320px" className="object-cover transition-opacity duration-500" />
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
        {title}
      </p>
      {children}
    </div>
  );
}
