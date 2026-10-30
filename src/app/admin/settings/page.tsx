import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';
import { AdminForm, SettingToggle } from '@/components/admin/admin-form';

export const dynamic = 'force-dynamic';

const REGION_NAME: Record<string, string> = { IN: 'India (₹ per wallpaper)', T1: 'Tier 1 (credits)', T2: 'Tier 2 (credits)', T3: 'Rest of world (credits)' };

export default async function AdminSettingsPage() {
  const supabase = createServiceClient();
  const [settings, { data: rules }, { data: regions }] = await Promise.all([
    getSettings(),
    supabase.from('price_rules').select('region_code, base_price, min_price, max_price').eq('scope', 'global').order('region_code'),
    supabase.from('regions').select('code, commercial_multiplier'),
  ]);
  const mult = new Map((regions ?? []).map((r) => [r.code as string, Number(r.commercial_multiplier)]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings &amp; controls</h1>
        <p className="text-sm text-muted-foreground">Switch features on or off, set default prices and the site banner. Changes apply within a minute.</p>
      </div>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Store switches</h2>
        <div className="divide-y text-sm">
          <SettingToggle settingKey="store_open" value={settings.store_open} label="Store open (checkout)" hint="Off = nobody can pay or unlock with credits. Browsing and free downloads keep working; a notice is shown." />
          <SettingToggle settingKey="membership_enabled" value={settings.membership_enabled} label="Sell membership passes" hint="Shows active plans on the Pricing page. Existing members keep their passes either way." />
          <SettingToggle settingKey="free_downloads" value={settings.free_downloads} label="Free downloads" hint="Allow free wallpapers to be downloaded without an account." />
          <SettingToggle settingKey="creator_signups" value={settings.creator_signups} label="New creator sign-ups" hint="Let new people join as creators. Existing creators can still upload." />
          <SettingToggle settingKey="newsletter_enabled" value={settings.newsletter_enabled} label="Newsletter sign-up boxes" hint="Show the 'Stay updated' email box on the home and pricing pages." />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 font-semibold">Announcement bar</h2>
          <AdminForm
            action="/api/admin/settings"
            method="PUT"
            fields={[
              { name: 'enabled', label: 'Show the bar', type: 'checkbox', span: 4 },
              { name: 'text', label: 'Message', placeholder: 'Diwali drop is live — 20 new wallpapers', span: 4 },
              { name: 'href', label: 'Link (optional)', placeholder: '/explore?q=diwali', span: 4 },
            ]}
            initial={settings.announcement}
            submitLabel="Save banner"
            wrapAs="announcement"
          />
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 font-semibold">Downloads per purchase</h2>
          <p className="mb-3 text-xs text-muted-foreground">How many times a buyer can download each wallpaper they buy (applies to new purchases).</p>
          <AdminForm
            action="/api/admin/settings"
            method="PUT"
            fields={[{ name: 'downloads_per_purchase', label: 'Downloads', type: 'number', span: 2 }]}
            initial={{ downloads_per_purchase: settings.downloads_per_purchase }}
            wrapAs="downloads_per_purchase"
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Default prices</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          The price a new wallpaper starts at in each region (₹ for India, credits elsewhere), the allowed range for automatic
          pricing, and how much more the commercial licence costs. Fine-tune with the automatic job on{' '}
          <Link href="/admin/pricing" className="underline">Pricing</Link>.
        </p>
        <div className="space-y-5">
          {(rules ?? []).map((r) => (
            <div key={r.region_code as string} className="border-t pt-4 first:border-t-0 first:pt-0">
              <p className="mb-2 text-sm font-medium">{REGION_NAME[r.region_code as string] ?? r.region_code}</p>
              <AdminForm
                compact
                action="/api/admin/price-rules"
                fields={[
                  { name: 'base_price', label: 'Default price', type: 'number' },
                  { name: 'min_price', label: 'Lowest', type: 'number' },
                  { name: 'max_price', label: 'Highest', type: 'number' },
                  { name: 'commercial_multiplier', label: 'Commercial ×', type: 'number' },
                ]}
                initial={{ ...r, commercial_multiplier: mult.get(r.region_code as string) ?? 5 }}
                extra={{ region_code: r.region_code as string }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/membership" className="rounded-2xl border bg-card p-5 text-sm hover:border-foreground/40">
          <p className="font-semibold">Membership plans →</p>
          <p className="text-muted-foreground">Add, edit, price and switch plans; manage members.</p>
        </Link>
        <Link href="/admin/credit-packs" className="rounded-2xl border bg-card p-5 text-sm hover:border-foreground/40">
          <p className="font-semibold">Credit packs →</p>
          <p className="text-muted-foreground">Pack sizes and prices for each region.</p>
        </Link>
        <Link href="/admin/categories" className="rounded-2xl border bg-card p-5 text-sm hover:border-foreground/40">
          <p className="font-semibold">Categories &amp; sets →</p>
          <p className="text-muted-foreground">Organise the catalogue.</p>
        </Link>
      </section>
    </div>
  );
}
