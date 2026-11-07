import type { Metadata } from 'next';
import Link from 'next/link';
import { DEVICES } from '@/lib/fit';

export const metadata: Metadata = {
  title: 'Wallpapers by Device – iPhone, Samsung Galaxy, Pixel, iPad, MacBook & 4K Monitors',
  description: 'Find wallpapers that fit your exact screen: iPhone, Galaxy, Pixel, OnePlus, Redmi, iPad, MacBook, iMac, 4K, 5K and ultrawide monitors.',
  alternates: { canonical: '/wallpapers-for' },
};

const GROUPS = [
  ['phone', 'Phones'],
  ['tablet', 'Tablets'],
  ['desktop', 'Computers & monitors'],
] as const;

export default function DevicesIndexPage() {
  return (
    <main className="container space-y-8 py-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Wallpapers by device</h1>
        <p className="max-w-2xl text-muted-foreground">Pick your phone, tablet or screen to see wallpapers that are sharp on it — each one can be downloaded cropped to your exact resolution.</p>
      </div>
      {GROUPS.map(([kind, label]) => (
        <section key={kind}>
          <h2 className="mb-3 font-display text-lg font-semibold">{label}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DEVICES.filter((d) => d.kind === kind).map((d) => (
              <li key={d.id}>
                <Link href={`/wallpapers-for/${d.id}`} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm hover:bg-secondary">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.w}×{d.h}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
