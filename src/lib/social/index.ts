import 'server-only';

import crypto from 'node:crypto';

/**
 * Social publishing adapters. Instagram Graph API + Pinterest API v5 slot in
 * behind this interface once tokens are set; a built-in mock lets the scheduler
 * run offline. Content rules (no trademarked characters/logos/real people/NSFW)
 * are enforced upstream in generation + moderation.
 */
export interface SocialPublishInput {
  platform: 'instagram' | 'pinterest' | 'youtube_shorts';
  caption: string;
  mediaUrl: string | null;
  linkUrl?: string;
}

export interface SocialPublishResult {
  externalId: string;
}

export interface SocialProvider {
  readonly id: string;
  publish(input: SocialPublishInput): Promise<SocialPublishResult>;
}

const mockSocialProvider: SocialProvider = {
  id: 'mock',
  async publish(input): Promise<SocialPublishResult> {
    // Deterministic fake post id; no network call.
    const id = crypto
      .createHash('sha1')
      .update(`${input.platform}:${input.mediaUrl}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16);
    return { externalId: `mock_${input.platform}_${id}` };
  },
};

export function getSocialProvider(platform: SocialPublishInput['platform']): SocialProvider {
  // Real providers require tokens (IG_ACCESS_TOKEN / PINTEREST_ACCESS_TOKEN).
  if (platform === 'instagram' && process.env.IG_ACCESS_TOKEN) return mockSocialProvider; // TODO: real IG
  if (platform === 'pinterest' && process.env.PINTEREST_ACCESS_TOKEN) return mockSocialProvider; // TODO: real Pinterest
  return mockSocialProvider;
}
