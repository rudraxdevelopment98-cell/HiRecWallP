import 'server-only';

import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { staffCan } from '@/lib/auth';
import type { Area } from '@/lib/staff';

/** Which staff area may run each job by hand (cron always can). */
const JOB_AREA: Record<string, Area> = {
  'generate-batch': 'catalogue',
  'publish-approved': 'catalogue',
  'social-scheduler': 'marketing',
  'daily-pick': 'marketing',
  'dynamic-pricing': 'pricing',
};

/**
 * Authorize a job invocation: either a Vercel Cron / scheduled call carrying
 * the CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret), or a
 * signed-in admin triggering it from the dashboard.
 */
export async function authorizeJob(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const headerSecret = bearer ?? request.headers.get('x-cron-secret');
    if (headerSecret) {
      const a = Buffer.from(headerSecret);
      const b = Buffer.from(secret);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    }
  }
  // Signed-in staff: by the job's area (payouts, FX, reports, housekeeping → owner/manager).
  const name = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';
  return staffCan(JOB_AREA[name] ?? 'business');
}

/**
 * Run a job with jobs_log bookkeeping. Records a 'started' row, then updates it
 * to 'succeeded' (+details) or 'failed' (+error). Never throws to the caller;
 * returns { ok, details }.
 */
export async function runJob<T extends Record<string, unknown>>(
  jobName: string,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; details?: T; error?: string }> {
  const supabase = createServiceClient();

  let logId: string | null = null;
  const { data: log } = await supabase
    .from('jobs_log')
    .insert({ job_name: jobName, status: 'started' })
    .select('id')
    .single();
  logId = log?.id ?? null;

  try {
    const details = await fn();
    if (logId) {
      await supabase
        .from('jobs_log')
        .update({ status: 'succeeded', finished_at: new Date().toISOString(), details })
        .eq('id', logId);
    }
    return { ok: true, details };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    if (logId) {
      await supabase
        .from('jobs_log')
        .update({ status: 'failed', finished_at: new Date().toISOString(), details: { error: message } })
        .eq('id', logId);
    }
    return { ok: false, error: message };
  }
}
