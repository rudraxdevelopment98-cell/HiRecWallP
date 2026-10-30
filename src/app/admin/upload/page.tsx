import { createServiceClient } from '@/lib/supabase/service';
import { AdminUploadForm } from '@/components/admin/upload-form';

export const dynamic = 'force-dynamic';

export default async function AdminUploadPage() {
  let categories: { id: string; name: string }[] = [];
  try {
    const { data } = await createServiceClient().from('categories').select('id, name').order('sort_order');
    categories = (data ?? []) as { id: string; name: string }[];
  } catch {
    /* not configured */
  }
  return <AdminUploadForm categories={categories} />;
}
