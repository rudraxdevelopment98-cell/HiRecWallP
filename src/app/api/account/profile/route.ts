import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

// Indian GSTIN: 2-digit state, PAN (5 letters, 4 digits, 1 letter), entity no., 'Z', checksum.
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const schema = z.object({
  display_name: z.string().trim().max(80).optional().transform((v) => v || null),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/)
    .optional()
    .transform((v) => v || null),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || GSTIN.test(v), 'Invalid GSTIN format')
    .optional()
    .transform((v) => v || null),
});

/** Update the caller's own profile (RLS + column grants: name, country, GSTIN only). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { error } = await (await createClient()).from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
