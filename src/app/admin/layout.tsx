import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/review-queue', label: 'Review queue' },
  { href: '/admin/prompts', label: 'Prompts' },
  { href: '/admin/upload', label: 'Upload' },
  { href: '/admin/catalogue', label: 'Catalogue' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/social', label: 'Social' },
];

/**
 * Server-side admin gate. Role is checked on the server (not hidden UI); RLS
 * independently protects the data. Non-admins are redirected to login.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminUser())) {
    redirect('/login');
  }
  return (
    <div className="container grid gap-8 py-10 md:grid-cols-[180px_1fr]">
      <aside className="space-y-1 text-sm">
        <p className="mb-2 font-semibold">Admin</p>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="block rounded px-2 py-1 hover:bg-accent">
            {item.label}
          </Link>
        ))}
        <p className="mt-4 text-xs text-muted-foreground">Orders · Takedowns (soon)</p>
      </aside>
      <section>{children}</section>
    </div>
  );
}
