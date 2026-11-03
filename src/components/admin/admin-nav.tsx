'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Coins,
  Crown,
  ExternalLink,
  FolderTree,
  Globe2,
  History,
  Images,
  Inbox,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Mountain,
  Palette,
  Receipt,
  Rocket,
  Settings,
  Sparkles,
  Tags,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const ADMIN_NAV = [
  {
    group: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    group: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: Receipt },
      { href: '/admin/support', label: 'Support', icon: LifeBuoy },
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/messages', label: 'Messages', icon: Inbox },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { href: '/admin/catalogue', label: 'Wallpapers', icon: Images },
      { href: '/admin/upload', label: 'Upload', icon: Upload },
      { href: '/admin/categories', label: 'Categories & sets', icon: FolderTree },
      { href: '/admin/review-queue', label: 'AI review queue', icon: ListChecks },
      { href: '/admin/prompts', label: 'AI prompts', icon: Sparkles },
      { href: '/admin/creators', label: 'Creators', icon: Palette },
    ],
  },
  {
    group: 'Pricing & plans',
    items: [
      { href: '/admin/credit-packs', label: 'Credit packs', icon: Coins },
      { href: '/admin/membership', label: 'Membership', icon: Crown },
      { href: '/admin/countries', label: 'Pricing by country', icon: Globe2 },
      { href: '/admin/pricing', label: 'Auto pricing', icon: Tags },
    ],
  },
  {
    group: 'Growth',
    items: [
      { href: '/admin/growth', label: 'Growth', icon: Rocket },
      { href: '/admin/social', label: 'Social posts', icon: Megaphone },
      { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
    ],
  },
  {
    group: 'Business',
    items: [
      { href: '/admin/tax', label: 'Tax centre', icon: Landmark },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/health', label: 'System health', icon: Activity },
      { href: '/admin/activity', label: 'Activity log', icon: History },
    ],
  },
];

const ALL = ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

/** The nav item for the current page (longest matching href). */
function currentItem(pathname: string) {
  return ALL.filter((i) => isActive(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0];
}

export type NavCounts = Partial<Record<string, number>>;

function NavLinks({ counts, onNavigate }: { counts: NavCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = currentItem(pathname)?.href;
  return (
    <nav aria-label="Admin" className="space-y-5">
      {ADMIN_NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const on = item.href === active;
              const n = counts[item.href] ?? 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                      on && 'bg-secondary font-medium text-foreground',
                    )}
                  >
                    {on && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-foreground" />}
                    <item.icon className={cn('h-4 w-4 shrink-0', on ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
                    <span className="truncate">{item.label}</span>
                    {n > 0 && (
                      <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700">
                        {n > 99 ? '99+' : n}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 px-3 font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
        <Mountain className="h-4 w-4" />
      </span>
      <span>
        HirecWallp <span className="font-normal text-muted-foreground">Admin</span>
      </span>
    </Link>
  );
}

/** Desktop sidebar (full height, scrolls on its own). */
export function AdminSidebar({ counts }: { counts: NavCounts }) {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto overscroll-contain border-r bg-card px-3 py-5 [scrollbar-width:thin] lg:flex">
      <Brand />
      <NavLinks counts={counts} />
    </aside>
  );
}

/** Top bar: current section/page, store link, account; menu button on mobile. */
export function AdminTopbar({ counts, email }: { counts: NavCounts; email: string | null }) {
  const pathname = usePathname();
  const item = currentItem(pathname);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="min-w-0 truncate text-sm">
          <span className="text-muted-foreground">{item?.group ?? 'Admin'}</span>
          <span className="mx-1.5 text-muted-foreground/50">/</span>
          <span className="font-medium">{item?.label ?? 'Admin'}</span>
        </p>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex">
            <ExternalLink className="h-4 w-4" /> View store
          </Link>
          {email && <span className="hidden max-w-[14rem] truncate px-2 text-muted-foreground md:inline">{email}</span>}
          <form action="/auth/signout" method="post">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-card px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks counts={counts} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
