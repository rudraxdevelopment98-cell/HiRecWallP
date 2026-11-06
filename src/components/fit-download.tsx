'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FREE_FIT_MAX_LONG_EDGE, checkFitSize, fittingDevices, screenForArt } from '@/lib/fit';

/**
 * "Exact fit": download the wallpaper cropped to one screen's exact resolution
 * (this device, a listed device, or a custom size). The crop is made from the
 * private master on the server; paid wallpapers use one download.
 */
export function FitDownload({ wallpaperId, srcW, srcH, free = false }: { wallpaperId: string; srcW: number; srcH: number; free?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<{ w: number; h: number } | null>(null);
  const [pick, setPick] = useState('');
  const [custom, setCustom] = useState({ w: '', h: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const portrait = srcH > srcW;

  useEffect(() => {
    setMine(screenForArt(window.screen.width, window.screen.height, window.devicePixelRatio || 1, portrait));
  }, [portrait]);

  const devices = useMemo(
    () => fittingDevices(srcW, srcH).filter((d) => !free || Math.max(d.w, d.h) <= FREE_FIT_MAX_LONG_EDGE),
    [srcW, srcH, free],
  );
  const mineCheck = mine ? checkFitSize(mine.w, mine.h, srcW, srcH, { free }) : null;

  async function get(w: number, h: number) {
    const c = checkFitSize(w, h, srcW, srcH, { free });
    if (!c.ok) return setMsg(c.error);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallpaperId, fit: { w, h } }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Download failed');
      window.location.href = json.url;
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  if (!srcW || !srcH) return null;
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Crop className="mr-1 h-3.5 w-3.5" /> Exact fit
      </Button>
    );
  }
  const kinds = [
    ['phone', 'Phones'],
    ['tablet', 'Tablets'],
    ['desktop', 'Computers & monitors'],
  ] as const;
  return (
    <div className="w-full space-y-3 rounded-xl border bg-card p-3 text-sm sm:w-[26rem]">
      <div className="flex items-center justify-between">
        <p className="font-medium">Exact fit for a screen</p>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {mine && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary p-2">
          <span>
            This screen: <strong>{mine.w} × {mine.h}</strong>
          </span>
          {mineCheck?.ok ? (
            <Button size="sm" disabled={busy} onClick={() => get(mine.w, mine.h)}>
              {busy ? '…' : 'Download'}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{mineCheck && !mineCheck.ok ? mineCheck.error : ''}</span>
          )}
        </div>
      )}
      {devices.length > 0 && (
        <div className="flex gap-2">
          <select className="input h-9 flex-1 py-1" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Device">
            <option value="">Choose a device…</option>
            {kinds.map(([k, label]) =>
              devices.some((d) => d.kind === k) ? (
                <optgroup key={k} label={label}>
                  {devices
                    .filter((d) => d.kind === k)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.w}×{d.h}
                      </option>
                    ))}
                </optgroup>
              ) : null,
            )}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !pick}
            onClick={() => {
              const d = devices.find((x) => x.id === pick);
              if (d) void get(d.w, d.h);
            }}
          >
            Download
          </Button>
        </div>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void get(Number(custom.w), Number(custom.h));
        }}
      >
        <input className="input h-9 w-24" inputMode="numeric" placeholder="Width" aria-label="Width in pixels" value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value.replace(/\D/g, '') })} />
        <span>×</span>
        <input className="input h-9 w-24" inputMode="numeric" placeholder="Height" aria-label="Height in pixels" value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value.replace(/\D/g, '') })} />
        <Button size="sm" variant="outline" type="submit" disabled={busy || !custom.w || !custom.h}>
          Custom
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Cropped from the full-quality original to fit exactly. {free ? `Free wallpapers go up to ${FREE_FIT_MAX_LONG_EDGE} px.` : 'Uses one of your downloads.'}
      </p>
      {msg && (
        <p className="text-xs text-rose-600" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
