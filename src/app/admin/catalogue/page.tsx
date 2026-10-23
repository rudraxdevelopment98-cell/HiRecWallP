import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { Badge } from '@/components/ui/badge';
import { PublishButton } from '@/components/admin/publish-button';

interface Row {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_free: boolean;
}

async function listAll(): Promise<Row[] | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('wallpapers')
      .select('id, slug, title, status, is_free')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data as Row[]) ?? [];
  } catch {
    return null;
  }
}

export default async function AdminCataloguePage() {
  const rows = await listAll();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Catalogue</h1>
      {rows == null ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Connect Supabase to manage the catalogue.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No wallpapers yet. Upload one to get started.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-2">Title</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2">
                  <Link href={`/w/${row.slug}`} className="hover:underline">
                    {row.title}
                  </Link>{' '}
                  {row.is_free && <Badge variant="free">FREE</Badge>}
                </td>
                <td>
                  <Badge variant={row.status === 'published' ? 'default' : 'secondary'}>
                    {row.status}
                  </Badge>
                </td>
                <td className="text-right">
                  {row.status !== 'published' && <PublishButton wallpaperId={row.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
