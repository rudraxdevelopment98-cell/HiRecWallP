import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { AdminMobileNav, AdminSidebar } from '@/components/admin/admin-nav';

/**
 * Server-side admin gate with a grouped dashboard sidebar. Role is checked on
 * the server (middleware, here and on every page/API); RLS protects the data.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminUser())) {
    redirect('/login?next=/admin');
  }
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[230px_1fr] lg:items-start">
      <AdminSidebar />
      <AdminMobileNav />
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</section>
    </div>
  );
}
