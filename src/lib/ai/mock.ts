import 'server-only';

import crypto from 'node:crypto';
import sharp from 'sharp';
import type {
  AspectKey,
  GeneratedImage,
  ImageGenInput,
  ImageProvider,
  QualityReview,
  SuggestedMetadata,
  UpscaleProvider,
  VisionProvider,
} from './types';

/**
 * Built-in MOCK providers so the whole Phase 2 pipeline runs offline and in CI
 * without any paid keys. They produce deterministic gradient art and heuristic
 * metadata. Swap in real providers via IMAGE_PROVIDER / UPSCALE_PROVIDER /
 * ANTHROPIC_API_KEY without touching the pipeline.
 */

const ASPECT_SIZE: Record<AspectKey, { w: number; h: number }> = {
  phone: { w: 768, h: 1024 },
  desktop: { w: 1280, h: 720 },
  tablet: { w: 900, h: 1200 },
  ultrawide: { w: 1280, h: 540 },
};

function hashInts(seed: string, n: number): number[] {
  const h = crypto.createHash('sha256').update(seed).digest();
  return Array.from({ length: n }, (_, i) => h[i % h.length]!);
}

function hsl(n: number, s = 60, l = 24) {
  return `hsl(${n % 360} ${s}% ${l}%)`;
}

function gradientSvg(w: number, h: number, seed: string): Buffer {
  const [a, b, c] = hashInts(seed, 3);
  const base = hsl(a! * 1.4, 40, 6);
  const mid = hsl(b! * 1.4, 65, 28);
  const hi = hsl(c! * 1.4, 80, 55);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <radialGradient id="g" cx="32%" cy="24%" r="85%">
          <stop offset="0%" stop-color="${hi}" stop-opacity="0.95"/>
          <stop offset="45%" stop-color="${mid}"/>
          <stop offset="100%" stop-color="${base}"/>
        </radialGradient>
        <filter id="b"><feGaussianBlur stdDeviation="30"/></filter>
      </defs>
      <rect width="100%" height="100%" fill="${base}"/>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <ellipse cx="${w * 0.72}" cy="${h * 0.7}" rx="${w * 0.5}" ry="${h * 0.3}" fill="${mid}" opacity="0.4" filter="url(#b)"/>
    </svg>`,
  );
}

export const mockImageProvider: ImageProvider = {
  id: 'mock',
  async generate(input: ImageGenInput): Promise<GeneratedImage> {
    const { w, h } = ASPECT_SIZE[input.aspect];
    const seed = `${input.prompt}:${input.seed ?? 0}`;
    const buffer = await sharp(gradientSvg(w, h, seed)).jpeg({ quality: 82 }).toBuffer();
    return { buffer, width: w, height: h, contentType: 'image/jpeg' };
  },
};

export const mockUpscaleProvider: UpscaleProvider = {
  id: 'mock',
  async upscale(image: Buffer, factor: number): Promise<Buffer> {
    const meta = await sharp(image).metadata();
    const w = Math.round((meta.width ?? 1024) * factor);
    const h = Math.round((meta.height ?? 1365) * factor);
    return sharp(image).resize(w, h, { kernel: 'lanczos3' }).jpeg({ quality: 90 }).toBuffer();
  },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

const TITLE_WORDS = ['Cosmic', 'Sacred', 'Obsidian', 'Aurora', 'Ethereal', 'Golden', 'Midnight', 'Divine'];

export const mockVisionProvider: VisionProvider = {
  id: 'mock',
  async score(image: Buffer): Promise<QualityReview> {
    const h = crypto.createHash('sha256').update(image).digest();
    const score = 7 + (h[0]! % 3); // 7–9, so mock candidates generally pass the >=7 gate
    return { score, reasons: 'Mock review: balanced composition, no visible artifacts or text glitches.' };
  },
  async describe(image: Buffer, context): Promise<SuggestedMetadata> {
    const h = crypto.createHash('sha256').update(image).digest();
    const w1 = TITLE_WORDS[h[0]! % TITLE_WORDS.length]!;
    const w2 = TITLE_WORDS[h[1]! % TITLE_WORDS.length]!;
    const title = `${w1} ${w2}`;
    const tags = context.prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 6);
    return {
      title,
      slug: `${slugify(title)}-${h.toString('hex').slice(0, 6)}`,
      description: `${title} — an ultra-HD, AI-crafted ${context.niche} wallpaper.`,
      altText: `${title} ${context.niche} wallpaper`,
      tags,
      suggestedFree: h[2]! % 3 === 0,
    };
  },
};
