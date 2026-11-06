import { describe, expect, it } from 'vitest';
import { passwordProblem, passwordScore } from './password-rules';

describe('password rules', () => {
  it('rejects short, single-class, repeated, email-based and common passwords', () => {
    expect(passwordProblem('short1')).toMatch(/at least/);
    expect(passwordProblem('onlyletterslong')).toMatch(/Mix/);
    expect(passwordProblem('kuldeep2026xyz', 'kuldeep@example.com')).toMatch(/email/);
    expect(passwordProblem('mypassword123')).toMatch(/common/);
  });
  it('accepts a decent passphrase', () => {
    expect(passwordProblem('blue-tiger-river-42', 'someone@example.com')).toBeNull();
  });
  it('scores longer, varied passwords higher', () => {
    expect(passwordScore('abcdefghij1')).toBeLessThan(passwordScore('Blue-Tiger-River-42!'));
    expect(passwordScore('')).toBe(0);
  });
});
