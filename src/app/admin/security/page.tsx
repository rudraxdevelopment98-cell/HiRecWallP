import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, Section, Stack } from '@/components/admin/ui';
import { RequireMfaSwitch, TwoFactorPanel } from '@/components/admin/two-factor';

export const metadata: Metadata = { title: 'Security' };
export const dynamic = 'force-dynamic';

/** Every staff member's own two-factor set-up; the owner also decides whether it's required. */
export default async function SecurityPage() {
  const me = await requireAdmin();
  const { data } = await createServiceClient().from('site_settings').select('value').eq('key', 'security').maybeSingle();
  const required = Boolean((data?.value as { require_staff_mfa?: boolean } | null)?.require_staff_mfa);
  return (
    <Stack>
      <PageHeader
        title={me.mfa === 'verify' ? 'Enter your sign-in code' : 'Security'}
        description="Two-factor sign-in keeps the admin safe even if a password leaks."
      />
      <Section title="Two-factor sign-in (authenticator app)">
        <TwoFactorPanel mode={me.mfa} required={required} />
      </Section>
      {me.role === 'owner' && me.mfa === 'ok' && (
        <Section title="For all staff" description="When on, staff without two-factor are sent here to set it up before they can open anything else.">
          <RequireMfaSwitch on={required} />
        </Section>
      )}
    </Stack>
  );
}
