import { describe, expect, it } from 'vitest';
import { hammingDistance, isNearDuplicate } from './phash';

describe('hammingDistance', () => {
  it('is zero for identical hashes', () => {
    expect(hammingDistance('ffffffffffffffff', 'ffffffffffffffff')).toBe(0);
  });

  it('counts differing bits', () => {
    // 0x0 vs 0xf differ in 4 bits; rest identical
    expect(hammingDistance('0000000000000000', 'f000000000000000')).toBe(4);
    expect(hammingDistance('0000000000000000', 'ff00000000000000')).toBe(8);
  });

  it('guards against mismatched lengths', () => {
    expect(hammingDistance('ff', 'ffff')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('isNearDuplicate', () => {
  it('flags small distances as duplicates', () => {
    expect(isNearDuplicate('0000000000000000', 'f000000000000000')).toBe(true); // 4 <= 8
  });
  it('rejects large distances', () => {
    expect(isNearDuplicate('0000000000000000', 'ffffffffffff0000')).toBe(false); // 48 > 8
  });
});
