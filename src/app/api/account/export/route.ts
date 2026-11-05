import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { allowRequest } from '@/lib/rate-limit';
import { buildExport } from '@/lib/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Download my data (JSON). Signed-in only; a few times a day. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  if (!(await allowRequest(request, `export:${user.id}`, 5, 86_400))) {
    return NextResponse.json({ error: 'You can download your data a few times a day. Please try again tomorrow.' }, { status: 429 });
  }
  const data = await buildExport(user.id);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="hirecwallp-my-data-${day}.json"`,
      'cache-control': 'no-store',
    },
  });
}
