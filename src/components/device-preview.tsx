'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Maximize2, Monitor, Smartphone, Sparkles, Tablet, X } from 'lucide-react';
import { detectDevice, SAMPLE_SCREENS, sharpnessOn, type DetectedDevice, type DeviceKind } from '@/lib/device-detect';
import { cn } from '@/lib/utils';

type Mode = 'mine' | DeviceKind | 'original';
type Face = 'lock' | 'home';

interface Props {
  src: string | null;
  alt: string;
  orientation: 'portrait' | 'landscape' | 'square' | null;
  maxLongEdge: number | null;
  badges?: React.ReactNode;
}

const ICONS: Record<DeviceKind, typeof Smartphone> = { phone: Smartphone, tablet: Tablet, desktop: Monitor };

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const timeOf = (d: Date | null) => (d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '') : '');
const dateOf = (d: Date | null) => (d ? d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) : '');

/**
 * "See it on your device": the watermarked preview inside a phone, tablet or
 * desktop frame shaped like the visitor's own screen, with a lock-screen clock
 * or home-screen icons on top, plus a full-screen try-on. Only the public
 * preview is used — never the original.
 */
export function DevicePreview({ src, alt, orientation, maxLongEdge, badges }: Props) {
  const [device, setDevice] = useState<DetectedDevice | null>(null);
  const [mode, setMode] = useState<Mode>(orientation === 'landscape' ? 'desktop' : 'phone');
  const [face, setFace] = useState<Face>('lock');
  const [full, setFull] = useState(false);
  const picked = useRef(false);
  const now = useClock();

  useEffect(() => {
    const d = detectDevice({
      ua: navigator.userAgent,
      width: window.screen.width,
      height: window.screen.height,
      dpr: window.devicePixelRatio || 1,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    });
    setDevice(d);
    if (!picked.current) setMode('mine');
  }, []);

  const choose = (m: Mode) => {
    picked.current = true;
    setMode(m);
  };

  const kind: DeviceKind | null = mode === 'original' ? null : mode === 'mine' ? (device?.kind ?? 'phone') : mode;
  const screen = mode === 'mine' && device ? device : kind ? SAMPLE_SCREENS[kind] : null;
  const sharp = screen ? sharpnessOn(maxLongEdge, screen) : null;
  const screenPortrait = screen ? screen.pxH > screen.pxW : false;
  const mismatch = screen && orientation && orientation !== 'square' && (orientation === 'portrait') !== screenPortrait;

  const tabs: { m: Mode; label: string; icon: typeof Smartphone }[] = [
    ...(device ? [{ m: 'mine' as Mode, label: `On ${device.label}`, icon: Sparkles }] : []),
    { m: 'phone', label: 'Phone', icon: Smartphone },
    { m: 'tablet', label: 'Tablet', icon: Tablet },
    { m: 'desktop', label: 'Desktop', icon: Monitor },
    { m: 'original', label: 'Original', icon: ICONS.desktop },
  ];

  if (!src) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground">Watermarked preview</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 text-sm [scrollbar-width:none]" role="tablist" aria-label="Preview on a device">
        {tabs.map((t) => (
          <button
            key={t.m}
            type="button"
            role="tab"
            aria-selected={mode === t.m}
            onClick={() => choose(t.m)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors',
              mode === t.m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              t.m === 'original' && 'ml-auto',
            )}
          >
            {t.m !== 'original' && <t.icon className="h-3.5 w-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative flex h-[min(68vh,560px)] items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-b from-secondary/70 to-secondary/20 p-5 sm:p-8">
        <div className="absolute left-3 top-3 z-10 flex gap-1.5">{badges}</div>
        {kind && screen ? (
          <Frame kind={kind} ratio={screen.pxW / screen.pxH}>
            <Wallpaper src={src} alt={alt} />
            <Overlay kind={kind} face={face} now={now} />
          </Frame>
        ) : (
          <div className="relative h-full w-full">
            <Image src={src} alt={alt} fill sizes="(max-width:768px) 100vw, 50vw" className="object-contain" priority />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {kind && (
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Screen">
            {(['lock', 'home'] as Face[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={face === f}
                onClick={() => setFace(f)}
                className={cn('rounded-md px-2.5 py-1', face === f ? 'bg-secondary font-medium text-foreground' : 'hover:text-foreground')}
              >
                {f === 'lock' ? 'Lock screen' : 'Home screen'}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setFull(true)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium text-foreground hover:bg-secondary">
          <Maximize2 className="h-3.5 w-3.5" /> Try it full screen
        </button>
        <span>Preview is watermarked · your download is full quality</span>
      </div>

      {screen && (sharp || mismatch) && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {screen && mode === 'mine' ? `Your screen: ${screen.pxW} × ${screen.pxH}. ` : ''}
          {sharp === 'sharp' && <span className="text-emerald-700">Sharp on this screen — the largest size is {maxLongEdge}px.</span>}
          {sharp === 'good' && <span>Looks good on this screen (largest size {maxLongEdge}px, very close to the screen).</span>}
          {sharp === 'soft' && <span className="text-amber-700">This screen is bigger than the largest size ({maxLongEdge}px), so it may look slightly soft.</span>}
          {mismatch && <span> Made for {orientation} screens — on this one the edges are cropped, as shown.</span>}
        </p>
      )}

      {full && <FullScreen src={src} alt={alt} now={now} onClose={() => setFull(false)} />}
    </div>
  );
}

function Wallpaper({ src, alt }: { src: string; alt: string }) {
  return <Image src={src} alt={alt} fill sizes="(max-width:768px) 90vw, 45vw" className="object-cover" priority draggable={false} />;
}

/** Generic device shell (no brand styling) sized to fit the stage. */
function Frame({ kind, ratio, children }: { kind: DeviceKind; ratio: number; children: React.ReactNode }) {
  if (kind === 'desktop') {
    return (
      <div className="flex w-full max-w-[640px] flex-col items-center">
        <div className="w-full rounded-t-xl border-[7px] border-b-[12px] border-neutral-900 bg-black shadow-2xl" style={{ aspectRatio: String(ratio) }}>
          <div className="relative h-full w-full overflow-hidden">{children}</div>
        </div>
        <div className="h-2.5 w-[108%] rounded-b-xl bg-gradient-to-b from-neutral-400 to-neutral-500 shadow-lg" />
        <div className="h-1 w-24 rounded-b-md bg-neutral-500/70" />
      </div>
    );
  }
  const phone = kind === 'phone';
  return (
    <div
      className={cn('relative h-full max-h-full max-w-full bg-neutral-950 shadow-2xl ring-1 ring-black/40', phone ? 'rounded-[2.4rem] p-[9px]' : 'rounded-[1.6rem] p-[13px]')}
      style={{ aspectRatio: String(ratio) }}
    >
      <div className={cn('relative h-full w-full overflow-hidden bg-black', phone ? 'rounded-[1.95rem]' : 'rounded-[0.9rem]')}>
        {children}
        {phone && <span aria-hidden className="absolute left-1/2 top-2.5 z-20 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" />}
      </div>
    </div>
  );
}

const icon = 'aspect-square rounded-[28%] bg-white/25 shadow-sm ring-1 ring-white/15 backdrop-blur-md';

/** Lock-screen clock or home-screen icons drawn over the wallpaper. */
function Overlay({ kind, face, now }: { kind: DeviceKind; face: Face; now: Date | null }) {
  if (kind === 'desktop') {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col text-white">
        <div className="flex h-[4.5%] min-h-3 items-center justify-end gap-2 bg-black/25 px-2 text-[clamp(6px,1.1vw,10px)] backdrop-blur-sm">{timeOf(now)}</div>
        {face === 'lock' ? (
          <div className="mt-[12%] text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            <p className="text-[clamp(8px,1.4vw,13px)] font-medium opacity-90">{dateOf(now)}</p>
            <p className="font-display text-[clamp(28px,7vw,64px)] font-semibold leading-none">{timeOf(now)}</p>
          </div>
        ) : (
          <div className="mt-auto mb-[2%] flex justify-center">
            <div className="flex gap-[1.2%] rounded-xl bg-white/20 p-[0.8%] ring-1 ring-white/20 backdrop-blur-md" style={{ width: '46%' }}>
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={cn(icon, 'flex-1')} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  const tablet = kind === 'tablet';
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col text-white">
      <div className="flex items-center justify-between px-[7%] pt-[3.2%] text-[clamp(7px,2.2vw,11px)] font-semibold drop-shadow">
        <span>{face === 'home' ? timeOf(now) : ''}</span>
        <span className="flex items-center gap-1">
          <span className="h-[0.55em] w-[1em] rounded-[2px] border border-white/90" />
        </span>
      </div>
      {face === 'lock' ? (
        <>
          <div className="mt-[9%] text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
            <p className="text-[clamp(8px,2.4vw,13px)] font-medium opacity-95">{dateOf(now)}</p>
            <p className={cn('font-display font-semibold leading-none tracking-tight', tablet ? 'text-[clamp(36px,9vw,84px)]' : 'text-[clamp(34px,12vw,72px)]')}>{timeOf(now)}</p>
          </div>
          <div className="mt-auto flex items-end justify-between px-[9%] pb-[7%]">
            <span className="grid aspect-square w-[11%] place-items-center rounded-full bg-black/30 backdrop-blur-md" />
            <span className="grid aspect-square w-[11%] place-items-center rounded-full bg-black/30 backdrop-blur-md" />
          </div>
        </>
      ) : (
        <>
          <div className={cn('mt-[8%] grid gap-x-[6%] gap-y-[3.5%] px-[7%]', tablet ? 'grid-cols-6' : 'grid-cols-4')}>
            {Array.from({ length: tablet ? 18 : 16 }, (_, i) => (
              <span key={i} className={icon} />
            ))}
          </div>
          <div className={cn('mx-[4%] mb-[5%] mt-auto grid gap-[6%] rounded-[1.4rem] bg-white/20 p-[3.5%] ring-1 ring-white/20 backdrop-blur-md', tablet ? 'grid-cols-6 mx-[18%]' : 'grid-cols-4')}>
            {Array.from({ length: tablet ? 6 : 4 }, (_, i) => (
              <span key={i} className={icon} />
            ))}
          </div>
        </>
      )}
      <span aria-hidden className="absolute bottom-[1.3%] left-1/2 h-[0.6%] min-h-1 w-[34%] -translate-x-1/2 rounded-full bg-white/85" />
    </div>
  );
}

/** Full-screen try-on on the visitor's own screen. */
function FullScreen({ src, alt, now, onClose }: { src: string; alt: string; now: Date | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    el?.requestFullscreen?.().catch(() => undefined); // iPhone Safari has no element full screen: the fixed overlay covers it.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onFs = () => !document.fullscreenElement && onClose();
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = '';
    };
  }, [close, onClose]);

  return (
    <div ref={ref} className="fixed inset-0 z-[100] bg-black" role="dialog" aria-modal="true" aria-label="Full-screen preview" onClick={close}>
      <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" priority />
      <div className="pointer-events-none absolute inset-x-0 top-[12%] text-center text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        <p className="text-sm font-medium opacity-95">{dateOf(now)}</p>
        <p className="font-display text-7xl font-semibold leading-none tracking-tight sm:text-8xl">{timeOf(now)}</p>
      </div>
      <button
        type="button"
        onClick={close}
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/70"
      >
        <X className="h-4 w-4" /> Close
      </button>
      <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-white/80">Watermarked preview · tap anywhere to close</p>
    </div>
  );
}
