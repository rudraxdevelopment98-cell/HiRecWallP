import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { AccountSidebar } from '@/components/account-sidebar';

export const dynamic = 'force-dynamic';

/** Signed-in account area: sidebar + page. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login?next=/account');
  return (
    <main className="container grid gap-8 py-10 lg:grid-cols-[210px_1fr]">
      <AccountSidebar />
      <div className="min-w-0">{children}</div>
    </main>
  );
}
