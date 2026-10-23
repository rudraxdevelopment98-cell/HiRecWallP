import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DownloadButton } from '@/components/download-button';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'My Library' };

interface EntitlementRow {
  id: string;
  wallpaper_id: string;
  max_downloads: number;
  downloads_used: number;
  wallpapers: { slug: string; title: string } | null;
}

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = createClient();
  const [{ data: entitlements }, { data: balance }] = await Promise.all([
    supabase
      .from('entitlements')
      .select('id, wallpaper_id, max_downloads, downloads_used, wallpapers(slug, title)')
      .order('created_at', { ascending: false })
      .returns<EntitlementRow[]>(),
    supabase.rpc('credit_balance', { p_user: user.id }),
  ]);

  const items = entitlements ?? [];

  return (
    <main className="container space-y-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Library</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Credits: {balance ?? 0}</span>
          <Link href="/pricing" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Buy credits
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Browse the <Link href="/explore" className="underline">catalogue</Link>{' '}
          to get started.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((e) => {
            const remaining = e.max_downloads - e.downloads_used;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{e.wallpapers?.title ?? 'Wallpaper'}</p>
                  <p className="text-xs text-muted-foreground">
                    {remaining} of {e.max_downloads} downloads left
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DownloadButton wallpaperId={e.wallpaper_id} variant="phone" label="Phone" />
                  <DownloadButton
                    wallpaperId={e.wallpaper_id}
                    variant="desktop_4k"
                    label="Desktop"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
