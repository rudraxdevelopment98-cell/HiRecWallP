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
import { previewUrlFor } from '@/lib/catalogue';
import Image from 'next/image';
import { wallpaperPath } from '@/lib/wallpaper-url';

export const metadata: Metadata = { title: 'My Library' };

interface EntitlementRow {
  id: string;
  wallpaper_id: string;
  max_downloads: number;
  downloads_used: number;
  order_id: string | null;
  created_at: string;
  licence: string;
  wallpapers: { slug: string; code: string | null; title: string; wallpaper_assets: { variant: string; storage_key: string }[] | null } | null;
}

const SORTS = { newest: 'Newest', title: 'Title A–Z', left: 'Most downloads left' } as const;
type Sort = keyof typeof SORTS;

export default async function LibraryPage(props: { searchParams: Promise<{ q?: string; licence?: string; sort?: string }> }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 80);
  const licence = sp.licence === 'personal' || sp.licence === 'commercial' ? sp.licence : '';
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : 'newest';
  const user = await getUser();
  if (!user) redirect('/login?next=/library');

  const supabase = (await createClient());
  const [{ data: entitlements }, { data: balance }] = await Promise.all([
    supabase
      .from('entitlements')
      .select('id, wallpaper_id, order_id, licence, max_downloads, downloads_used, created_at, wallpapers(slug, code, title, wallpaper_assets(variant, storage_key))')
      .order('created_at', { ascending: false })
      .returns<EntitlementRow[]>(),
    supabase.rpc('my_credit_balance'),
  ]);

  const all = entitlements ?? [];
  const items = all
    .filter((e) => (!q || (e.wallpapers?.title ?? '').toLowerCase().includes(q)) && (!licence || e.licence === licence))
    .sort((a, b) =>
      sort === 'title'
        ? (a.wallpapers?.title ?? '').localeCompare(b.wallpapers?.title ?? '')
        : sort === 'left'
          ? b.max_downloads - b.downloads_used - (a.max_downloads - a.downloads_used)
          : b.created_at.localeCompare(a.created_at),
    );
  const variants = await downloadableVariants([...new Set(items.map((e) => e.wallpaper_id))]);
  const totalDownloads = all.reduce((s, e) => s + e.downloads_used, 0);
  const thisYear = all.filter((e) => new Date(e.created_at).getFullYear() === new Date().getFullYear()).length;
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
          <Link href="/account/credits" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Credits: {balance ?? 0}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={<ShoppingBag className="h-5 w-5" />} label="Wallpapers" value={all.length} />
          <Stat icon={<Download className="h-5 w-5" />} label="Downloads" value={totalDownloads} />
          <Stat icon={<Heart className="h-5 w-5" />} label="This year" value={thisYear} />
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">My library</h2>
            {all.length > 0 && (
              <form action="/library" className="flex flex-wrap gap-2 text-sm">
                <input name="q" defaultValue={q} placeholder="Search your wallpapers" aria-label="Search your wallpapers" className="input h-9 w-48 py-1" />
                <select name="licence" defaultValue={licence} aria-label="Licence" className="input h-9 w-auto py-1">
                  <option value="">All licences</option>
                  <option value="personal">Personal</option>
                  <option value="commercial">Commercial</option>
                </select>
                <select name="sort" defaultValue={sort} aria-label="Sort" className="input h-9 w-auto py-1">
                  {Object.entries(SORTS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>Apply</button>
              </form>
            )}
          </div>
          {all.length > 0 && items.length === 0 ? (
            <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              No wallpapers match. <Link href="/library" className="underline">Clear filters</Link>
            </p>
          ) : items.length === 0 ? (
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
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {(() => {
                        const key = e.wallpapers?.wallpaper_assets?.find((a) => a.variant === 'preview')?.storage_key;
                        const url = previewUrlFor(key);
                        return url ? <Image src={url} alt="" fill sizes="64px" className="object-cover" /> : null;
                      })()}
                    </div>
                    <div className="min-w-0">
                      {e.wallpapers?.slug ? (
                        <Link href={wallpaperPath(e.wallpapers)} className="font-medium hover:underline">
                          {e.wallpapers.title}
                        </Link>
                      ) : (
                        <p className="font-medium">Wallpaper</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {e.licence === 'commercial' ? 'Commercial' : 'Personal'} licence ·{' '}
                        {e.max_downloads - e.downloads_used} of {e.max_downloads} downloads left
                        {e.max_downloads - e.downloads_used <= 1 && (
                          <>
                            {' · '}
                            <Link href={`/account/support/new?category=download${e.order_id ? `&order=${e.order_id}` : ''}`} className="underline">
                              need more?
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
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
