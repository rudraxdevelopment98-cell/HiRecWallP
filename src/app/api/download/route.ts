import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getObject, objectExists, presignedGetUrl, putObject, type R2Bucket } from '@/lib/storage';
import { clientIp, hashIp } from '@/lib/request';
import { isSameOrigin } from '@/lib/http';
import { embedWatermark, isWatermarkConfigured } from '@/lib/watermark';
import { checkFitSize } from '@/lib/fit';
import { ensureFitCrop, sourceSize } from '@/lib/fit-server';

export const runtime = 'nodejs';
// Exact-fit crops are made from the master on first request.
export const maxDuration = 60;

const SIGNED_URL_TTL_SECONDS = 60;
const RATE_LIMIT_PER_HOUR = 30;

// Variants a buyer can download with an entitlement.
const PAID_VARIANTS = ['phone', 'phone_depth', 'desktop_4k', 'desktop_5k', 'tablet', 'ultrawide'] as const;
// Lower-resolution free downloads — never the 4K+ originals.
const FREE_VARIANTS = ['free_phone', 'free_desktop'] as const;

const schema = z.union([
  z.object({ wallpaperId: z.string().uuid(), variant: z.enum([...PAID_VARIANTS, ...FREE_VARIANTS]) }),
  // Exact fit: any screen size the artwork covers (validated against the source below).
  z.object({ wallpaperId: z.string().uuid(), fit: z.object({ w: z.number().int(), h: z.number().int() }) }),
]);

type Variant = (typeof PAID_VARIANTS)[number] | (typeof FREE_VARIANTS)[number];

function isFreeVariant(v: Variant): boolean {
  return (FREE_VARIANTS as readonly string[]).includes(v);
}

type Supabase = ReturnType<typeof createServiceClient>;

/**
 * Forensic watermark: on the first paid download of each size, embed the order
 * id and cache the result per entitlement. Falls back to the clean file when
 * the worker isn't configured or embedding fails.
 */
async function watermarked(
  entitlement: { id: string; order_id: string | null; licence: string | null },
  bucket: R2Bucket,
  key: string,
  cacheName: string,
): Promise<{ bucket: R2Bucket; key: string }> {
  if (!isWatermarkConfigured() || !entitlement.order_id) return { bucket, key };
  const cachedKey = `wm/${entitlement.id}/${cacheName}.jpg`;
  if (await objectExists('private', cachedKey)) return { bucket: 'private', key: cachedKey };
  try {
    const marked = await embedWatermark(await getObject(bucket, key), { orderId: entitlement.order_id, licence: entitlement.licence ?? 'personal' });
    if (marked) {
      await putObject('private', cachedKey, marked, 'image/jpeg');
      return { bucket: 'private', key: cachedKey };
    }
  } catch {
    // Keep the clean file on any watermarking error.
  }
  return { bucket, key };
}

/** Pick an entitlement with downloads left (commercial first) and atomically claim one download. */
async function claimEntitlement(supabase: Supabase, userId: string, wallpaperId: string) {
  const { data: owned } = await supabase
    .from('entitlements')
    .select('id, order_id, licence, max_downloads, downloads_used')
    .eq('user_id', userId)
    .eq('wallpaper_id', wallpaperId);
  const entitlement =
    [...(owned ?? [])]
      .sort((a, b) => (a.licence === b.licence ? 0 : a.licence === 'commercial' ? -1 : 1))
      .find((e) => Number(e.downloads_used) < Number(e.max_downloads)) ?? owned?.[0] ?? null;
  if (!entitlement) return { error: NextResponse.json({ error: 'No entitlement' }, { status: 403 }) };
  const { data: used, error } = await supabase.rpc('claim_entitlement_download', { p_entitlement: entitlement.id });
  if (error) throw error;
  if (used == null) return { error: NextResponse.json({ error: 'Download limit reached' }, { status: 403 }) };
  return { entitlement: entitlement as { id: string; order_id: string | null; licence: string | null }, used: used as number };
}

async function rateLimited(supabase: Supabase, ipHash: string, userId?: string): Promise<boolean> {
  const [{ data: ipCount }, userCount] = await Promise.all([
    supabase.rpc('downloads_last_hour_ip', { p_ip_hash: ipHash }),
    userId ? supabase.rpc('downloads_last_hour_user', { p_user: userId }).then((r) => r.data) : Promise.resolve(0),
  ]);
  return (ipCount ?? 0) >= RATE_LIMIT_PER_HOUR || (userCount ?? 0) >= RATE_LIMIT_PER_HOUR;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const input = parsed.data;
  const wallpaperId = input.wallpaperId;
  const userAgent = request.headers.get('user-agent') ?? null;

  try {
    // Reads DOWNLOAD_TOKEN_SECRET; a missing secret surfaces as 503, not 500.
    const ipHash = hashIp(clientIp(request));
    const supabase = createServiceClient();

    const { data: wallpaper } = await supabase
      .from('wallpapers')
      .select('id, is_free, status, source_width, source_height')
      .eq('id', wallpaperId)
      .maybeSingle();
    if (!wallpaper || wallpaper.status !== 'published') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // --- Exact fit: a crop for the buyer's own screen, made from the master ----
    if ('fit' in input) {
      const src = await sourceSize(supabase, wallpaper);
      const user = await getUser();
      // Free wallpapers: anyone, capped below 4K-class sizes. Otherwise an entitlement is needed.
      const freePath = Boolean(wallpaper.is_free);
      const check = checkFitSize(input.fit.w, input.fit.h, src.w, src.h, { free: freePath });
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });
      const sourceKey = src.masterKey ?? src.fallbackKey;
      if (!sourceKey) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      if (freePath) {
        if (!(await getSettings()).free_downloads) return NextResponse.json({ error: 'Free downloads are paused right now.' }, { status: 503 });
        if (await rateLimited(supabase, ipHash, user?.id)) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        const key = await ensureFitCrop(wallpaperId, check.w, check.h, sourceKey);
        const url = await presignedGetUrl('private', key, SIGNED_URL_TTL_SECONDS);
        await supabase.from('downloads').insert({ user_id: user?.id ?? null, wallpaper_id: wallpaperId, ip_hash: ipHash, user_agent: userAgent, fit_size: `${check.w}x${check.h}` });
        return NextResponse.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS });
      }
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      if (await rateLimited(supabase, ipHash, user.id)) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      const claim = await claimEntitlement(supabase, user.id, wallpaperId);
      if ('error' in claim) return claim.error;
      const crop = await ensureFitCrop(wallpaperId, check.w, check.h, sourceKey);
      const deliver = await watermarked(claim.entitlement, 'private', crop, `fit-${check.w}x${check.h}`);
      const url = await presignedGetUrl(deliver.bucket, deliver.key, SIGNED_URL_TTL_SECONDS);
      await supabase.from('downloads').insert({
        user_id: user.id,
        wallpaper_id: wallpaperId,
        entitlement_id: claim.entitlement.id,
        ip_hash: ipHash,
        user_agent: userAgent,
        watermark_payload: `order:${claim.entitlement.order_id ?? claim.entitlement.id}`,
        fit_size: `${check.w}x${check.h}`,
      });
      return NextResponse.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS, downloadsUsed: claim.used });
    }

    const variant = input.variant;
    // Resolve the asset (service role; private rows are never exposed to anon).
    const { data: asset } = await supabase
      .from('wallpaper_assets')
      .select('id, storage_bucket, storage_key')
      .eq('wallpaper_id', wallpaperId)
      .eq('variant', variant)
      .maybeSingle();
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // --- Free variant path: no login, IP rate-limited, originals excluded ----
    if (isFreeVariant(variant)) {
      if (!(await getSettings()).free_downloads) {
        return NextResponse.json({ error: 'Free downloads are paused right now.' }, { status: 503 });
      }
      if (!wallpaper.is_free) {
        return NextResponse.json({ error: 'Not a free wallpaper' }, { status: 403 });
      }
      if (await rateLimited(supabase, ipHash)) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }
      const url = await presignedGetUrl(asset.storage_bucket as R2Bucket, asset.storage_key, SIGNED_URL_TTL_SECONDS);
      await supabase.from('downloads').insert({
        user_id: null,
        wallpaper_id: wallpaperId,
        asset_id: asset.id,
        ip_hash: ipHash,
        user_agent: userAgent,
      });
      return NextResponse.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS });
    }

    // --- Paid variant path: auth + entitlement + per-entitlement counter -----
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (await rateLimited(supabase, ipHash, user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    const claim = await claimEntitlement(supabase, user.id, wallpaperId);
    if ('error' in claim) return claim.error;

    const deliver = await watermarked(claim.entitlement, asset.storage_bucket as R2Bucket, asset.storage_key, variant);
    const url = await presignedGetUrl(deliver.bucket, deliver.key, SIGNED_URL_TTL_SECONDS);

    // Record the grant. watermark_payload captures the order reference embedded
    // per buyer for traceability.
    await supabase.from('downloads').insert({
      user_id: user.id,
      wallpaper_id: wallpaperId,
      asset_id: asset.id,
      entitlement_id: claim.entitlement.id,
      ip_hash: ipHash,
      user_agent: userAgent,
      watermark_payload: `order:${claim.entitlement.order_id ?? claim.entitlement.id}`,
    });

    return NextResponse.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS, downloadsUsed: claim.used });
  } catch {
    return NextResponse.json({ error: 'Download unavailable' }, { status: 503 });
  }
}
