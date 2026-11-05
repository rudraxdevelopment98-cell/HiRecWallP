import { describe, expect, it } from 'vitest';
import { detectDevice, sharpnessOn } from './device-detect';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPADOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('detectDevice', () => {
  it('iPhone: portrait physical pixels', () => {
    expect(detectDevice({ ua: IPHONE, width: 393, height: 852, dpr: 3, maxTouchPoints: 5 })).toEqual({ kind: 'phone', label: 'your iPhone', pxW: 1179, pxH: 2556 });
  });
  it('Android phone held sideways still reports portrait', () => {
    const d = detectDevice({ ua: PIXEL, width: 915, height: 412, dpr: 2.625, maxTouchPoints: 5 });
    expect(d.kind).toBe('phone');
    expect(d.pxW).toBeLessThan(d.pxH);
  });
  it('iPadOS pretends to be a Mac but has touch', () => {
    expect(detectDevice({ ua: IPADOS, width: 820, height: 1180, dpr: 2, maxTouchPoints: 5 }).label).toBe('your iPad');
    expect(detectDevice({ ua: IPADOS, width: 1512, height: 982, dpr: 2, maxTouchPoints: 0 })).toEqual({ kind: 'desktop', label: 'this Mac', pxW: 3024, pxH: 1964 });
  });
  it('Windows laptop with a touch screen is a desktop', () => {
    expect(detectDevice({ ua: WIN, width: 1536, height: 864, dpr: 1.25, maxTouchPoints: 10 }).kind).toBe('desktop');
  });
});

describe('sharpnessOn', () => {
  it('compares the largest size with the screen', () => {
    expect(sharpnessOn(3840, { pxW: 1179, pxH: 2556 })).toBe('sharp');
    expect(sharpnessOn(2400, { pxW: 1179, pxH: 2556 })).toBe('good');
    expect(sharpnessOn(1920, { pxW: 3840, pxH: 2160 })).toBe('soft');
    expect(sharpnessOn(null, { pxW: 1, pxH: 1 })).toBeNull();
  });
});
