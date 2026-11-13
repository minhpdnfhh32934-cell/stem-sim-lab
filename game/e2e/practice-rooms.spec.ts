import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { Aim, expectDebug, openResults, shot, use, type Vec3 } from './support';

// The simulation tables of Phase X (the Chemistry and Biology practice rooms, the AC generator in
// the pendulum bay), in the real app, one test each: Continue from a save of a player standing at
// the station's control desk (no developer jump), RUN at the desk, the run completes, and on the
// results monitor every result the model computes exactly reads as its theory. Where each part
// stands comes from the shipped content, as the kit placed it.

interface Placement {
  readonly id: string;
  readonly item: string;
  readonly position: Vec3;
}
interface Result {
  readonly id: string;
  readonly theory?: string;
  readonly reduce: string;
  readonly classes?: unknown[];
}

const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const groups = read('src/content/lab-placements.json') as {
  room: string;
  placements: Placement[];
}[];
const SCENE: Readonly<Record<string, string>> = {
  'chemistry-annex': 'chemistry-lab',
  'biology-annex': 'biology-lab',
  'pendulum-bay': 'physics-lab',
};
// Theories that are expectations, not this run's value (drift is random): not compared.
const EXPECTATIONS = new Set(['population-genetics']);
// Readings the model takes as an instrument would, not exactly its theory: the peak of a speed scan
// (in steps of 3·v_p/1000), the mean and rms of the box's 400 particles (a sample at the
// distribution's quantiles) and a pH meter still settling after 30 s (τ = 3 s).
const READINGS: Readonly<Record<string, readonly string[]>> = {
  'gas-speeds': ['peak', 'mean', 'rms'],
  'ph-measurement': ['ionization', 'potential'],
};
const MONITOR_RISE = 0.475; // a risen monitor's screen centre above its placement
const EXPERIMENTS = readdirSync('src/content/experiments').map(
  (file) =>
    read(`src/content/experiments/${file}`) as {
      id: string;
      requiredEquipment: string[];
      results: Result[];
    },
);

const stations = Object.keys(SCENE).flatMap((room) => {
  const placements = groups.find((g) => g.room === room)?.placements ?? [];
  return placements
    .filter((p) => p.item === 'control-desk' && p.id.endsWith('-desk'))
    .flatMap((desk) => {
      const station = desk.id.slice(0, -'-desk'.length);
      if (room === 'pendulum-bay' && station !== 'generator') return []; // the bay's older benches
      const at = (suffix: string) => placements.find((p) => p.id === `${station}${suffix}`);
      const apparatus = at('');
      const run = at('-run');
      const monitor = at('-monitor');
      const display = at('-display');
      if (!apparatus || !run || !monitor || !display) return [];
      const experiment = EXPERIMENTS.find((e) => e.requiredEquipment.includes(apparatus.item));
      if (!experiment) return [];
      return [{ room, station, desk, apparatus, run, monitor, experiment }];
    });
});

for (const s of stations) {
  test(`${s.room}/${s.station}: Continue at the desk, RUN, results against theory`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    // The player stands 0.85 m from the desk's centre (it is 0.7 m deep), away from the apparatus.
    const [ax, , az] = s.apparatus.position;
    const [dx, , dz] = s.desk.position;
    const len = Math.hypot(dx - ax, dz - az) || 1;
    const stand: Vec3 = [dx + ((dx - ax) / len) * 0.85, 0, dz + ((dz - az) / len) * 0.85];
    const runAt: Vec3 = [s.run.position[0], s.run.position[1] + 0.025, s.run.position[2]];
    const errors = await continueInto(page, sceneSave(SCENE[s.room] ?? s.room, stand, runAt));
    const aim = new Aim(page);
    await aim.sync();
    await expectDebug(page, 'Room', s.room);

    await use(page, aim, runAt, `${s.room}/${s.station}-run`, 'RUN');
    await expect(page.locator('.debug-text')).toContainText(
      new RegExp(`Station:\\s+${s.room}/${s.station} completed`),
      { timeout: 100_000 }, // the collision table runs for 60 s
    );
    await aim.at([ax, s.apparatus.position[1] + 0.3, az]);
    await page.waitForTimeout(400);
    await shot(page, `practice-${s.station}-run`);

    const [mx, my, mz] = s.monitor.position;
    const panel = await openResults(
      page,
      aim,
      [mx, my + MONITOR_RISE, mz],
      `${s.room}/${s.station}-monitor`,
    );
    await expect(panel.locator('h2')).toContainText('run 1 (completed)');
    const exact = EXPECTATIONS.has(s.experiment.id)
      ? []
      : s.experiment.results.filter(
          (r) =>
            r.theory &&
            r.reduce === 'final' &&
            !r.classes &&
            !READINGS[s.experiment.id]?.includes(r.id),
        );
    for (const r of exact) {
      const row = panel.locator(`tr[data-result="${r.id}"]`);
      const theory = (await row.locator('.theory').textContent())?.trim() ?? '';
      expect(theory, r.id).toMatch(/\d/);
      await expect(row.locator('.measured'), r.id).toHaveText(theory);
    }
    await shot(page, `practice-${s.station}-results`);
    expect(errors).toEqual([]);
  });
}
