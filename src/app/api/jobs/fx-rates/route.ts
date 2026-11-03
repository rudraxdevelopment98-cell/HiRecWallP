import { NextResponse } from 'next/server';
import { authorizeJob, runJob } from '@/lib/jobs/runner';
import { refreshFxRates } from '@/lib/fx';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Monthly (1st, before creator payouts) or on demand from Admin → Tax centre. */
export async function POST(request: Request) {
  if (!(await authorizeJob(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runJob('fx_rates', async () => {
    const r = await refreshFxRates();
    if (!r.updated) throw new Error(r.error);
    return r as Record<string, unknown>;
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = POST;
