import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { storage } from '@/lib/storage';
import { visionIsReal } from '@/lib/ai';
import { BatchUploader } from '@/components/admin/batch-uploader';
import { StorageRules } from '@/components/admin/upload-form';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Upload' };

export default async function AdminUploadPage() {
  await requireAdmin();
  let categories: { id: string; name: string }[] = [];
  try {
    const { data } = await createServiceClient().from('categories').select('id, name').order('sort_order');
    categories = (data ?? []) as { id: string; name: string }[];
  } catch {
    /* not configured */
  }
  let maxBytes = 50 * 1024 * 1024;
  let r2 = false;
  try {
    maxBytes = storage().maxUploadBytes;
    r2 = storage().id === 'r2';
  } catch {
    /* storage not configured */
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload wallpapers"
        description="Drop a whole folder of originals. Each file is checked, uploaded straight to private storage, compared with the catalogue for duplicates, then turned into device sizes, watermarked previews and a free size. Everything lands as a draft."
        actions={
          <Link href="/admin/drafts" className="admin-btn">
            Drafts
          </Link>
        }
      />
      <BatchUploader categories={categories} maxBytes={maxBytes} aiReal={visionIsReal()} />
      {r2 && <StorageRules />}
    </div>
  );
}
