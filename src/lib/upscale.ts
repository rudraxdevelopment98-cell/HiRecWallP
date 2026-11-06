import 'server-only';

import { getUpscaleProvider } from '@/lib/ai';
import { openImage } from '@/lib/image-safety';
import { plannedSizes } from '@/lib/imaging';

/** Uploads at least this big (long edge) may be upscaled when a real AI upscaler is configured. */
export const UPSCALE_MIN_LONG_EDGE = 2560;

/** Only a real provider counts: the built-in mock just resizes, which would sell a soft image as 4K. */
export const upscaleAvailable = () => getUpscaleProvider().id !== 'mock';

export interface PreparedOriginal {
  buffer: Buffer;
  width: number;
  height: number;
  /** "WxH" of the upload when it was upscaled, else null. */
  upscaledFrom: string | null;
}

/**
 * Admin uploads: if the image is too small for any paid size but close (long
 * edge >= 2560 px) and an AI upscaler is configured, upscale it 2× first.
 * Otherwise the original is returned unchanged (and generateVariants rejects it).
 */
export async function prepareOriginal(original: Buffer): Promise<PreparedOriginal> {
  const m = await openImage(original).metadata();
  const rotated = (m.orientation ?? 1) >= 5;
  const width = (rotated ? m.height : m.width) ?? 0;
  const height = (rotated ? m.width : m.height) ?? 0;
  const tooSmall = plannedSizes(width, height).paid.length === 0;
  if (!tooSmall || Math.max(width, height) < UPSCALE_MIN_LONG_EDGE || !upscaleAvailable()) {
    return { buffer: original, width, height, upscaledFrom: null };
  }
  const upright = await openImage(original).rotate().toBuffer();
  const buffer = await getUpscaleProvider().upscale(upright, 2);
  const out = await openImage(buffer).metadata();
  return { buffer, width: out.width ?? width * 2, height: out.height ?? height * 2, upscaledFrom: `${width}x${height}` };
}

export function tooSmallMessage(base: string): string {
  return upscaleAvailable()
    ? `${base}. Use at least ${UPSCALE_MIN_LONG_EDGE}px on the long edge (smaller images can't be upscaled well).`
    : `${base}. Use at least 3840px on the long edge (an AI upscaler isn't set up).`;
}
