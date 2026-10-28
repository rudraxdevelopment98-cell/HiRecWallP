import Link from 'next/link';
import { Heart, Mountain, Search, ShoppingBag, User } from 'lucide-react';
import { publicEnv } from '@/lib/env';
import { getDisplayRegion } from '@/lib/catalogue';
import { RegionSwitcher } from '@/components/region-switcher';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/collections', label: 'Collections' },
  { href: '/studio', label: 'Studio' },
  { href: '/pricing', label: 'Membership' },
];

export function SiteHeader() {
  const region = getDisplayRegion();
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Mountain className="h-5 w-5" />
          <span>{publicEnv.NEXT_PUBLIC_BRAND_NAME}</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 text-sm lg:flex">
          {NAV.map((item, i) => (
            <Link
              key={`${item.href}-${i}`}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action="/search" method="get" className="relative ml-auto hidden max-w-sm flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="Search wallpapers, categories…"
            className="w-full rounded-full border bg-secondary/60 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-ring focus:bg-card"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/search" aria-label="Search" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
            <Search className="h-4 w-4" />
          </Link>
          <div className="mr-1 hidden sm:block">
            <RegionSwitcher current={region} />
          </div>
          <Link href="/account" aria-label="Account" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <User className="h-4 w-4" />
          </Link>
          <Link href="/library" aria-label="Saved" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Heart className="h-4 w-4" />
          </Link>
          <Link href="/pricing" aria-label="Cart" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <ShoppingBag className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
