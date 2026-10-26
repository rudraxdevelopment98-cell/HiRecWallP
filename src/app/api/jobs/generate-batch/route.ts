import { NextResponse } from 'next/server';
import { authorizeJob, runJob } from '@/lib/jobs/runner';
import { runGenerateBatch } from '@/lib/jobs/generate-batch';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!(await authorizeJob(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await runJob('generate_batch', () =>
    runGenerateBatch({
      count: typeof body.count === 'number' ? body.count : undefined,
      promptLimit: typeof body.promptLimit === 'number' ? body.promptLimit : undefined,
      promptId: typeof body.promptId === 'string' ? body.promptId : undefined,
    }),
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = POST;
