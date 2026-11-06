import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { DEFAULT_SETTINGS, getSettings, sellerDetails, socialLinks } from '@/lib/settings';
import { AdminForm, SettingToggle } from '@/components/admin/admin-form';
import { FilterTabs, PageHeader, Section } from '@/components/admin/ui';
import { RevertSettingButton } from '@/components/admin/revert-setting';
import { SETTING_LABEL, settingDiff } from '@/lib/settings-history';

export const dynamic = 'force-dynamic';

const REGION_NAME: Record<string, string> = { IN: 'India (credits)', T1: 'Tier 1 (credits)', T2: 'Tier 2 (credits)', T4: 'Tier 4 (credits)', T3: 'Tier 3 / rest of world (credits)' };

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'business', label: 'Business & legal' },
  { key: 'growth', label: 'Growth' },
  { key: 'prices', label: 'Prices & FX' },
  { key: 'history', label: 'History' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : 'general';
  const supabase = createServiceClient();
  const [settings, { data: rules }, { data: regions }, { data: history }] = await Promise.all([
    getSettings(),
    supabase.from('price_rules').select('region_code, base_price, min_price, max_price').eq('scope', 'global').order('region_code'),
    supabase.from('regions').select('code, commercial_multiplier'),
    tab === 'history'
      ? supabase.from('site_settings_history').select('id, key, old_value, new_value, actor_email, note, created_at').order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: null }),
  ]);
  const s = sellerDetails(settings, '');
  const seller = { legal_name: s.name, address: s.address, gstin: s.gstin, gst_rate: s.rate, support_email: s.supportEmail };
  const mult = new Map((regions ?? []).map((r) => [r.code as string, Number(r.commercial_multiplier)]));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Switch features on or off and set the details shown to customers. Changes apply within a minute." />
      <FilterTabs items={TABS.map((t) => ({ href: t.key === 'general' ? '/admin/settings' : `/admin/settings?tab=${t.key}`, label: t.label, active: t.key === tab }))} />

      {tab === 'general' && (
        <>
          <Section title="Store switches" description="Turn whole features on or off.">
            <div className="-my-3 divide-y text-sm">
              <SettingToggle settingKey="store_open" value={settings.store_open} label="Store open (checkout)" hint="Off = nobody can pay or unlock with credits. Browsing and free downloads keep working; a notice is shown." />
              <SettingToggle settingKey="membership_enabled" value={settings.membership_enabled} label="Sell membership passes" hint="Shows active plans on the Pricing page. Existing members keep their passes either way." />
              <SettingToggle settingKey="free_downloads" value={settings.free_downloads} label="Free downloads" hint="Allow free wallpapers to be downloaded without an account." />
              <SettingToggle settingKey="creator_signups" value={settings.creator_signups} label="New creator sign-ups" hint="Let new people join as creators. Existing creators can still upload." />
              <SettingToggle settingKey="newsletter_enabled" value={settings.newsletter_enabled} label="Newsletter sign-up boxes" hint="Show the 'Stay updated' email box on the home and pricing pages." />
              <SettingToggle settingKey="google_login" value={settings.google_login} label="Google sign-in" hint="Show 'Continue with Google' on the sign-in page. Turn on only after enabling the Google provider in Supabase → Authentication → Sign In / Providers." />
            </div>
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Announcement bar" description="A one-line message at the top of every store page.">
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
            </Section>
            <Section title="Downloads per purchase" description="How many times a buyer can download each wallpaper they buy (applies to new purchases).">
              <AdminForm
                action="/api/admin/settings"
                method="PUT"
                fields={[{ name: 'downloads_per_purchase', label: 'Downloads', type: 'number', span: 2 }]}
                initial={{ downloads_per_purchase: settings.downloads_per_purchase }}
                wrapAs="downloads_per_purchase"
              />
            </Section>
          </div>
        </>
      )}

      {tab === 'business' && (
        <>
          <Section
            title="Business details"
            description="Printed on every receipt. With a GSTIN set, Indian orders show as a Tax Invoice with GST split out. ⚠️ Confirm the invoice format and rate with a tax adviser."
          >
            <AdminForm
              action="/api/admin/settings"
              method="PUT"
              fields={[
                { name: 'legal_name', label: 'Legal / trade name', placeholder: 'HirecWallp (proprietor: …)', span: 4 },
                { name: 'address', label: 'Registered address', type: 'textarea' },
                { name: 'gstin', label: 'GSTIN (optional)', placeholder: '24ABCDE1234F1Z5', span: 2 },
                { name: 'gst_rate', label: 'GST rate %', type: 'number', span: 1 },
                { name: 'support_email', label: 'Support email', placeholder: 'support@hirecwallp.com', span: 4 },
              ]}
              initial={seller}
              submitLabel="Save business details"
              wrapAs="business"
            />
          </Section>

          <Section
            title="Grievance officer & legal"
            description="Required by the Consumer Protection (E-Commerce) Rules 2020 — shown on the Grievance, Privacy and Terms pages. Leave blank to use the business name and support email."
          >
            <AdminForm
              action="/api/admin/settings"
              method="PUT"
              fields={[
                { name: 'grievance_name', label: 'Grievance officer name', span: 2 },
                { name: 'grievance_designation', label: 'Designation', span: 2 },
                { name: 'grievance_email', label: 'Grievance email', span: 2 },
                { name: 'grievance_phone', label: 'Phone (optional)' },
                { name: 'jurisdiction_city', label: 'Courts at (city)', placeholder: 'e.g. Ahmedabad' },
              ]}
              initial={settings.legal}
              submitLabel="Save legal details"
              wrapAs="legal"
            />
          </Section>

          <Section title="Social links" description="Footer icons appear only for links you fill in. Use full https:// addresses.">
            <AdminForm
              action="/api/admin/settings"
              method="PUT"
              fields={[
                { name: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/hirecwallp', span: 2 },
                { name: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/hirecwallp', span: 2 },
                { name: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@hirecwallp', span: 2 },
                { name: 'x', label: 'X / Twitter', placeholder: 'https://x.com/hirecwallp', span: 2 },
                { name: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/hirecwallp', span: 2 },
              ]}
              initial={socialLinks(settings)}
              submitLabel="Save links"
              wrapAs="social"
            />
          </Section>
        </>
      )}

      {tab === 'growth' && (
        <Section
          title="Welcome bonus, referrals & programmes"
          description={
            <>
              All of these are bonus credits (they expire). Welcome bonus: once per account, at most 2 per network per 30 days. The inviter is rewarded only when
              their friend makes a first <strong>paid</strong> purchase, capped per month; refunds take it back. Results are on{' '}
              <Link href="/admin/growth" className="underline">Growth</Link>.
            </>
          }
        >
          <AdminForm
            action="/api/admin/settings"
            method="PUT"
            fields={[
              { name: 'welcome_credits', label: 'Welcome credits (everyone)', type: 'number' },
              { name: 'welcome_days', label: 'Welcome credits valid (days)', type: 'number' },
              { name: 'referee_bonus', label: 'Extra credits with a friend’s code', type: 'number' },
              { name: 'referrer_reward', label: 'Inviter reward (credits)', type: 'number' },
              { name: 'referral_monthly_cap', label: 'Max rewards per inviter / month', type: 'number' },
              { name: 'reward_days', label: 'Reward credits valid (days)', type: 'number' },
              { name: 'first_purchase_bonus', label: 'First-purchase bonus credits', type: 'number' },
              { name: 'affiliate_pct', label: 'Creator affiliate commission %', type: 'number' },
              { name: 'daily_email_cap', label: 'Daily-wallpaper emails / day', type: 'number' },
              { name: 'referral_enabled', label: 'Referral programme on', type: 'checkbox' },
              { name: 'gifts_enabled', label: 'Gift credits on', type: 'checkbox' },
              { name: 'affiliate_enabled', label: 'Creator affiliate links on', type: 'checkbox' },
              { name: 'daily_enabled', label: 'Daily free wallpaper on', type: 'checkbox' },
            ]}
            initial={settings.growth}
            submitLabel="Save growth settings"
            wrapAs="growth"
          />
        </Section>
      )}

      {tab === 'prices' && (
        <>
          <Section
            title="Default wallpaper prices"
            description={
              <>
                The price a new wallpaper starts at in each region (in credits — 1 credit = 1 wallpaper; what a credit costs is set in{' '}
                <Link href="/admin/credit-packs" className="underline">Credit packs</Link>), the allowed range for automatic pricing, and how much more the commercial
                licence costs. Fine-tune with <Link href="/admin/pricing" className="underline">Auto pricing</Link>.
              </>
            }
          >
            <div className="divide-y">
              {(rules ?? []).map((r) => (
                <div key={r.region_code as string} className="py-4 first:pt-0 last:pb-0">
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
          </Section>

          <Section
            title="Exchange rates"
            description={
              <>
                Rupees per 1 unit, used for turnover and creator payouts. Refreshed automatically on the 1st of each month from ECB rates (or now from the{' '}
                <Link href="/admin/tax" className="underline">Tax centre</Link>).
              </>
            }
          >
            <AdminForm
              action="/api/admin/settings"
              method="PUT"
              fields={['USD', 'GBP', 'EUR', 'AUD', 'CAD'].map((c) => ({ name: c, label: `₹ per ${c}`, type: 'number' as const }))}
              initial={settings.fx_to_inr}
              submitLabel="Save rates"
              wrapAs="fx_to_inr"
            />
          </Section>
        </>
      )}
      {tab === 'history' && (
        <Section title="Change history" description="Every settings change, newest first — who made it and what changed. Revert puts a setting back to how it was before that change (and is recorded too)." flush>
          {(history ?? []).length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Setting</th>
                  <th>What changed</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((h) => (
                  <tr key={h.id as number}>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(h.created_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="text-xs">{(h.actor_email as string | null) ?? <span className="text-muted-foreground">automatic</span>}</td>
                    <td className="font-medium">{SETTING_LABEL[h.key as string] ?? (h.key as string)}</td>
                    <td className="max-w-md text-xs">
                      {h.note && <p className="text-muted-foreground">{h.note as string}</p>}
                      {h.old_value === null && <p className="text-muted-foreground">First change from the built-in default</p>}
                      {settingDiff(h.old_value ?? (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[h.key as string] ?? null, h.new_value)
                        .slice(0, 6)
                        .map((line) => (
                          <p key={line} className="break-words font-mono">
                            {line}
                          </p>
                        ))}
                    </td>
                    <td className="text-right">
                      {(h.old_value !== null || h.key in DEFAULT_SETTINGS) && (h.key !== 'security' || me.role === 'owner') && <RevertSettingButton id={h.id as number} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}
    </div>
  );
}
