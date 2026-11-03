import { NextResponse } from 'next/server';
import { REF_CODE, REF_COOKIE } from '@/lib/growth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Referral link: remember the code for 30 days, then show the sign-up page. */
export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL(request.url);
  const clean = code.toUpperCase();
  const res = NextResponse.redirect(new URL(REF_CODE.test(clean) ? '/login?ref=1&next=/account/referrals' : '/', url.origin));
  if (REF_CODE.test(clean)) {
    res.cookies.set(REF_COOKIE, clean, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}
