/**
 * Provider-agnostic AI adapter contracts. Business logic (the generation
 * pipeline) depends only on these interfaces; concrete providers (mock, or a
 * commercial API chosen via env) implement them. Only providers whose terms
 * allow commercial resale of outputs may be used in production.
 */

export type AspectKey = 'phone' | 'desktop' | 'tablet' | 'ultrawide';

export interface GeneratedImage {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: string;
}

export interface ImageGenInput {
  prompt: string;
  negativePrompt?: string;
  aspect: AspectKey;
  seed?: number;
}

export interface ImageProvider {
  readonly id: string;
  generate(input: ImageGenInput): Promise<GeneratedImage>;
}

export interface UpscaleProvider {
  readonly id: string;
  /** Upscale by a factor (e.g. 2 or 4) toward 4K/5K output. */
  upscale(image: Buffer, factor: number): Promise<Buffer>;
}

export interface QualityReview {
  score: number; // 1–10
  reasons: string;
}

export interface SuggestedMetadata {
  title: string;
  slug: string;
  description: string;
  altText: string;
  tags: string[];
  suggestedFree: boolean;
}

export interface Moderation {
  allowed: boolean;
  reasons: string;
}

export interface VisionProvider {
  readonly id: string;
  /** Score composition/quality 1–10 (drop < 7). */
  score(image: Buffer): Promise<QualityReview>;
  /** Title, tags, alt text, description, SEO slug, suggested free/paid. */
  describe(image: Buffer, context: { prompt: string; niche: string }): Promise<SuggestedMetadata>;
  /**
   * Content screening for creator uploads: rejects NSFW, trademarked
   * characters/brand logos, and real people/celebrities.
   */
  moderate(image: Buffer, context: { title?: string }): Promise<Moderation>;
}
