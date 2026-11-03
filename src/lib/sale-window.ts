/**
 * Real sale windows for festival drops (no fake timers): an item with
 * `sale_starts_at` / `sale_ends_at` is only listed and sold inside them.
 */
export interface SaleWindow {
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
}

export function isOnSale(row: SaleWindow, now: Date = new Date()): boolean {
  if (row.sale_starts_at && new Date(row.sale_starts_at) > now) return false;
  if (row.sale_ends_at && new Date(row.sale_ends_at) <= now) return false;
  return true;
}

/** "12 Nov" style end date in India time, or null when open-ended. */
export function saleEndsLabel(row: SaleWindow): string | null {
  if (!row.sale_ends_at) return null;
  return new Date(row.sale_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

const IST_OFFSET_MS = 330 * 60_000;

/** ISO → "YYYY-MM-DDTHH:mm" in IST (for datetime-local inputs; deterministic on server and client). */
export function toIstInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return d.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" entered as IST → ISO string. */
export function fromIstInput(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value}:00+05:30`).toISOString();
}
