import 'server-only';

import sharp from 'sharp';

/**
 * Perceptual hashing for near-duplicate detection.
 *
 * dHash: downscale to 9×8 greyscale, compare each pixel to its right neighbour
 * → 64 bits, returned as 16 hex chars. Hamming distance between two hashes
 * estimates visual similarity (small distance = looks the same).
 */
export async function dHash(image: Buffer): Promise<string> {
  const w = 9;
  const h = 8;
  const raw = await sharp(image)
    .greyscale()
    .resize(w, h, { fit: 'fill' })
    .raw()
    .toBuffer();

  let bits = '';
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w - 1; col++) {
      const left = raw[row * w + col]!;
      const right = raw[row * w + col + 1]!;
      bits += left < right ? '1' : '0';
    }
  }
  // 64 bits → 16 hex chars
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Hamming distance between two equal-length hex hashes (bit differences). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/** Default threshold (out of 64 bits) under which two images are "near-duplicate". */
export const NEAR_DUPLICATE_THRESHOLD = 8;

export function isNearDuplicate(a: string, b: string, threshold = NEAR_DUPLICATE_THRESHOLD): boolean {
  return hammingDistance(a, b) <= threshold;
}
