import Link from 'next/link';
import { Facebook, Heart, Instagram, Mountain, Twitter, Youtube } from 'lucide-react';
import { publicEnv } from '@/lib/env';

const LINKS = [
  { href: '/', label: 'About Us' },
  { href: '/contact-takedown', label: 'Contact' },
  { href: '/licence', label: 'Licence' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refunds', label: 'Refunds' },
];

const SOCIAL = [
  { icon: Twitter, label: 'Twitter' },
  { icon: Instagram, label: 'Instagram' },
  { icon: Youtube, label: 'YouTube' },
  { icon: Facebook, label: 'Facebook' },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="container flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Mountain className="h-5 w-5" />
            {publicEnv.NEXT_PUBLIC_BRAND_NAME}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Premium wallpapers for every screen</p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {SOCIAL.map(({ icon: Icon, label }) => (
            <a
              key={label}
              href="#"
              aria-label={label}
              className="grid h-9 w-9 place-items-center rounded-full border text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
      <div className="border-t">
        <div className="container flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {publicEnv.NEXT_PUBLIC_BRAND_NAME}. AI-generated wallpapers.
          </p>
          <p className="inline-flex items-center gap-1">
            Better Screens. Happier You. <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
}
