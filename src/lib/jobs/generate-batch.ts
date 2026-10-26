import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { getImageProvider, getUpscaleProvider, getVisionProvider } from '@/lib/ai';
import { putObject } from '@/lib/r2';
import { dHash, isNearDuplicate } from '@/lib/phash';
import type { AspectKey } from '@/lib/ai/types';

const MIN_QUALITY = 7;
const DEFAULT_CANDIDATES = 3;
const DEFAULT_PROMPT_LIMIT = 2;
const MIN_WIDTH = 512;

interface Candidate {
  idx: number;
  width: number;
  height: number;
  phash: string;
  score: number;
  reasons: string;
  publicUrl: string | null;
  originalKey: string | null;
  best: boolean;
  dropped?: string;
}

function publicUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/${key}` : null;
}

/**
 * generate_batch: pick active prompts → generate N candidates → auto-filter
 * (min resolution + near-duplicate pHash) → quality score (drop < 7) → upscale
 * survivors → Claude-style metadata → status awaiting_review. Mock providers
 * make this run without paid keys; R2 uploads are best-effort.
 */
export async function runGenerateBatch(opts: {
  count?: number;
  promptLimit?: number;
  promptId?: string;
}): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const image = getImageProvider();
  const upscale = getUpscaleProvider();
  const vision = getVisionProvider();
  const candidateCount = opts.count ?? DEFAULT_CANDIDATES;

  // Active prompts.
  let promptQuery = supabase.from('prompt_library').select('*').eq('active', true);
  if (opts.promptId) promptQuery = promptQuery.eq('id', opts.promptId);
  const { data: prompts } = await promptQuery.limit(opts.promptLimit ?? DEFAULT_PROMPT_LIMIT);
  if (!prompts || prompts.length === 0) {
    return { jobsCreated: 0, note: 'no active prompts' };
  }

  // Existing published asset hashes to dedupe against.
  const { data: existing } = await supabase
    .from('wallpaper_assets')
    .select('phash')
    .not('phash', 'is', null)
    .limit(2000);
  const existingHashes = (existing ?? []).map((r) => r.phash as string).filter(Boolean);

  const createdJobs: string[] = [];

  for (const prompt of prompts) {
    const { data: job } = await supabase
      .from('generation_jobs')
      .insert({ prompt_id: prompt.id, provider: image.id, status: 'generating' })
      .select('id')
      .single();
    if (!job) continue;

    const aspect = (prompt.aspect as AspectKey) ?? 'phone';
    const candidates: Candidate[] = [];
    const batchHashes: string[] = [];
    let cost = 0;

    for (let i = 0; i < candidateCount; i++) {
      const gen = await image.generate({
        prompt: prompt.prompt,
        negativePrompt: prompt.negative_prompt ?? undefined,
        aspect,
        seed: i + 1,
      });
      cost += 3; // mock cost units

      const phash = await dHash(gen.buffer);
      const base: Candidate = {
        idx: i,
        width: gen.width,
        height: gen.height,
        phash,
        score: 0,
        reasons: '',
        publicUrl: null,
        originalKey: null,
        best: false,
      };

      // Auto-filter: min resolution + near-duplicate (existing + this batch).
      if (gen.width < MIN_WIDTH) {
        candidates.push({ ...base, dropped: 'below min resolution' });
        continue;
      }
      if ([...existingHashes, ...batchHashes].some((h) => isNearDuplicate(h, phash))) {
        candidates.push({ ...base, dropped: 'near-duplicate' });
        continue;
      }
      batchHashes.push(phash);

      // Quality review.
      const review = await vision.score(gen.buffer);
      if (review.score < MIN_QUALITY) {
        candidates.push({ ...base, score: review.score, reasons: review.reasons, dropped: 'low quality' });
        continue;
      }

      // Upscale survivor toward 4K/5K; store preview (public) + original (private).
      const original = await upscale.upscale(gen.buffer, 4);
      const previewKey = `generation/${job.id}/${i}.jpg`;
      const originalKey = `generation/${job.id}/${i}-original.jpg`;
      try {
        await putObject('public', previewKey, gen.buffer, gen.contentType);
        await putObject('private', originalKey, original, 'image/jpeg');
      } catch {
        // R2 not configured — keep metadata, skip URLs.
      }
      candidates.push({
        ...base,
        score: review.score,
        reasons: review.reasons,
        publicUrl: publicUrl(previewKey),
        originalKey,
      });
    }

    // Choose the best surviving candidate.
    const survivors = candidates.filter((c) => !c.dropped);
    const best = survivors.sort((a, b) => b.score - a.score)[0];
    if (best) best.best = true;

    const qualityScores: Record<string, { score: number; reasons: string }> = {};
    for (const c of candidates) qualityScores[String(c.idx)] = { score: c.score, reasons: c.reasons };

    let metadata: Record<string, unknown> | null = null;
    if (best) {
      const gen = await image.generate({ prompt: prompt.prompt, aspect, seed: best.idx + 1 });
      metadata = { ...(await vision.describe(gen.buffer, { prompt: prompt.prompt, niche: prompt.niche })), category: prompt.niche };
    }

    await supabase
      .from('generation_jobs')
      .update({
        status: best ? 'awaiting_review' : 'failed',
        candidates,
        quality_scores: qualityScores,
        metadata,
        cost_minor: cost,
        error: best ? null : 'no candidate passed filters',
      })
      .eq('id', job.id);

    createdJobs.push(job.id);
  }

  return { jobsCreated: createdJobs.length, jobIds: createdJobs };
}
