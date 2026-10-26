import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { runJob } from '@/lib/jobs/runner';
import { runPublishApproved } from '@/lib/jobs/publish-approved';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const result = await runJob('publish_approved', () => runPublishApproved(params.id));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
