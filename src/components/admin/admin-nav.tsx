'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Coins,
  Crown,
  FolderTree,
  Globe2,
  History,
  Images,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Mail,
  Megaphone,
  Mountain,
  Palette,
  Receipt,
  Rocket,
  Settings,
  Sparkles,
  Tags,
  Upload,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { startNavigationProgress } from '@/components/navigation-progress';

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
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/membership', label: 'Membership', icon: Crown },
      { href: '/admin/credit-packs', label: 'Credit packs', icon: Coins },
      { href: '/admin/countries', label: 'Pricing by country', icon: Globe2 },
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
    group: 'Marketing',
    items: [
      { href: '/admin/growth', label: 'Growth', icon: Rocket },
      { href: '/admin/social', label: 'Social posts', icon: Megaphone },
      { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
      { href: '/admin/messages', label: 'Messages', icon: Inbox },
    ],
  },
  {
    group: 'System',
    items: [
      { href: '/admin/settings', label: 'Settings & controls', icon: Settings },
      { href: '/admin/pricing', label: 'Auto pricing', icon: Tags },
      { href: '/admin/health', label: 'System health', icon: Activity },
      { href: '/admin/activity', label: 'Activity log', icon: History },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

/** Desktop sidebar. */
export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] flex-col gap-5 overflow-y-auto overscroll-contain bg-neutral-950 p-4 text-sm text-neutral-300 [scrollbar-width:thin] lg:flex">
      <Link href="/" className="flex items-center gap-2 px-2 font-semibold text-white">
        <Mountain className="h-5 w-5" /> HirecWallp admin
      </Link>
      {ADMIN_NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500">{g.group}</p>
          {g.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white',
                  active && 'bg-white/10 text-white',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

/** Mobile: a section picker that stays usable on small screens. */
export function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const current = ADMIN_NAV.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
  return (
    <div className="sticky top-16 z-30 border-b bg-card/95 px-3 py-2 backdrop-blur lg:hidden">
      <label className="sr-only" htmlFor="admin-section">
        Admin section
      </label>
      <select
        id="admin-section"
        className="input"
        value={current?.href ?? '/admin'}
        onChange={(e) => {
          startNavigationProgress();
          router.push(e.target.value);
        }}
      >
        {ADMIN_NAV.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((i) => (
              <option key={i.href} value={i.href}>
                {i.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
