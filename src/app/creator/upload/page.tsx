import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCreator } from '@/lib/creator';
import { CreatorUploadForm } from '@/components/creator/upload-form';

export const metadata: Metadata = { title: 'Creator upload' };

export default async function CreatorUploadPage() {
  const creator = await getCreator();
  if (!creator) redirect('/creator');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload a wallpaper</h1>
        <p className="text-sm text-muted-foreground">Submit an original for automated checks + review.</p>
      </div>
      <CreatorUploadForm />
    </div>
  );
}
