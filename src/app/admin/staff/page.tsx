import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, Section, Stack } from '@/components/admin/ui';
import { AddStaffForm, StaffRowActions } from '@/components/admin/staff-controls';
import { ROLE_HELP, ROLE_LABEL, STAFF_ROLES, effectiveRole } from '@/lib/staff';

export const metadata: Metadata = { title: 'Staff' };
export const dynamic = 'force-dynamic';

/** Owner only: who can use the admin, with which role, and whether they use two-factor sign-in. */
export default async function StaffPage() {
  const me = await requireAdmin();
  const s = createServiceClient();
  const { data: rows } = await s.from('profiles').select('id, email, display_name, staff_role, created_at').eq('role', 'admin').order('created_at');
  const staff = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data } = await s.auth.admin.getUserById(r.id as string).catch(() => ({ data: null }));
      const factors = (data?.user?.factors ?? []).filter((f) => f.status === 'verified');
      return { ...r, role: effectiveRole(r.staff_role as string | null), twoFactor: factors.length > 0, lastSignIn: data?.user?.last_sign_in_at ?? null };
    }),
  );
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');

  return (
    <Stack>
      <PageHeader title="Staff" description="Give people access to the admin with only the parts they need. They sign in with their own account." />
      <Section title="Team" flush>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Two-factor</th>
              <th>Last sign-in</th>
              <th className="text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.id as string}>
                <td>
                  <p className="font-medium">{(m.display_name as string | null) || (m.email as string)}</p>
                  <p className="text-xs text-muted-foreground">{m.email as string}</p>
                </td>
                <td>{ROLE_LABEL[m.role]}</td>
                <td>{m.twoFactor ? <span className="text-emerald-700">On</span> : <span className="text-amber-700">Off</span>}</td>
                <td className="text-xs text-muted-foreground">{fmt(m.lastSignIn)}</td>
                <td>
                  <StaffRowActions userId={m.id as string} role={m.role} self={m.id === me.id} twoFactor={m.twoFactor} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Add someone" description="They need a HirecWallp account first (any sign-in method). Changes apply on their next click.">
        <AddStaffForm />
      </Section>
      <Section title="What each role can open">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {STAFF_ROLES.map((r) => (
            <div key={r} className="rounded-lg border p-3">
              <dt className="font-medium">{ROLE_LABEL[r]}</dt>
              <dd className="text-muted-foreground">{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Everyone can see the dashboard, the admin guide and their own security page. Turn on “Require two-factor for all staff” on the Security page.
        </p>
      </Section>
    </Stack>
  );
}
