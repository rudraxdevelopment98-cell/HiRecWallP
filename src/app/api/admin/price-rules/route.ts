import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const schema = z
  .object({
    region_code: z.enum(['IN', 'T1', 'T2', 'T3']),
    base_price: z.number().positive(),
    min_price: z.number().positive(),
    max_price: z.number().positive(),
    commercial_multiplier: z.number().min(1).max(50),
  })
  .refine((v) => v.min_price <= v.base_price && v.base_price <= v.max_price, 'Need min ≤ base ≤ max');

/**
 * Admin: default (global) price for a region + its commercial multiplier.
 * Wallpapers with their own price row keep it; new ones start from this.
 */
export async function PATCH(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  const { region_code, commercial_multiplier, ...rule } = parsed.data;
  const supabase = createServiceClient();
  const [a, b] = await Promise.all([
    supabase.from('price_rules').update(rule).eq('scope', 'global').eq('region_code', region_code),
    supabase.from('regions').update({ commercial_multiplier }).eq('code', region_code),
  ]);
  if (a.error || b.error) return NextResponse.json({ error: 'Could not save' }, { status: 400 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
