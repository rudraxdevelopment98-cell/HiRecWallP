import { NextResponse } from 'next/server';
import { authorizeJob, runJob } from '@/lib/jobs/runner';
import { runDynamicPricing } from '@/lib/jobs/dynamic-pricing';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await authorizeJob(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  // Cron (GET, no body) runs live; the admin "simulate" button passes dryRun:true.
  const dryRun = body.dryRun === true;
  const result = await runJob('dynamic_pricing', () => runDynamicPricing({ dryRun }));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = POST;
