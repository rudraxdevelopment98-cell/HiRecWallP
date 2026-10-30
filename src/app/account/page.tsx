import Link from 'next/link';
import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/account/profile-form';

export const metadata: Metadata = { title: 'Account settings' };

export default async function AccountPage() {
  const user = await getUser();
  const { data: profile } = await createClient()
    .from('profiles')
    .select('display_name, country_code, gstin, role, created_at')
    .eq('id', user!.id)
    .maybeSingle();

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user!.email ?? user!.id}</span>
          {profile?.role === 'admin' && (
            <>
              {' · '}
              <Link href="/admin" className="underline">
                Admin panel
              </Link>
            </>
          )}
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ProfileForm
          initial={{
            display_name: profile?.display_name ?? null,
            country_code: profile?.country_code ?? null,
            gstin: profile?.gstin ?? null,
          }}
        />
      </section>

      <section className="rounded-2xl border bg-card p-6 text-sm">
        <h2 className="font-semibold">Sell your own wallpapers</h2>
        <p className="mt-1 text-muted-foreground">
          Join as a creator: upload your work, we handle checks, sales and monthly payouts.
        </p>
        <Link href="/creator" className="mt-3 inline-block underline">
          Become a creator →
        </Link>
      </section>
    </div>
  );
}
