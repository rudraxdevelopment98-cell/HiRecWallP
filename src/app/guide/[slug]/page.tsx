import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuideChapterView } from '@/components/guide/guide-views';
import { guideChapter, guideChapters, guideNeighbours } from '@/lib/guide';

const AUD: ('customer' | 'creator')[] = ['customer', 'creator'];

export function generateStaticParams() {
  return guideChapters(AUD).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const c = guideChapter(slug, AUD);
  if (!c) return {};
  return { title: `${c.title} · Guide`, description: c.summary, alternates: { canonical: `/guide/${c.slug}` } };
}

export default async function GuideChapterPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const chapter = guideChapter(slug, AUD);
  if (!chapter) notFound();
  const { prev, next } = guideNeighbours(slug, AUD);
  return (
    <main className="container space-y-8 py-12">
      <div className="space-y-2">
        <Link href="/guide" className="text-sm text-muted-foreground hover:text-foreground">
          ← Guide
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{chapter.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{chapter.summary}</p>
      </div>
      <GuideChapterView chapter={chapter} base="/guide" prev={prev} next={next} />
    </main>
  );
}
