import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGameGuide, serialize } from '../scripts/game/gen-game-guide.mjs';

/** AI Teacher's SimLab 3D guide (data/game_guide.json) is generated from the game's content. */
describe('SimLab 3D guide', () => {
  const guide = buildGameGuide();

  it('matches the game content (run `npm run game-guide` after the game changes)', () => {
    expect(readFileSync('data/game_guide.json', 'utf8').replace(/\r\n/g, '\n')).toBe(
      serialize(guide),
    );
  });

  it('covers every experiment, room and guided task, overview first', () => {
    const ids = guide.sections.map((s) => s.id);
    expect(ids[0]).toBe('overview');
    expect(new Set(ids).size).toBe(ids.length);
    const content = 'game/src/content/';
    const experiments = readdirSync(`${content}experiments`).filter((f) => f.endsWith('.json'));
    const rooms = JSON.parse(readFileSync(`${content}rooms.json`, 'utf8')) as { id: string }[];
    const tasks = JSON.parse(readFileSync(`${content}tasks.json`, 'utf8')) as { id: string }[];
    for (const f of experiments) expect(ids).toContain(`experiment:${f.replace(/\.json$/, '')}`);
    for (const r of rooms) expect(ids).toContain(`room:${r.id}`);
    for (const t of tasks) expect(ids).toContain(`task:${t.id}`);
  });

  it('has a title and text in both languages, with no missing value', () => {
    for (const s of guide.sections) {
      for (const locale of ['vi', 'en'] as const) {
        expect(s[locale].title, s.id).not.toBe('');
        expect(s[locale].text, s.id).not.toMatch(/undefined|\[object |NaN/);
      }
    }
    expect(guide.reviewStatus).toBe('pending');
  });

  it('describes the controls of the copy inside SimLab (no voice chat)', () => {
    const controls = guide.sections.find((s) => s.id === 'controls');
    expect(controls?.vi.text).toContain('Space — Nhảy');
    expect(controls?.en.text).toContain('E — The action shown at the crosshair');
    expect(controls?.vi.text).not.toMatch(/Giữ để nói/);
  });

  it('covers the deeper systems and keeps every section short enough for a prompt', () => {
    const ids = guide.sections.map((s) => s.id);
    for (const id of [
      'characters',
      'npc:teacher',
      'test-papers',
      'laptop-books',
      'hub-boards',
      'how-experiments-work',
      'menu-and-saves',
      'emergency',
      'lan',
    ]) {
      expect(ids, id).toContain(id);
    }
    expect(ids).not.toContain('lan-details');
    const papers = guide.sections.find((s) => s.id === 'test-papers');
    expect(papers?.vi.text).toContain('1580');
    expect(guide.sections.find((s) => s.id === 'laptop-books')?.vi.text).toContain('233 bài học');
    expect(guide.sections.find((s) => s.id === 'characters')?.vi.text).toContain('Linh');
    for (const s of guide.sections) {
      for (const locale of ['vi', 'en'] as const) {
        expect(s[locale].text.length, s.id).toBeLessThan(5800);
      }
    }
  });
});
