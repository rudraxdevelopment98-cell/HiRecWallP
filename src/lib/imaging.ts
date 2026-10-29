import 'server-only';

import sharp from 'sharp';
import type { R2Bucket } from '@/lib/r2';

/**
 * Server-side image processing (sharp).
 *
 * From one high-resolution original we derive (see docs/STORAGE_STRATEGY.md):
 *   - paid full-res variants matching the artwork's orientation → PRIVATE bucket
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

type SizeSpec = { variant: GeneratedVariant['variant']; w: number; h: number };
export type Orientation = 'portrait' | 'landscape' | 'square';

const PHONE: SizeSpec = { variant: 'phone', w: 1440, h: 3120 };
const TABLET: SizeSpec = { variant: 'tablet', w: 2048, h: 2732 };
const DESKTOP_4K: SizeSpec = { variant: 'desktop_4k', w: 3840, h: 2160 };
const DESKTOP_5K: SizeSpec = { variant: 'desktop_5k', w: 5120, h: 2880 };
const ULTRAWIDE: SizeSpec = { variant: 'ultrawide', w: 5120, h: 2160 };
const FREE_PHONE: SizeSpec = { variant: 'free_phone', w: 1080, h: 2340 };
const FREE_DESKTOP: SizeSpec = { variant: 'free_desktop', w: 1920, h: 1080 };

/** A crop may enlarge the source by at most this much before it's skipped. */
const MAX_UPSCALE = 1.15;

export class ImageTooSmallError extends Error {
  constructor(width: number, height: number) {
    super(`Image too small (${width}×${height}) for any paid size`);
  }
}

export function orientationOf(width: number, height: number): Orientation {
  const ratio = width / height;
  if (ratio < 0.9) return 'portrait';
  if (ratio > 1.1) return 'landscape';
  return 'square';
}

/**
 * Device sizes that suit the source: a portrait artwork is never cropped into
 * a 21:9 desktop frame (and vice versa), and nothing is upscaled more than
 * MAX_UPSCALE. Ultrawide only for sources that are already very wide.
 */
export function plannedSizes(width: number, height: number): { paid: SizeSpec[]; free: SizeSpec[] } {
  const o = orientationOf(width, height);
  const paidCandidates =
    o === 'portrait'
      ? [PHONE, TABLET]
      : o === 'landscape'
        ? [DESKTOP_4K, DESKTOP_5K, ...(width / height >= 2 ? [ULTRAWIDE] : [])]
        : [PHONE, TABLET, DESKTOP_4K];
  const free = o === 'portrait' ? [FREE_PHONE] : o === 'landscape' ? [FREE_DESKTOP] : [FREE_PHONE, FREE_DESKTOP];
  const fits = (s: SizeSpec) => Math.max(s.w / width, s.h / height) <= MAX_UPSCALE;
  return { paid: paidCandidates.filter(fits), free: free.filter(fits) };
}

/** Upright pixel dimensions (accounts for EXIF rotation). */
async function uprightSize(original: Buffer): Promise<{ width: number; height: number }> {
  const m = await sharp(original).metadata();
  const w = m.width ?? 0;
  const h = m.height ?? 0;
  return (m.orientation ?? 1) >= 5 ? { width: h, height: w } : { width: w, height: h };
}

/**
 * The master we keep in the private bucket. JPEG uploads are kept byte-for-byte
 * (no generational loss); PNG/WebP/TIFF masters — typically 40–80 MB from an
 * upscaler — are stored as visually lossless JPEG q95 4:4:4 (~10× smaller).
 */
export async function encodeMaster(original: Buffer): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const m = await sharp(original).metadata();
  if (m.format === 'jpeg') return { buffer: original, contentType: 'image/jpeg', ext: 'jpg' };
  const buffer = await sharp(original)
    .rotate()
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
  return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
}

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
    .rotate()
    .resize(w, h, { fit: 'cover', position: 'attention' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

export async function generateVariants(
  original: Buffer,
  brand: string,
): Promise<GeneratedVariant[]> {
  const out: GeneratedVariant[] = [];
  const { width, height } = await uprightSize(original);
  const { paid, free } = plannedSizes(width, height);
  if (paid.length === 0) throw new ImageTooSmallError(width, height);

  for (const size of paid) {
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

  for (const size of free) {
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
  const base = sharp(original).rotate().resize(PREVIEW_MAX_LONG_EDGE, PREVIEW_MAX_LONG_EDGE, {
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
    .rotate()
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
