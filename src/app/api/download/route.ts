import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getObject, objectExists, presignedGetUrl, putObject, type R2Bucket } from '@/lib/r2';
import { clientIp, hashIp } from '@/lib/request';
import { isSameOrigin } from '@/lib/http';
import { embedWatermark, isWatermarkConfigured } from '@/lib/watermark';

export const runtime = 'nodejs';

const SIGNED_URL_TTL_SECONDS = 60;
const RATE_LIMIT_PER_HOUR = 30;

// Variants a buyer can download with an entitlement.
const PAID_VARIANTS = [
  'phone',
  'phone_depth',
  'desktop_4k',
  'desktop_5k',
  'tablet',
  'ultrawide',
] as const;
// Lower-resolution free downloads — never the 4K+ originals.
const FREE_VARIANTS = ['free_phone', 'free_desktop'] as const;

const schema = z.object({
  wallpaperId: z.string().uuid(),
  variant: z.enum([...PAID_VARIANTS, ...FREE_VARIANTS]),
});

type Variant = z.infer<typeof schema>['variant'];

function isFreeVariant(v: Variant): boolean {
  return (FREE_VARIANTS as readonly string[]).includes(v);
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
  const { wallpaperId, variant } = parsed.data;
  const userAgent = request.headers.get('user-agent') ?? null;

  try {
    // Reads DOWNLOAD_TOKEN_SECRET; a missing secret surfaces as 503, not 500.
    const ipHash = hashIp(clientIp(request));
    const supabase = createServiceClient();

    // Resolve the asset (service role; private rows are never exposed to anon).
    const { data: asset } = await supabase
      .from('wallpaper_assets')
      .select('id, storage_bucket, storage_key')
      .eq('wallpaper_id', wallpaperId)
      .eq('variant', variant)
      .maybeSingle();
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const { data: wallpaper } = await supabase
      .from('wallpapers')
      .select('id, is_free, status')
      .eq('id', wallpaperId)
      .maybeSingle();
    if (!wallpaper || wallpaper.status !== 'published') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // --- Free variant path: no login, IP rate-limited, originals excluded ----
    if (isFreeVariant(variant)) {
      if (!wallpaper.is_free) {
        return NextResponse.json({ error: 'Not a free wallpaper' }, { status: 403 });
      }
      const { data: ipCount } = await supabase.rpc('downloads_last_hour_ip', {
        p_ip_hash: ipHash,
      });
      if ((ipCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }

      const url = await presignedGetUrl(
        asset.storage_bucket as R2Bucket,
        asset.storage_key,
        SIGNED_URL_TTL_SECONDS,
      );
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

    const [{ data: userCount }, { data: ipCount }] = await Promise.all([
      supabase.rpc('downloads_last_hour_user', { p_user: user.id }),
      supabase.rpc('downloads_last_hour_ip', { p_ip_hash: ipHash }),
    ]);
    if ((userCount ?? 0) >= RATE_LIMIT_PER_HOUR || (ipCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { data: entitlement } = await supabase
      .from('entitlements')
      .select('id, order_id, licence')
      .eq('user_id', user.id)
      .eq('wallpaper_id', wallpaperId)
      .maybeSingle();
    if (!entitlement) {
      return NextResponse.json({ error: 'No entitlement' }, { status: 403 });
    }

    // Atomically claim one download; NULL means the limit is reached.
    const { data: used, error: claimErr } = await supabase.rpc('claim_entitlement_download', {
      p_entitlement: entitlement.id,
    });
    if (claimErr) throw claimErr;
    if (used == null) {
      return NextResponse.json({ error: 'Download limit reached' }, { status: 403 });
    }

    // Forensic watermark: on the first paid download of each variant, embed the
    // order id and cache the result per entitlement+variant. Subsequent
    // downloads reuse the cached copy. Falls back to the original when the
    // worker isn't configured or embedding fails.
    let deliverBucket = asset.storage_bucket as R2Bucket;
    let deliverKey = asset.storage_key;
    if (isWatermarkConfigured() && entitlement.order_id) {
      const cachedKey = `wm/${entitlement.id}/${variant}.jpg`;
      if (await objectExists('private', cachedKey)) {
        deliverBucket = 'private';
        deliverKey = cachedKey;
      } else {
        try {
          const original = await getObject(asset.storage_bucket as R2Bucket, asset.storage_key);
          const marked = await embedWatermark(original, {
            orderId: entitlement.order_id,
            licence: entitlement.licence ?? 'personal',
          });
          if (marked) {
            await putObject('private', cachedKey, marked, 'image/jpeg');
            deliverBucket = 'private';
            deliverKey = cachedKey;
          }
        } catch {
          // Keep the original on any watermarking error.
        }
      }
    }

    const url = await presignedGetUrl(deliverBucket, deliverKey, SIGNED_URL_TTL_SECONDS);

    // Record the grant. watermark_payload captures the order reference embedded
    // per buyer for traceability.
    await supabase.from('downloads').insert({
      user_id: user.id,
      wallpaper_id: wallpaperId,
      asset_id: asset.id,
      entitlement_id: entitlement.id,
      ip_hash: ipHash,
      user_agent: userAgent,
      watermark_payload: `order:${entitlement.order_id ?? entitlement.id}`,
    });

    return NextResponse.json({ url, expiresIn: SIGNED_URL_TTL_SECONDS, downloadsUsed: used });
  } catch {
    return NextResponse.json({ error: 'Download unavailable' }, { status: 503 });
  }
}
