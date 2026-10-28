'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Laptop, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEVICES = [
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
  { key: 'tablet', label: 'Tablet', icon: Tablet },
  { key: 'laptop', label: 'Laptop', icon: Laptop },
  { key: 'ultrawide', label: 'Ultrawide', icon: Monitor },
];
const MOODS = ['Calm', 'Energetic', 'Dark', 'Dreamy'];
const COLOURS = ['#111827', '#2563eb', '#059669', '#d97706', '#db2777', '#7c3aed'];
const PREVIEWS = ['/demo/nebula-drift.jpg', '/demo/aurora-veil.jpg', '/demo/amoled-void.jpg', '/demo/midnight-wave.jpg'];

export function StudioFinder() {
  const router = useRouter();
  const [device, setDevice] = useState(0);
  const [mood, setMood] = useState(0);
  const [colour, setColour] = useState(0);

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
          <select className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:border-ring">
            <option>Auto (recommended)</option>
            <option>4K · 3840×2160</option>
            <option>5K · 5120×2880</option>
            <option>8K · 7680×4320</option>
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

        <Step n={4} title="Pick a Colour">
          <div className="flex flex-wrap gap-2">
            {COLOURS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setColour(i)}
                aria-label={`colour ${i + 1}`}
                style={{ background: c }}
                className={cn('h-8 w-8 rounded-full border-2', i === colour ? 'border-foreground' : 'border-transparent')}
              />
            ))}
          </div>
        </Step>

        <Button size="lg" onClick={() => router.push('/explore')}>
          Generate My Wallpaper →
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Your Perfect Match</p>
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
