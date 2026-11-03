import { describe, expect, it } from 'vitest';
import { canRedeemIn, escapeHtml, formatGiftCode, normaliseGiftCode } from './gift-rules';

describe('gift rules', () => {
  it('gifts redeem in the same or a cheaper tier only', () => {
    expect(canRedeemIn('T1', 'T1')).toBe(true);
    expect(canRedeemIn('T1', 'IN')).toBe(true);
    expect(canRedeemIn('IN', 'T1')).toBe(false); // India-priced credits can't go to the US
    expect(canRedeemIn('T4', 'T2')).toBe(false);
    expect(canRedeemIn('XX', 'IN')).toBe(false);
  });
  it('formats and normalises codes', () => {
    expect(formatGiftCode('ABCDEFGHJKLM')).toBe('ABCD-EFGH-JKLM');
    expect(normaliseGiftCode(' abcd-efgh jklm ')).toBe('ABCDEFGHJKLM');
  });
  it('escapes HTML in user text', () => {
    expect(escapeHtml('<b>"hi"</b> & \'x\'')).toBe('&lt;b&gt;&quot;hi&quot;&lt;/b&gt; &amp; &#39;x&#39;');
  });
});
