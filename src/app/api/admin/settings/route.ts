import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { clearSettingsCache } from '@/lib/settings';

export const runtime = 'nodejs';

const bool = z.boolean();
const schema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('store_open'), value: bool }),
  z.object({ key: z.literal('membership_enabled'), value: bool }),
  z.object({ key: z.literal('creator_signups'), value: bool }),
  z.object({ key: z.literal('free_downloads'), value: bool }),
  z.object({ key: z.literal('newsletter_enabled'), value: bool }),
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
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
