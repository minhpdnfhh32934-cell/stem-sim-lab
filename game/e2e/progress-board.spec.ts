import { expect, test } from '@playwright/test';
import { sceneSave } from './saves';
import { expectDebug, menuContinue, shot, type Vec3 } from './support';

// The hub's learning progress board (Phú, 2026-11-10): on the south wall left of the door from the
// preparation room, drawn from the save — experiments done by subject, the paper marks, the topics
// learned, the guided tasks, the next experiment. Seen from the hub's middle, in both languages.

const STAND: Vec3 = [-5.6, 0, 0.6];
const BOARD: Vec3 = [-5.6, 2.8, 5.97];

function save() {
  const base = sceneSave('simlab-hub', STAND, BOARD);
  return {
    ...base,
    version: 11,
    world: { ...base.world, clockS: 9 * 3600 },
    progression: {
      ...base.progression,
      // The kinematics topic whole, two chemistry and one biology experiment.
      completedExperiments: [
        'free-fall',
        'projectile-motion',
        'measuring-speed',
        'newtons-second-law',
        'dilution',
        'acid-base-titration',
        'osmosis',
      ],
      papers: [],
      scores: [6, 7.5, 9, 4.5, 8].map((score, i) => ({
        paper: i + 1,
        experiments: ['free-fall'],
        points: score,
        max: 10,
        score,
      })),
    },
  };
}

for (const language of ['en', 'vi'] as const) {
  test(`progress board in the hub (${language})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((lang) => {
      localStorage.setItem('simlab.settings.language', lang);
      localStorage.setItem('simlab.settings.roomSleep', 'false');
    }, language);
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript(
      (value) => localStorage.setItem('simlab.save.slot-1', value),
      JSON.stringify(save()),
    );
    await page.goto('/');
    await menuContinue(page);
    await expectDebug(page, 'Scene', 'simlab-hub');
    await expectDebug(page, 'Phase', 'playing');
    await page.waitForTimeout(3000); // the board looks once a second; the lab pack in
    await shot(page, `progress-board-${language}`);
    expect(errors).toEqual([]);
  });
}
