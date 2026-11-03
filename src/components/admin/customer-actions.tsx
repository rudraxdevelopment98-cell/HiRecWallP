'use client';

import { useState } from 'react';
import { useRefresh } from '@/lib/use-refresh';
import { Button } from '@/components/ui/button';

/** Credits ±, gift a wallpaper, block/unblock, role. */
export function CustomerActions({ userId, blocked, role }: { userId: string; blocked: boolean; role: string }) {
  const { refresh, refreshing } = useRefresh();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [credits, setCredits] = useState('');
  const [wallpaperId, setWallpaperId] = useState('');
  const [licence, setLicence] = useState<'personal' | 'commercial'>('personal');
  const [confirmBlock, setConfirmBlock] = useState(false);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/customers/${userId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setMsg({ ok: true, text: ok });
      refresh();
    } else {
      setMsg({ ok: false, text: ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Failed' });
    }
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Add or remove credits (use a minus sign to remove)</p>
        <div className="flex gap-2">
          <input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="e.g. 10 or -5" className="input max-w-[140px]" aria-label="Credits" />
          <Button size="sm" disabled={busy || refreshing || !credits || Number(credits) === 0} onClick={() => act({ action: 'credits', amount: Math.trunc(Number(credits)) }, 'Credits updated')}>
            Apply
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Gift a wallpaper (paste its id from Catalogue → Edit URL)</p>
        <div className="flex flex-wrap gap-2">
          <input value={wallpaperId} onChange={(e) => setWallpaperId(e.target.value.trim())} placeholder="wallpaper id" className="input max-w-xs" aria-label="Wallpaper id" />
          <select value={licence} onChange={(e) => setLicence(e.target.value as 'personal' | 'commercial')} className="input w-auto" aria-label="Licence">
            <option value="personal">Personal</option>
            <option value="commercial">Commercial</option>
          </select>
          <Button size="sm" disabled={busy || refreshing || wallpaperId.length !== 36} onClick={() => act({ action: 'gift', wallpaperId, licence }, 'Added to their library')}>
            Gift
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Role</span>
        {(['buyer', 'creator', 'admin'] as const).map((r) => (
          <Button key={r} size="sm" variant={r === role ? 'default' : 'outline'} disabled={busy || refreshing || r === role} onClick={() => act({ action: 'role', role: r }, `Role set to ${r}`)}>
            {r}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {blocked ? (
          <Button size="sm" variant="outline" disabled={busy || refreshing} onClick={() => act({ action: 'unblock' }, 'Account unblocked')}>
            Unblock account
          </Button>
        ) : !confirmBlock ? (
          <Button size="sm" variant="outline" disabled={busy || refreshing} onClick={() => setConfirmBlock(true)}>
            Block account…
          </Button>
        ) : (
          <>
            <span className="text-rose-700">They won&rsquo;t be able to sign in. Continue?</span>
            <Button size="sm" disabled={busy || refreshing} onClick={() => { setConfirmBlock(false); void act({ action: 'block' }, 'Account blocked'); }}>
              Yes, block
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmBlock(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
      {msg && <p className={msg.ok ? 'text-emerald-600' : 'text-rose-600'}>{msg.text}</p>}
    </div>
  );
}
