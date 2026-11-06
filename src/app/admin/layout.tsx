import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getStaff } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/staff';
import { AdminSidebar, AdminTopbar } from '@/components/admin/admin-nav';
import { getAdminCounts } from '@/lib/admin-counts';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' }, robots: { index: false } };

/**
 * Admin app shell: its own sidebar + top bar (the public header/footer step
 * aside on /admin). Role is checked on the server (middleware, here and on
 * every page/API); RLS protects the data.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) {
    redirect('/login?next=/admin');
  }
  const counts = await getAdminCounts();
  const navCounts = Object.fromEntries(Object.entries(counts).filter(([k]) => k.startsWith('/')));
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <AdminSidebar counts={navCounts} staffRole={staff.role} />
      <div className="min-w-0">
        <AdminTopbar counts={navCounts} email={staff.email} staffRole={staff.role} roleLabel={ROLE_LABEL[staff.role]} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
