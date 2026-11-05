import sharp from 'sharp';

/**
 * Largest image we decode: 120 megapixels (e.g. 12000 × 10000) — well above any
 * wallpaper we sell, far below sharp's default (~268 MP). Caps memory use so a
 * crafted "decompression bomb" upload can't exhaust a serverless function.
 */
export const MAX_INPUT_PIXELS = 120_000_000;

/** Open untrusted image bytes with safe decoder limits. */
export function openImage(input: Buffer) {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true });
}
