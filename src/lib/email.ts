import 'server-only';

/**
 * Email via Resend. Falls back to a no-op logger when RESEND_API_KEY is unset
 * so jobs (e.g. the weekly report) run without failing in dev/CI.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; id?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = `HirecWallp <reports@${(process.env.NEXT_PUBLIC_SITE_URL ?? 'localhost').replace(/^https?:\/\//, '')}>`;
  if (!key) {
    console.info(`[email:mock] to=${input.to} subject="${input.subject}"`);
    return { sent: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
  });
  if (!res.ok) throw new Error(`Resend failed (${res.status})`);
  const json = (await res.json()) as { id?: string };
  return { sent: true, id: json.id };
}
