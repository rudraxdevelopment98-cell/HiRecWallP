import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminGuard, audit } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { clearSettingsCache } from '@/lib/settings';
import { REGION_CODES } from '@/lib/geo';

export const runtime = 'nodejs';

const bool = z.boolean();
const httpsUrl = z.string().trim().max(300).refine((h) => h === '' || /^https:\/\//.test(h), 'Links must start with https://');
const schema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('store_open'), value: bool }),
  z.object({ key: z.literal('membership_enabled'), value: bool }),
  z.object({ key: z.literal('creator_signups'), value: bool }),
  z.object({ key: z.literal('free_downloads'), value: bool }),
  z.object({ key: z.literal('newsletter_enabled'), value: bool }),
  z.object({ key: z.literal('google_login'), value: bool }),
  z.object({ key: z.literal('creator_credit_value_inr'), value: z.number().min(0.5).max(100) }),
  z.object({
    key: z.literal('growth'),
    value: z.object({
      welcome_credits: z.number().int().min(0).max(100),
      welcome_days: z.number().int().min(1).max(365),
      referral_enabled: bool,
      referee_bonus: z.number().int().min(0).max(100),
      referrer_reward: z.number().int().min(0).max(500),
      referral_monthly_cap: z.number().int().min(0).max(1000),
      reward_days: z.number().int().min(1).max(730),
      first_purchase_bonus: z.number().int().min(0).max(100),
      gifts_enabled: bool,
      affiliate_enabled: bool,
      affiliate_pct: z.number().min(0).max(50),
      daily_enabled: bool,
      daily_email_cap: z.number().int().min(0).max(10000),
    }),
  }),
  z.object({ key: z.literal('fx_to_inr'), value: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive().max(10000)) }),
  z.object({
    key: z.literal('country_tiers'),
    value: z.record(z.string().regex(/^[A-Z]{2}$/), z.enum(REGION_CODES)).refine((v) => Object.keys(v).length <= 300, 'Too many overrides'),
  }),
  z.object({
    key: z.literal('business'),
    value: z.object({
      legal_name: z.string().trim().max(160),
      address: z.string().trim().max(500),
      gstin: z.string().trim().toUpperCase().refine((g) => g === '' || /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$/.test(g), 'GSTIN should be 15 characters, e.g. 24ABCDE1234F1Z5'),
      gst_rate: z.number().min(0).max(40).nullable().transform((n) => n ?? 18),
      support_email: z.string().trim().max(200).refine((e) => e === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), 'Enter a valid email'),
    }),
  }),
  z.object({
    key: z.literal('social'),
    value: z.object({ instagram: httpsUrl, youtube: httpsUrl, x: httpsUrl, facebook: httpsUrl, pinterest: httpsUrl }),
  }),
  z.object({ key: z.literal('downloads_per_purchase'), value: z.number().int().min(1).max(50) }),
  z.object({
    key: z.literal('announcement'),
    value: z.object({
      enabled: bool,
      text: z.string().trim().max(160),
      href: z.string().trim().max(300).refine((h) => h === '' || h.startsWith('/') || /^https:\/\//.test(h), 'Link must start with / or https://'),
    }),
  }),
]);

/** Admin: save one site setting. */
export async function PUT(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid setting' }, { status: 400 });
  const { error } = await createServiceClient()
    .from('site_settings')
    .upsert({ key: parsed.data.key, value: parsed.data.value, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 400 });
  clearSettingsCache();
  await audit('settings.update', 'setting', parsed.data.key, { value: parsed.data.value as unknown });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
