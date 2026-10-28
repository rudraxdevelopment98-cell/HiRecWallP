import { NextResponse } from 'next/server';
import { authorizeJob, runJob } from '@/lib/jobs/runner';
import { runCreatorPayouts } from '@/lib/jobs/creator-payouts';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!(await authorizeJob(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await runJob('creator_payouts', () =>
    runCreatorPayouts({
      period: typeof body.period === 'string' ? body.period : undefined,
      dryRun: body.dryRun === true,
    }),
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = POST;
