import 'server-only';

import sharp from 'sharp';
import type { R2Bucket } from '@/lib/r2';

/**
 * Server-side image processing (sharp).
 *
 * From one high-resolution original we derive:
 *   - paid full-res variants (phone/desktop/tablet/ultrawide) → PRIVATE bucket
 *   - lower-res free variants → PRIVATE bucket (served via signed URL only)
 *   - a watermarked preview (≤720px long edge, JPEG ~q70) → PUBLIC bucket
 *   - a watermarked 600×600 detail crop → PUBLIC bucket
 *
 * Originals and paid variants NEVER go to the public bucket.
 */

export interface GeneratedVariant {
  variant:
    | 'phone'
    | 'desktop_4k'
    | 'desktop_5k'
    | 'tablet'
    | 'ultrawide'
    | 'free_phone'
    | 'free_desktop'
    | 'preview'
    | 'preview_crop';
  buffer: Buffer;
  width: number;
  height: number;
  bucket: R2Bucket;
  contentType: string;
  ext: string;
}

const PAID_SIZES: Array<{ variant: GeneratedVariant['variant']; w: number; h: number }> = [
  { variant: 'phone', w: 1440, h: 3120 },
  { variant: 'desktop_4k', w: 3840, h: 2160 },
  { variant: 'desktop_5k', w: 5120, h: 2880 },
  { variant: 'tablet', w: 2048, h: 2732 },
  { variant: 'ultrawide', w: 5120, h: 2160 },
];

const FREE_SIZES: Array<{ variant: GeneratedVariant['variant']; w: number; h: number }> = [
  { variant: 'free_phone', w: 1080, h: 2340 },
  { variant: 'free_desktop', w: 1920, h: 1080 },
];

const PREVIEW_MAX_LONG_EDGE = 720;
const PREVIEW_CROP = 600;

/** Tiled diagonal visible watermark as an SVG overlay sized to the image. */
function watermarkSvg(width: number, height: number, brand: string): Buffer {
  const text = `${brand} • preview`;
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="320" height="200" patternUnits="userSpaceOnUse"
                 patternTransform="rotate(-30)">
          <text x="0" y="100" font-family="sans-serif" font-size="28"
                fill="rgba(255,255,255,0.35)">${text}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" />
    </svg>`,
  );
}

async function cover(
  original: Buffer,
  w: number,
  h: number,
  quality: number,
): Promise<Buffer> {
  return sharp(original)
    .resize(w, h, { fit: 'cover', position: 'attention' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

export async function generateVariants(
  original: Buffer,
  brand: string,
): Promise<GeneratedVariant[]> {
  const out: GeneratedVariant[] = [];

  for (const size of PAID_SIZES) {
    out.push({
      variant: size.variant,
      buffer: await cover(original, size.w, size.h, 90),
      width: size.w,
      height: size.h,
      bucket: 'private',
      contentType: 'image/jpeg',
      ext: 'jpg',
    });
  }

  for (const size of FREE_SIZES) {
    out.push({
      variant: size.variant,
      buffer: await cover(original, size.w, size.h, 82),
      width: size.w,
      height: size.h,
      bucket: 'private',
      contentType: 'image/jpeg',
      ext: 'jpg',
    });
  }

  // Preview: downscale to <=720 long edge, apply watermark, JPEG ~q70.
  const base = sharp(original).resize(PREVIEW_MAX_LONG_EDGE, PREVIEW_MAX_LONG_EDGE, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  const meta = await base.clone().toBuffer({ resolveWithObject: true });
  const pw = meta.info.width;
  const ph = meta.info.height;
  const previewBuffer = await base
    .composite([{ input: watermarkSvg(pw, ph, brand), blend: 'over' }])
    .jpeg({ quality: 70 })
    .toBuffer();
  out.push({
    variant: 'preview',
    buffer: previewBuffer,
    width: pw,
    height: ph,
    bucket: 'public',
    contentType: 'image/jpeg',
    ext: 'jpg',
  });

  // Detail crop: centered 600×600, watermarked.
  const cropBuffer = await sharp(original)
    .resize(PREVIEW_CROP, PREVIEW_CROP, { fit: 'cover', position: 'attention' })
    .composite([{ input: watermarkSvg(PREVIEW_CROP, PREVIEW_CROP, brand), blend: 'over' }])
    .jpeg({ quality: 72 })
    .toBuffer();
  out.push({
    variant: 'preview_crop',
    buffer: cropBuffer,
    width: PREVIEW_CROP,
    height: PREVIEW_CROP,
    bucket: 'public',
    contentType: 'image/jpeg',
    ext: 'jpg',
  });

  return out;
}
