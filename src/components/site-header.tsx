import Link from 'next/link';
import { Search } from 'lucide-react';
import { publicEnv } from '@/lib/env';
import { getDisplayRegion } from '@/lib/catalogue';
import { RegionSwitcher } from '@/components/region-switcher';
import { buttonVariants } from '@/components/ui/button';

const NAV = [
  { href: '/explore', label: 'Explore' },
  { href: '/collections/devotional', label: 'Collections' },
  { href: '/free', label: 'Free' },
  { href: '/pricing', label: 'Pricing' },
];

export function SiteHeader() {
  const region = getDisplayRegion();
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="font-semibold tracking-tight">
          {publicEnv.NEXT_PUBLIC_BRAND_NAME}
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/search" aria-label="Search" className="p-2 text-muted-foreground hover:text-foreground">
            <Search className="h-4 w-4" />
          </Link>
          <RegionSwitcher current={region} />
          <Link href="/login" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
