import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { guideChapter, guideChapters, guideNeighbours } from './guide';

describe('guide content', () => {
  const all = guideChapters(['customer', 'creator', 'admin']);

  it('has chapters for every audience with unique slugs', () => {
    for (const a of ['customer', 'creator', 'admin'] as const) expect(guideChapters([a]).length).toBeGreaterThan(0);
    expect(new Set(all.map((c) => c.slug)).size).toBe(all.length);
  });

  it('every step has text, an existing image and a box inside the picture', () => {
    for (const c of all) {
      expect(c.steps.length).toBeGreaterThan(0);
      for (const s of c.steps) {
        expect(s.title.length).toBeGreaterThan(2);
        expect(s.body.length).toBeGreaterThan(10);
        expect(s.image).toMatch(/^\/guide\/[a-z0-9-]+\.webp$/);
        expect(existsSync(path.join(process.cwd(), 'public', s.image!))).toBe(true);
        if (s.box) {
          expect(s.box.x).toBeGreaterThanOrEqual(0);
          expect(s.box.y).toBeGreaterThanOrEqual(0);
          expect(s.box.x + s.box.w).toBeLessThanOrEqual(1.0001);
          expect(s.box.y + s.box.h).toBeLessThanOrEqual(1.0001);
        }
      }
    }
  });

  it('keeps admin chapters out of the public guide', () => {
    const admin = guideChapters(['admin'])[0]!;
    expect(guideChapter(admin.slug, ['customer', 'creator'])).toBeNull();
    expect(guideChapter(admin.slug, ['admin'])?.slug).toBe(admin.slug);
  });

  it('links chapters in order', () => {
    const list = guideChapters(['customer', 'creator']);
    expect(guideNeighbours(list[0]!.slug, ['customer', 'creator']).prev).toBeNull();
    expect(guideNeighbours(list[0]!.slug, ['customer', 'creator']).next?.slug).toBe(list[1]!.slug);
  });
});
