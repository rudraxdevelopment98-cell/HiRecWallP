import { describe, expect, it } from 'vitest';
import { countryForTimeZone } from './timezones';

describe('countryForTimeZone', () => {
  it('maps real zones and legacy aliases', () => {
    expect(countryForTimeZone('Asia/Kolkata')).toBe('IN');
    expect(countryForTimeZone('Asia/Calcutta')).toBe('IN');
    expect(countryForTimeZone('America/New_York')).toBe('US');
    expect(countryForTimeZone('Europe/London')).toBe('GB');
    expect(countryForTimeZone('Asia/Karachi')).toBe('PK');
  });
  it('returns null for UTC-like or unknown zones', () => {
    expect(countryForTimeZone('UTC')).toBeNull();
    expect(countryForTimeZone('Etc/GMT+5')).toBeNull();
    expect(countryForTimeZone(undefined)).toBeNull();
  });
});
