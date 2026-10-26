'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface DiffRow {
  slug: string;
  region: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
}

interface Result {
  dryRun: boolean;
  changes: number;
  pending: number;
  diff: DiffRow[];
}

/** Simulate (dry-run diff) or apply a live dynamic-pricing run. */
export function PricingRunner() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (!dryRun && !window.confirm('Apply a LIVE pricing run? This writes prices and price_history.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs/dynamic-pricing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setResult(json.details as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button onClick={() => run(true)} disabled={busy} variant="outline">
          {busy ? 'Running…' : 'Simulate next run (dry-run)'}
        </Button>
        <Button onClick={() => run(false)} disabled={busy}>
          Apply live run
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {result.dryRun ? 'Dry-run' : 'Applied'}: {result.changes} change(s), {result.pending} pending
            marker(s).
          </p>
          {result.diff.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1">Wallpaper</th>
                  <th>Region</th>
                  <th>Old → New</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.diff.map((d, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1">{d.slug}</td>
                    <td>{d.region}</td>
                    <td>
                      {d.oldPrice} → {d.newPrice}
                    </td>
                    <td className="text-muted-foreground">{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No changes proposed.</p>
          )}
        </div>
      )}
    </div>
  );
}
