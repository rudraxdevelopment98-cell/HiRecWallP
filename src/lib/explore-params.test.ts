import { describe, expect, it } from 'vitest';
import { parseExploreParams } from './explore-params';

describe('parseExploreParams', () => {
  it('parses valid filters and ignores junk', () => {
    const { filters, page } = parseExploreParams({
      device: ['Mobile', 'Toaster'],
      orientation: 'portrait',
      res: '5K',
      sort: 'title',
      free: '0',
      page: '3',
    });
    expect(filters.devices).toEqual(['Mobile']);
    expect(filters.orientation).toBe('portrait');
    expect(filters.resolution).toBe('5K');
    expect(filters.sort).toBe('title');
    expect(filters.free).toBe(false);
    expect(page).toBe(3);
  });

  it('defaults safely', () => {
    const { filters, page } = parseExploreParams({ sort: 'drop table', page: '-4', res: '8K' });
    expect(filters.sort).toBe('newest');
    expect(filters.resolution).toBeUndefined();
    expect(page).toBe(1);
  });
});
