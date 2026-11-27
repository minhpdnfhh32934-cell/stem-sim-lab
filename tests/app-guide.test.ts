import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildAppGuide, serialize } from '../scripts/data/gen-app-guide.mjs';

/** AI Teacher's SimLab app guide (data/app_guide.json) is generated from the code and data. */
describe('SimLab app guide', () => {
  const guide = buildAppGuide();

  it('matches the code (run `npm run app-guide` after the app changes)', () => {
    expect(readFileSync('data/app_guide.json', 'utf8').replace(/\r\n/g, '\n')).toBe(
      serialize(guide),
    );
  });

  it('has the twelve sections, overview first, in both languages', () => {
    const ids = guide.sections.map((s) => s.id);
    expect(ids[0]).toBe('app-overview');
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    for (const s of guide.sections) {
      for (const locale of ['vi', 'en'] as const) {
        expect(s[locale].title, s.id).not.toBe('');
        expect(s[locale].text, s.id).not.toMatch(/undefined|\[object |NaN/);
        expect(s[locale].text.length, s.id).toBeLessThan(5800);
      }
    }
    expect(guide.reviewStatus).toBe('pending');
  });

  it('counts the shortcuts, settings pages and curriculum from the code', () => {
    const files = guide.sections.find((s) => s.id === 'app-files-shortcuts-settings');
    expect(files?.vi.text).toContain('Phím tắt (19)');
    expect(files?.vi.text).toContain('Cài đặt có 13 trang');
    const kntt = guide.sections.find((s) => s.id === 'app-curriculum-kntt');
    expect(kntt?.vi.text).toContain('tổng 189 bài lí thuyết');
  });
});
