import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideIndex } from '@/components/guide/guide-views';
import { guideChapters } from '@/lib/guide';

export const metadata: Metadata = {
  title: 'Guide',
  description: 'Step-by-step help with pictures: finding wallpapers, previewing them on your device, buying credits, downloads, your account and selling your art.',
  alternates: { canonical: '/guide' },
};

const AUD = ['customer', 'creator'] as const;

export default function GuidePage() {
  return (
    <main className="container space-y-8 py-12">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Guide</h1>
        <p className="max-w-2xl text-muted-foreground">
          How everything on HirecWallp works, step by step with pictures. Short answers are in the{' '}
          <Link href="/faq" className="underline">
            FAQ
          </Link>
          ; still stuck?{' '}
          <Link href="/contact" className="underline">
            Contact us
          </Link>
          .
        </p>
      </div>
      <GuideIndex chapters={guideChapters([...AUD])} base="/guide" audiences={[...AUD]} />
    </main>
  );
}
