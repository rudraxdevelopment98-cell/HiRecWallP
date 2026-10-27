import 'server-only';

/**
 * Client for the forensic watermark worker (worker/). Embeds the order id into
 * a paid download and can decode a leaked file back to its order id. No-ops
 * (returns null) when the worker isn't configured, so downloads still work.
 */

export function isWatermarkConfigured(): boolean {
  return Boolean(process.env.WATERMARK_WORKER_URL && process.env.WATERMARK_WORKER_SECRET);
}

function orderToHex(orderId: string): string {
  return orderId.replace(/-/g, '').toLowerCase();
}

export async function embedWatermark(
  image: Buffer,
  opts: { orderId: string; licence: string },
): Promise<Buffer | null> {
  if (!isWatermarkConfigured()) return null;
  const url = process.env.WATERMARK_WORKER_URL!.replace(/\/$/, '');
  try {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'image.jpg');
    fd.append('payload', orderToHex(opts.orderId));
    fd.append('licence', opts.licence);
    fd.append('order_ref', opts.orderId);
    const res = await fetch(`${url}/embed`, {
      method: 'POST',
      headers: { 'x-worker-secret': process.env.WATERMARK_WORKER_SECRET! },
      body: fd,
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function decodeWatermark(
  image: Buffer,
): Promise<{ orderHex: string; orderId: string | null } | null> {
  if (!isWatermarkConfigured()) return null;
  const url = process.env.WATERMARK_WORKER_URL!.replace(/\/$/, '');
  try {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'image.jpg');
    const res = await fetch(`${url}/decode`, {
      method: 'POST',
      headers: { 'x-worker-secret': process.env.WATERMARK_WORKER_SECRET! },
      body: fd,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { order_hex: string; order_id: string | null };
    return { orderHex: json.order_hex, orderId: json.order_id };
  } catch {
    return null;
  }
}
