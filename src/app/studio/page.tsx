import type { Metadata } from 'next';
import { StudioFinder } from '@/components/studio-finder';

export const metadata: Metadata = { title: 'Wallpaper Studio', description: 'Find your perfect wallpaper by device, resolution, mood and colour.' };

export default function StudioPage() {
  return (
    <main className="container py-12">
      <div className="mb-8 max-w-xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Find Your Perfect Wallpaper</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us your device, resolution and mood — we’ll show the wallpapers that match your style.
        </p>
      </div>
      <StudioFinder />
    </main>
  );
}
