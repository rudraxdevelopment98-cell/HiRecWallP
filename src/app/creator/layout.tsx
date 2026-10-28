import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

const NAV = [
  { href: '/creator', label: 'Dashboard' },
  { href: '/creator/upload', label: 'Upload' },
  { href: '/creator/earnings', label: 'Earnings' },
  { href: '/creator/payouts', label: 'Payouts' },
];

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="container grid gap-8 py-10 md:grid-cols-[180px_1fr]">
      <aside className="space-y-1 text-sm">
        <p className="mb-2 font-semibold">Creator</p>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="block rounded px-2 py-1 hover:bg-foreground/5">
            {item.label}
          </Link>
        ))}
      </aside>
      <section>{children}</section>
    </div>
  );
}
