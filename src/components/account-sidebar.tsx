import Link from 'next/link';
import { CreditCard, Download, Heart, LayoutDashboard, Settings, Sparkles } from 'lucide-react';

const NAV = [
  { href: '/library', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/library', label: 'My Downloads', icon: Download },
  { href: '/library', label: 'Favourites', icon: Heart },
  { href: '/pricing', label: 'Membership', icon: Sparkles },
  { href: '/account', label: 'Billing', icon: CreditCard },
  { href: '/account', label: 'Settings', icon: Settings },
];

export function AccountSidebar() {
  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <nav className="space-y-1 text-sm">
        {NAV.map((item, i) => (
          <Link
            key={`${item.href}-${i}`}
            href={item.href}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
