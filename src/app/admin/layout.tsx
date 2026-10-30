import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Coins,
  Crown,
  FolderTree,
  Settings,
  Images,
  Inbox,
  LayoutDashboard,
  Mail,
  Palette,
  Receipt,
  Users,
  ListChecks,
  Megaphone,
  Mountain,
  Sparkles,
  Tags,
  Upload,
} from 'lucide-react';
import { isAdminUser } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/review-queue', label: 'Review queue', icon: ListChecks },
  { href: '/admin/prompts', label: 'Prompts', icon: Sparkles },
  { href: '/admin/upload', label: 'Upload', icon: Upload },
  { href: '/admin/catalogue', label: 'Catalogue', icon: Images },
  { href: '/admin/orders', label: 'Orders', icon: Receipt },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/creators', label: 'Creators', icon: Palette },
  { href: '/admin/messages', label: 'Messages', icon: Inbox },
  { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
  { href: '/admin/settings', label: 'Settings & controls', icon: Settings },
  { href: '/admin/membership', label: 'Membership', icon: Crown },
  { href: '/admin/credit-packs', label: 'Credit packs', icon: Coins },
  { href: '/admin/categories', label: 'Categories & sets', icon: FolderTree },
  { href: '/admin/pricing', label: 'Auto pricing', icon: Tags },
  { href: '/admin/social', label: 'Social', icon: Megaphone },
];

/**
 * Server-side admin gate with a dark dashboard sidebar. Role is checked on the
 * server (not hidden UI); RLS independently protects the data.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminUser())) {
    redirect('/login?next=/admin');
  }
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col gap-1 bg-neutral-950 p-4 text-sm text-neutral-300 lg:flex">
        <Link href="/" className="mb-4 flex items-center gap-2 font-semibold text-white">
          <Mountain className="h-5 w-5" /> Admin
        </Link>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 hover:text-white"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
        <p className="mt-4 px-3 text-xs text-neutral-500">Orders · Takedowns (soon)</p>
      </aside>

      {/* Mobile top nav */}
      <div className="flex gap-1 overflow-x-auto border-b bg-card px-3 py-2 text-sm lg:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full px-3 py-1 hover:bg-secondary">
            {item.label}
          </Link>
        ))}
      </div>

      <section className="min-w-0 p-6 lg:p-8">{children}</section>
    </div>
  );
}
