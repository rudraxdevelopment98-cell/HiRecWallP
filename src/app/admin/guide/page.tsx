import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { GuideIndex } from '@/components/guide/guide-views';
import { guideChapters } from '@/lib/guide';

export const metadata: Metadata = { title: 'Admin guide' };

export default async function AdminGuidePage() {
  await requireAdmin();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin guide"
        description={
          <>
            How each part of the admin works, step by step with pictures. The customer side is in the{' '}
            <Link href="/guide" className="underline" target="_blank">
              public guide
            </Link>
            .
          </>
        }
      />
      <GuideIndex chapters={guideChapters(['admin'])} base="/admin/guide" audiences={['admin']} />
    </div>
  );
}
