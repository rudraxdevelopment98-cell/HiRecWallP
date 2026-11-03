import { NextResponse } from 'next/server';
import { authorizeJob, runJob } from '@/lib/jobs/runner';
import { runDailyPick } from '@/lib/jobs/daily-pick';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await authorizeJob(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runJob('daily_pick', () => runDailyPick());
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = POST;
