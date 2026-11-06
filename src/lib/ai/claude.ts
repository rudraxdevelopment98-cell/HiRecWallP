import 'server-only';

import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { openImage } from '@/lib/image-safety';
import type { CategoryOption, Moderation, QualityReview, SuggestedMetadata, VisionProvider } from './types';

const MODEL = 'claude-opus-5-5';

const Analysis = z.object({
  title: z.string().describe('2–5 word evocative title. No brand, franchise, character or real-person names.'),
  description: z.string().describe('One or two plain sentences describing the scene for a product page.'),
  alt_text: z.string().describe('Concise alt text for screen readers (what is visible).'),
  tags: z.array(z.string()).describe('6–10 lowercase search tags (single words or short phrases).'),
  category_id: z.string().nullable().describe('id of the best matching category from the list, or null.'),
  quality_score: z.number().describe('Wallpaper quality 1–10: composition, sharpness, no artifacts/garbled text.'),
  quality_notes: z.string(),
  allowed: z.boolean().describe('false if NSFW, gore, hate, a real identifiable person, a trademarked character/logo, or visible watermark/signature text.'),
  moderation_reasons: z.string(),
  suggested_free: z.boolean().describe('true only for simpler images suitable as free teasers.'),
});
type AnalysisT = z.infer<typeof Analysis>;

let client: Anthropic | null = null;
const api = () => (client ??= new Anthropic());

/** One analysis per image per instance: describe/moderate/score share it. */
const memo = new Map<string, Promise<AnalysisT>>();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

async function analyse(image: Buffer, ctx: { prompt?: string; niche?: string; categories?: CategoryOption[]; title?: string }): Promise<AnalysisT> {
  const key = crypto.createHash('sha256').update(image).update(JSON.stringify(ctx.categories ?? [])).digest('hex');
  const hit = memo.get(key);
  if (hit) return hit;
  const run = (async () => {
    // A 1024px JPEG is plenty to judge content and keeps the request small.
    const small = await openImage(image).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const categories = (ctx.categories ?? []).map((c) => `- ${c.id}: ${c.name}`).join('\n') || '(none)';
    const response = await api().beta.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Analysis) },
      system:
        'You catalogue AI-generated wallpapers for an online store. Describe only what is visible. ' +
        'Never name brands, franchises, characters or real people in titles or tags, even if the image resembles them — flag that in moderation instead.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') } },
            {
              type: 'text',
              text:
                `Catalogue this wallpaper.\nCategories (pick one id or null):\n${categories}\n` +
                (ctx.title ? `Creator's title (may be inaccurate): ${ctx.title.slice(0, 120)}\n` : '') +
                (ctx.prompt ? `Generation prompt / filename hint: ${ctx.prompt.slice(0, 300)}\n` : ''),
            },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') {
      return {
        title: 'Untitled wallpaper', description: '', alt_text: '', tags: [], category_id: null,
        quality_score: 0, quality_notes: 'Declined by the AI reviewer', allowed: false,
        moderation_reasons: 'The AI reviewer declined this image — review it manually.', suggested_free: false,
      };
    }
    if (!response.parsed_output) throw new Error('AI analysis returned no result');
    return response.parsed_output;
  })();
  memo.set(key, run);
  run.catch(() => memo.delete(key));
  if (memo.size > 200) memo.delete(memo.keys().next().value!);
  return run;
}

/** Claude vision: real titles/tags/categories, moderation and quality scoring. */
export const claudeVisionProvider: VisionProvider = {
  id: 'claude',
  async score(image): Promise<QualityReview> {
    const a = await analyse(image, {});
    return { score: Math.max(1, Math.min(10, Math.round(a.quality_score))), reasons: a.quality_notes };
  },
  async describe(image, context): Promise<SuggestedMetadata> {
    const a = await analyse(image, context);
    const valid = new Set((context.categories ?? []).map((c) => c.id));
    const title = a.title.trim().slice(0, 80) || 'Untitled wallpaper';
    return {
      title,
      slug: slugify(title),
      description: a.description.trim().slice(0, 500),
      altText: a.alt_text.trim().slice(0, 200),
      tags: [...new Set(a.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12),
      suggestedFree: a.suggested_free,
      categoryId: a.category_id && valid.has(a.category_id) ? a.category_id : null,
    };
  },
  async moderate(image, context): Promise<Moderation> {
    const a = await analyse(image, { title: context.title });
    return { allowed: a.allowed, reasons: a.moderation_reasons };
  },
};
