import { describe, expect, it } from 'vitest';
import { priorityFor, slaState, ticketRef } from './support-rules';

const base = (created: string) => ({
  status: 'open' as const,
  ack_due_at: new Date(new Date(created).getTime() + 48 * 3_600_000).toISOString(),
  resolve_due_at: new Date(new Date(created).getTime() + 30 * 86_400_000).toISOString(),
  first_response_at: null as string | null,
});

describe('support SLA', () => {
  const created = '2026-11-01T00:00:00Z';
  it('is ok right after creation', () => {
    expect(slaState(base(created), new Date('2026-11-01T01:00:00Z'))).toBe('ok');
  });
  it('warns 12 h before the acknowledgement deadline, then flags it overdue', () => {
    expect(slaState(base(created), new Date('2026-11-02T13:00:00Z'))).toBe('ack_due_soon');
    expect(slaState(base(created), new Date('2026-11-03T01:00:00Z'))).toBe('ack_overdue');
  });
  it('a staff reply clears the acknowledgement clock', () => {
    const t = { ...base(created), first_response_at: '2026-11-01T05:00:00Z' };
    expect(slaState(t, new Date('2026-11-05T00:00:00Z'))).toBe('ok');
    expect(slaState(t, new Date('2026-11-29T00:00:00Z'))).toBe('resolve_due_soon');
    expect(slaState(t, new Date('2026-12-02T00:00:00Z'))).toBe('resolve_overdue');
  });
  it('resolved tickets have no clock', () => {
    expect(slaState({ ...base(created), status: 'resolved' }, new Date('2027-01-01T00:00:00Z'))).toBe('done');
  });
  it('labels and priorities', () => {
    expect(ticketRef(1001)).toBe('HW-T1001');
    expect(priorityFor('wrong_charge')).toBe('high');
    expect(priorityFor('quality')).toBe('normal');
  });
});
