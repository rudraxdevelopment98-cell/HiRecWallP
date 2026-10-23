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
    <header className="glass sticky top-0 z-40 w-full border-x-0 border-t-0">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="group flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[hsl(var(--glow))] shadow-[0_0_12px_2px_hsl(var(--glow)/0.6)] transition-transform group-hover:scale-125" />
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
