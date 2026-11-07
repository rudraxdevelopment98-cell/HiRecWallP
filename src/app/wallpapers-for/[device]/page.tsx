import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WallpaperCard } from '@/components/wallpaper-card';
import { getDisplayRegion, listPublishedWallpapers } from '@/lib/catalogue';
import { DEVICES, approxSource, deviceById, fitFor, setWallpaperSteps } from '@/lib/fit';
import { breadcrumbLd, faqLd, itemListLd } from '@/lib/seo';
import { jsonForScript } from '@/lib/safe-json';
import { publicEnv } from '@/lib/env';
import { wallpaperPath } from '@/lib/wallpaper-url';

// Prices and wallpapers follow the visitor's region, so this renders per request.
export const dynamic = 'force-dynamic';

const KIND_WORD = { phone: 'phone', tablet: 'tablet', desktop: 'screen' } as const;

export async function generateMetadata(props: { params: Promise<{ device: string }> }): Promise<Metadata> {
  const d = deviceById((await props.params).device);
  if (!d) return {};
  return {
    title: `${d.name} Wallpapers${/\b[45]K\b/.test(d.name) ? '' : ' 4K'} – Exact Fit ${d.w}×${d.h}`,
    description: `Ultra-HD wallpapers that fit the ${d.name} ${KIND_WORD[d.kind]} (${d.w} × ${d.h} pixels) exactly — sharp, cropped to your screen, every size included. Preview on your device before you choose.`,
    alternates: { canonical: `/wallpapers-for/${d.id}` },
  };
}

/** Landing page per device: wallpapers that cover this screen sharply, how to set one, and FAQs. */
export default async function DeviceWallpapersPage(props: { params: Promise<{ device: string }> }) {
  const d = deviceById((await props.params).device);
  if (!d) notFound();
  const region = await getDisplayRegion();
  const portrait = d.kind !== 'desktop';
  const all = await listPublishedWallpapers({ orientation: portrait ? 'portrait' : 'landscape', sort: 'newest' }, region, 200);
  const fits = all
    .filter((w) => {
      const src = approxSource(w.source_width, w.source_height, w.devices ?? []);
      const f = fitFor(src.w, src.h, d.w, d.h);
      return src.w > 0 && f.grade !== 'too_small' && f.kept >= 0.5;
    })
    .slice(0, 48);
  const how = setWallpaperSteps(d);
  const faqs = [
    { q: `What is the ${d.name} wallpaper size?`, a: `The ${d.name} screen is ${d.w} × ${d.h} pixels. Choose “Exact fit” in My Library and we crop the wallpaper to exactly that size, so nothing is stretched.` },
    { q: `Will these wallpapers look sharp on the ${d.name}?`, a: `Yes. Every wallpaper on this page is at least as large as the ${d.name} screen (or within 15%), so it stays crisp at full resolution.` },
    { q: `How do I set a wallpaper on my ${how.platform}?`, a: how.steps.join(' ') },
  ];
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const jsonLd = [
    breadcrumbLd(site, [
      { name: 'Home', path: '/' },
      { name: 'Wallpapers by device', path: '/wallpapers-for' },
      { name: `${d.name} wallpapers`, path: `/wallpapers-for/${d.id}` },
    ]),
    itemListLd(site, fits.map((w) => ({ name: w.title, path: wallpaperPath(w) }))),
    faqLd(faqs),
  ];
  const siblings = DEVICES.filter((x) => x.kind === d.kind && x.id !== d.id);

  return (
    <main className="container space-y-10 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/wallpapers-for" className="hover:text-foreground">Wallpapers by device</Link> · {d.name}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {d.name} Wallpapers <span className="text-muted-foreground">· exact fit {d.w}×{d.h}</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Ultra-HD wallpapers that cover the {d.name} {KIND_WORD[d.kind]} sharply. After you unlock one, pick <strong>Exact fit</strong> in My
          Library and we crop it to {d.w} × {d.h} pixels — no stretching, no black bars.
        </p>
      </div>

      {fits.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          New wallpapers for the {d.name} are on the way. Meanwhile, <Link href="/explore" className="underline">explore everything</Link>.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {fits.map((w) => (
            <WallpaperCard key={w.id} wallpaper={w} />
          ))}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">How to set a wallpaper on your {how.platform}</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {how.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Questions</h2>
          <dl className="space-y-3 text-sm">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-medium">{f.q}</dt>
                <dd className="text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {siblings.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Other {d.kind === 'desktop' ? 'computers & monitors' : `${d.kind}s`}</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {siblings.map((x) => (
              <li key={x.id}>
                <Link href={`/wallpapers-for/${x.id}`} className="inline-block rounded-full border bg-card px-3 py-1 hover:bg-secondary">
                  {x.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
