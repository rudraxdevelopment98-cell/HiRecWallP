'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, Heart, LayoutDashboard, LogOut, Palette, Receipt, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/library', label: 'My Library', icon: LayoutDashboard },
  { href: '/account/favourites', label: 'Favourites', icon: Heart },
  { href: '/account/orders', label: 'Orders & receipts', icon: Receipt },
  { href: '/account/credits', label: 'Credits', icon: Coins },
  { href: '/account', label: 'Settings', icon: Settings },
  { href: '/creator', label: 'Sell your art', icon: Palette },
];

export function AccountSidebar() {
  const pathname = usePathname();
  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <nav className="flex gap-1 overflow-x-auto text-sm lg:flex-col lg:space-y-1 lg:overflow-visible">
        {NAV.map((item) => {
          const active = item.href === '/account' ? pathname === '/account' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-secondary hover:text-foreground',
                active ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <form action="/auth/signout" method="post" className="shrink-0">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </nav>
    </aside>
  );
}
