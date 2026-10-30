import Image from 'next/image';
import type { Metadata } from 'next';
import { Reveal } from '@/components/reveal';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'About', description: 'About HirecWallp — premium AI wallpapers for every screen.' };

export default function AboutPage() {
  const brand = publicEnv.NEXT_PUBLIC_BRAND_NAME;
  return (
    <main className="container py-12">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">About {brand}</h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              We’re a small team obsessed with beautiful screens. {brand} curates and crafts ultra-HD,
              AI-generated wallpapers for phone, desktop, tablet and ultrawide — priced fairly for every
              country, delivered securely, and watermarked per buyer so creators and customers are protected.
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Quality over quantity: a few hundred stunning wallpapers beat thousands of mediocre ones.
            </p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border">
            <Image src="/demo/scene-1016.jpg" alt="" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
          </div>
        </Reveal>
      </section>

      <section className="mt-14 grid gap-6 rounded-2xl border bg-card p-8 text-center sm:grid-cols-3">
        <Stat value="Up to 5K" label="Sizes for phone, tablet & desktop" />
        <Stat value="1 per buyer" label="Invisible forensic watermark" />
        <Stat value="60 sec" label="Secure, expiring download links" />
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">Our mission</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          Make it effortless to find the one wallpaper that fits your screen and your taste — and to reward
          the creators who make them. We lean on automation for scale, and a human eye for quality.
        </p>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
