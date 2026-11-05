/**
 * Best-effort description of the visitor's screen for the "see it on your
 * device" preview. Runs in the browser; pure so it can be unit tested.
 */

export type DeviceKind = 'phone' | 'tablet' | 'desktop';

export interface ScreenInfo {
  ua: string;
  /** CSS pixels (window.screen.width/height). */
  width: number;
  height: number;
  dpr: number;
  maxTouchPoints: number;
}

export interface DetectedDevice {
  kind: DeviceKind;
  /** Friendly name, e.g. "your iPhone", "your Android phone", "this Mac". */
  label: string;
  /** Physical pixels, portrait for phones/tablets, landscape for desktops. */
  pxW: number;
  pxH: number;
}

const round = (n: number) => Math.round(n);

export function detectDevice(s: ScreenInfo): DetectedDevice {
  const ua = s.ua;
  const short = Math.min(s.width, s.height);
  const long = Math.max(s.width, s.height);
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && s.maxTouchPoints > 1);
  const iPhone = /iPhone|iPod/.test(ua);
  const android = /Android/.test(ua);
  const mobileAndroid = android && /Mobile/.test(ua);
  const touch = s.maxTouchPoints > 0;

  let kind: DeviceKind;
  if (iPhone || mobileAndroid) kind = 'phone';
  else if (iPad || (android && !mobileAndroid)) kind = 'tablet';
  else if (touch && short < 500) kind = 'phone';
  else if (touch && short < 1100 && !/Windows NT|Macintosh|X11|CrOS/.test(ua)) kind = 'tablet';
  else kind = 'desktop';

  const dpr = s.dpr > 0 && s.dpr < 6 ? s.dpr : 1;
  const a = round(short * dpr);
  const b = round(long * dpr);
  const [pxW, pxH] = kind === 'desktop' ? [b, a] : [a, b];

  const label =
    kind === 'phone'
      ? iPhone ? 'your iPhone' : android ? 'your Android phone' : 'your phone'
      : kind === 'tablet'
        ? iPad ? 'your iPad' : android ? 'your Android tablet' : 'your tablet'
        : /Macintosh/.test(ua) ? 'this Mac' : /Windows NT/.test(ua) ? 'this PC' : /CrOS/.test(ua) ? 'this Chromebook' : 'this computer';

  return { kind, label, pxW, pxH };
}

export type Sharpness = 'sharp' | 'good' | 'soft';

/**
 * How the wallpaper's largest size compares with the screen's long edge.
 * Downloads are never upscaled more than 15%, so "good" covers that band.
 */
export function sharpnessOn(maxLongEdge: number | null | undefined, device: Pick<DetectedDevice, 'pxW' | 'pxH'>): Sharpness | null {
  if (!maxLongEdge || maxLongEdge <= 0) return null;
  const need = Math.max(device.pxW, device.pxH);
  if (maxLongEdge >= need) return 'sharp';
  if (maxLongEdge >= need / 1.15) return 'good';
  return 'soft';
}

/** Typical screens used for the device tabs when it isn't the visitor's own. */
export const SAMPLE_SCREENS: Record<DeviceKind, { pxW: number; pxH: number; label: string }> = {
  phone: { pxW: 1179, pxH: 2556, label: 'Phone' },
  tablet: { pxW: 1640, pxH: 2360, label: 'Tablet' },
  desktop: { pxW: 2560, pxH: 1600, label: 'Laptop / desktop' },
};
