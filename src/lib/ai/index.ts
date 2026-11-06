import 'server-only';

import { mockImageProvider, mockUpscaleProvider, mockVisionProvider } from './mock';
import { claudeVisionProvider } from './claude';
import type { ImageProvider, UpscaleProvider, VisionProvider } from './types';

/**
 * Resolve AI providers from env, defaulting to the built-in mock providers so
 * the pipeline runs without paid keys. Register real providers here (e.g. a
 * Flux-class generator via fal/Replicate) once the owner picks one and sets
 * IMAGE_PROVIDER / UPSCALE_PROVIDER / ANTHROPIC_API_KEY.
 */
export function getImageProvider(): ImageProvider {
  switch ((process.env.IMAGE_PROVIDER ?? 'mock').toLowerCase()) {
    case 'mock':
    case '':
      return mockImageProvider;
    default:
      // Unknown/unconfigured provider falls back to mock rather than failing a job.
      return mockImageProvider;
  }
}

export function getUpscaleProvider(): UpscaleProvider {
  switch ((process.env.UPSCALE_PROVIDER ?? 'mock').toLowerCase()) {
    case 'mock':
    case '':
      return mockUpscaleProvider;
    default:
      return mockUpscaleProvider;
  }
}

/** Claude vision when ANTHROPIC_API_KEY is set (VISION_PROVIDER=mock forces the mock). */
export function getVisionProvider(): VisionProvider {
  if ((process.env.VISION_PROVIDER ?? '').toLowerCase() === 'mock') return mockVisionProvider;
  return process.env.ANTHROPIC_API_KEY ? claudeVisionProvider : mockVisionProvider;
}

export const visionIsReal = () => getVisionProvider().id !== 'mock';

export type { ImageProvider, UpscaleProvider, VisionProvider } from './types';
