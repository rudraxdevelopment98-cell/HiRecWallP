import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSetBySlug } from '@/lib/catalogue';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const set = await getSetBySlug(params.slug);
  return {
    title: set ? set.title : 'Set',
    description: set?.description ?? undefined,
  };
}

export default async function SetPage({ params }: { params: { slug: string } }) {
  const set = await getSetBySlug(params.slug);
  if (!set && process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  return (
    <main className="container space-y-4 py-10">
      <h1 className="text-2xl font-semibold">{set?.title ?? params.slug}</h1>
      {set?.description && <p className="text-muted-foreground">{set.description}</p>}
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Matching-set wallpapers appear here once published.
      </p>
    </main>
  );
}
