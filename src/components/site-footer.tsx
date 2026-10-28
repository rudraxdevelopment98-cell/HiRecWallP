import Link from 'next/link';
import { publicEnv } from '@/lib/env';

const LINKS = [
  { href: '/licence', label: 'Licence' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/contact-takedown', label: 'Contact / Takedown' },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {publicEnv.NEXT_PUBLIC_BRAND_NAME}. AI-generated wallpapers.
        </p>
        <nav className="flex flex-wrap gap-4">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <Link href="/creator" className="hover:text-foreground">
            Creators
          </Link>
        </nav>
      </div>
    </footer>
  );
}
