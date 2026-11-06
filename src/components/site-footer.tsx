import { isAdminRoute } from '@/lib/route';
import Link from 'next/link';
import { Facebook, Heart, Instagram, Pin, Twitter, Youtube } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { publicEnv } from '@/lib/env';
import { getDisplayCountry } from '@/lib/catalogue';
import { CountrySwitcher } from '@/components/country-switcher';
import { getSettings, socialLinks } from '@/lib/settings';

const LINKS = [
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
  { href: '/guide', label: 'Guide' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/licence', label: 'Licence' },
  { href: '/refunds', label: 'Refunds & Cancellation' },
  { href: '/delivery', label: 'Delivery' },
  { href: '/grievance', label: 'Grievance' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/creator', label: 'Sell your art' },
  { href: '/contact-takedown', label: 'Report content' },
];

export async function SiteFooter() {
  // Admin pages have their own shell.
  if (await isAdminRoute()) return null;
  // Shown only once an account URL is set in Admin → Settings (no dead "#" links).
  const links = socialLinks(await getSettings());
  const SOCIAL = [
    { icon: Instagram, label: 'Instagram', href: links.instagram },
    { icon: Youtube, label: 'YouTube', href: links.youtube },
    { icon: Twitter, label: 'X / Twitter', href: links.x },
    { icon: Facebook, label: 'Facebook', href: links.facebook },
    { icon: Pin, label: 'Pinterest', href: links.pinterest },
  ].filter((s) => s.href);
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="container flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <BrandMark />
            {publicEnv.NEXT_PUBLIC_BRAND_NAME}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Ultra-HD wallpapers for every screen</p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {SOCIAL.map(({ icon: Icon, label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
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
          {/* The header switcher is hidden on small screens; offer it here instead. */}
          <div className="sm:hidden">
            <CountrySwitcher current={await getDisplayCountry()} />
          </div>
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
