import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { GuideChapterView } from '@/components/guide/guide-views';
import { guideChapter, guideNeighbours } from '@/lib/guide';

export const metadata: Metadata = { title: 'Admin guide' };

export default async function AdminGuideChapterPage(props: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await props.params;
  const chapter = guideChapter(slug, ['admin']);
  if (!chapter) notFound();
  const { prev, next } = guideNeighbours(slug, ['admin']);
  return (
    <div className="space-y-8">
      <PageHeader title={chapter.title} description={chapter.summary} back={{ href: '/admin/guide', label: 'Admin guide' }} />
      <GuideChapterView chapter={chapter} base="/admin/guide" prev={prev} next={next} />
    </div>
  );
}
