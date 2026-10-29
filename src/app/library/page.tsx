import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Download, Heart, ShoppingBag } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AccountSidebar } from '@/components/account-sidebar';
import { DownloadButton } from '@/components/download-button';
import { buttonVariants } from '@/components/ui/button';
import { PAID_VARIANT_LABELS, downloadableVariants } from '@/lib/variants';

export const metadata: Metadata = { title: 'My Library' };

interface EntitlementRow {
  id: string;
  wallpaper_id: string;
  max_downloads: number;
  downloads_used: number;
  created_at: string;
  wallpapers: { slug: string; title: string } | null;
}

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/library');

  const supabase = createClient();
  const [{ data: entitlements }, { data: balance }] = await Promise.all([
    supabase
      .from('entitlements')
      .select('id, wallpaper_id, max_downloads, downloads_used, created_at, wallpapers(slug, title)')
      .order('created_at', { ascending: false })
      .returns<EntitlementRow[]>(),
    supabase.rpc('my_credit_balance'),
  ]);

  const items = entitlements ?? [];
  const variants = await downloadableVariants([...new Set(items.map((e) => e.wallpaper_id))]);
  const totalDownloads = items.reduce((s, e) => s + e.downloads_used, 0);
  const thisYear = items.filter((e) => new Date(e.created_at).getFullYear() === new Date().getFullYear()).length;
  const name = user.email?.split('@')[0] ?? 'there';

  return (
    <main className="container grid gap-8 py-10 lg:grid-cols-[210px_1fr]">
      <AccountSidebar />

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Welcome back, {name}</h1>
            <p className="text-sm text-muted-foreground">Here’s what’s happening with your account.</p>
          </div>
          <Link href="/pricing" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Credits: {balance ?? 0} · Buy more
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={<ShoppingBag className="h-5 w-5" />} label="Purchases" value={items.length} />
          <Stat icon={<Download className="h-5 w-5" />} label="Downloads" value={totalDownloads} />
          <Stat icon={<Heart className="h-5 w-5" />} label="This year" value={thisYear} />
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">My library</h2>
          {items.length === 0 ? (
            <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Nothing here yet. Browse the{' '}
              <Link href="/explore" className="underline">
                catalogue
              </Link>{' '}
              to get started.
            </p>
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {items.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{e.wallpapers?.title ?? 'Wallpaper'}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.max_downloads - e.downloads_used} of {e.max_downloads} downloads left
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(variants.get(e.wallpaper_id) ?? ['phone', 'desktop_4k'])
                      .filter((v) => v in PAID_VARIANT_LABELS)
                      .map((v) => (
                        <DownloadButton
                          key={v}
                          wallpaperId={e.wallpaper_id}
                          variant={v as 'phone'}
                          label={PAID_VARIANT_LABELS[v] ?? v}
                        />
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-2 inline-flex rounded-xl bg-secondary p-2 text-foreground">{icon}</div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
