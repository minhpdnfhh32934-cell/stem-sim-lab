import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  AT_DESK,
  AT_MONITOR,
  BAY,
  continueFrom,
  dial,
  expectDebug,
  expectStation,
  exportRun,
  freeMouse,
  labSave,
  openResults,
  PENDULUM_TARGETS as P,
  pendulumPeriod30,
  PROJECTILE_TARGETS as T,
  projectileTheory,
  RANGE,
  readCsv,
  shot,
  use,
  type Vec3,
  menuContinue,
} from './support';

// Phase 6C.4 in the real app, reached by Continue: at each station the instrument's resolution d
// is set with its desk dial, a run read at d = 0.1, the same run again at d = 0.001. The results
// panel shows each run's reading, d, u = d/√12 and d/2 with what they leave out; the records keep
// their own d; a comparison shows each run's own reading and u; the CSVs carry the same samples
// with each run's own measurement lines; a reload and Continue bring the dial back and the runs
// (the run history, P2b), and a new run is numbered after them.
// Rendering is software WebGL.

/** At the projectile desk, a ball loaded, the defaults v₀ 8 m/s, θ 45°, Earth, d 0.01 m. */
const RANGE_SAVE = labSave([AT_DESK.x, 0, AT_DESK.z], T.dialResolution, {
  [`${RANGE}/launcher`]: { loaded: `${RANGE}/ball-2` },
});
/** The cart's first ball (ball-2 is the one loaded and shot). */
const BALL_1: Vec3 = [-3.85, 0.83, 9.5];
/** East of the pendulum desk: dials, RUN, RESET and the results monitor within reach. */
const BAY_STAND: Vec3 = [3.6, 0, -8.7];
const BAY_SAVE = labSave(BAY_STAND, P.run, { [`${BAY}/pendulum`]: { 'param.angle': 30 } });

/** A value's reading at d = 10⁻ᵏ, from its decimal rounding (the test's own reference). */
function expectedReading(value: number, places: number): string {
  // Far from half-way, so the run's value (equal to the theory within 1e-9) rounds the same way.
  const steps = value * 10 ** places;
  expect(Math.abs((steps % 1) - 0.5)).toBeGreaterThan(1e-4);
  return value.toFixed(places);
}

/** The reading table of a result: reading, d, u and d/2 as shown. */
async function expectReading(panel: Locator, result: string, shown: string[]) {
  const table = panel.locator(`table.results-reading[data-reading="${result}"]`);
  await expect(table).toHaveCount(1);
  await expect(table.locator('td')).toHaveText(shown);
  await expect(table.locator('th')).toHaveText([
    'Reading',
    'Resolution d',
    'Standard uncertainty u = d/√12',
    'Largest rounding error d/2',
  ]);
}

/** Reload, then Continue: the game saved itself on leaving the page. */
async function reloadAndContinue(page: Page, aim: Aim) {
  await page.reload();
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'physics-lab');
  await expectDebug(page, 'Phase', 'playing');
  await aim.sync();
}

test('projectile: the range read by a tape at 0.1 m and 0.001 m; one flight, two readings', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await continueFrom(page, RANGE_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  const launcher = `${RANGE}/launcher`;
  const theory = projectileTheory(8, 45, 9.81);
  const fine = expectedReading(theory.range, 3);
  const coarse = expectedReading(theory.range, 1);
  await expectStation(
    page,
    launcher,
    'configured velocity=8 angle=45 gravity=9.81 resolution=0.01 ',
  );

  // Run 1 with the tape at 0.1 m (E: 0.01 → 0.1); the dial says what it sets.
  await use(page, aim, T.dialResolution, `${RANGE}/dial-resolution`, 'Raise tape resolution d');
  await expectStation(
    page,
    launcher,
    'configured velocity=8 angle=45 gravity=9.81 resolution=0.1 ',
  );
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, launcher, `completed .* range=${theory.range.toFixed(3)} `);

  // Run 2: the same shot with the tape at 0.001 m (F twice), RESET, RUN.
  await dial(page, aim, T.dialResolution, `${RANGE}/dial-resolution`, 'f', 2);
  await expectStation(
    page,
    launcher,
    'completed velocity=8 angle=45 gravity=9.81 resolution=0.001 ',
  );
  await use(page, aim, T.reset, `${RANGE}/button-reset`, 'RESET');
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(
    page,
    launcher,
    `completed .*resolution=0.001 .* range=${theory.range.toFixed(3)} `,
  );

  // The current run: theory, simulated (unrounded to 3 decimals), then the tape's reading.
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  const panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  await expect(panel.locator('h2')).toContainText('run 2 (completed)');
  await expect(
    panel.locator('table.results-table').first().locator('tr').first().locator('th'),
  ).toHaveText(['', 'Theory', 'Simulated', 'Difference']);
  const range = panel.locator('tr[data-result="range"]');
  await expect(range.locator('.measured')).toHaveText(`${theory.range.toFixed(3)} m`);
  await expect(panel.locator('.results-main h3')).toHaveText('Range R, read with: Tape measure');
  await expectReading(panel, 'range', [`${fine} m`, '0.001 m', '0.00029 m', '0.0005 m']);
  const note = panel.locator('.results-main .results-note').first();
  for (const words of [
    'rounded to the nearest multiple of d (half-way values away from zero)',
    'the simulated value itself is kept unrounded',
    'equally likely anywhere within ±d/2',
    'It is not the total uncertainty of a real measurement',
    'judging where the ball landed',
    "the simulation's own step error",
  ]) {
    await expect(note).toContainText(words);
  }
  await shot(page, 'measurement-1-projectile-run-2');

  // Run 1 alone: its own d and reading, while the dial reads 0.001 m.
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  await expect(panel.locator('.results-params dd').nth(3)).toHaveText('0.1 m');
  await expect(range.locator('.measured')).toHaveText(`${theory.range.toFixed(3)} m`);
  await expectReading(panel, 'range', [`${coarse} m`, '0.1 m', '0.029 m', '0.05 m']);
  await expect(panel.locator('.results-recorded')).toContainText('d 0.001 m');
  await shot(page, 'measurement-2-projectile-run-1');

  // Both compared: each run's own d, reading and u; one and the same trajectory.
  await panel.getByRole('checkbox', { name: 'Select run 2' }).check();
  await expect(panel.locator('h2')).toContainText('comparing runs #1, #2');
  const table = panel.locator('table.results-compare');
  await expect(table.locator('tr[data-parameter="resolution"] td')).toHaveText([
    '0.1 m',
    '0.001 m',
  ]);
  const readings = table.locator('tr[data-reading="range"] td');
  await expect(readings.locator('.reading')).toHaveText([`${coarse} m`, `${fine} m`]);
  await expect(readings.locator('.uncertainty')).toHaveText(['u 0.029 m', 'u 0.00029 m']);
  await expect(panel.locator('.results-legend')).toContainText('#1 · d 0.1 m');
  await expect(panel.locator('.results-legend')).toContainText('#2 · d 0.001 m');
  const trajectory = panel.locator('svg[data-compare="trajectory"]');
  const points = (run: number) =>
    trajectory.locator(`polyline[data-run="${run}"]`).getAttribute('points');
  expect(await points(2)).toBe(await points(1));
  await shot(page, 'measurement-3-projectile-compare');
  await page.setViewportSize({ width: 1699, height: 935 });
  await shot(page, 'measurement-3b-projectile-compare-1699x935');
  await page.setViewportSize({ width: 1280, height: 720 });

  // The CSVs: identical samples and landing; each run's own resolution, reading and u.
  const one = await exportRun(page, panel, 1);
  const two = await exportRun(page, panel, 2);
  expect([one.name, two.name]).toEqual([
    'simlab-projectile-motion-run-001.csv',
    'simlab-projectile-motion-run-002.csv',
  ]);
  const a = readCsv(one.text);
  const b = readCsv(two.text);
  expect(b.header).toEqual(['time_s', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'speed_m_s']);
  expect(b.header).toEqual(a.header);
  expect(b.rows).toEqual(a.rows);
  expect(a.rows.at(-1)?.[0]).toBeCloseTo(theory.time, 9);
  expect(a.rows.at(-1)?.[1]).toBeCloseTo(theory.range, 9);
  const result = (meta: string[]) => meta.find((l) => l.startsWith('# Result range '));
  expect(result(b.meta)).toBe(result(a.meta)); // one simulated range, unrounded
  expect(a.meta).toContain('# Parameter resolution (d) = 0.1 m');
  expect(b.meta).toContain('# Parameter resolution (d) = 0.001 m');
  expect(a.meta).toContain(
    `# Measurement range (Range R) by Tape measure: reading = ${coarse} m at resolution d = 0.1 m`,
  );
  expect(a.meta).toContain(
    `# Measurement range: standard uncertainty u = d/√12 = ${0.1 / Math.sqrt(12)} m; ` +
      'bound d/2 = 0.05 m',
  );
  expect(b.meta).toContain(
    `# Measurement range (Range R) by Tape measure: reading = ${fine} m at resolution d = 0.001 m`,
  );
  expect(b.meta).toContain(
    `# Measurement range: standard uncertainty u = d/√12 = ${0.001 / Math.sqrt(12)} m; ` +
      'bound d/2 = 0.0005 m',
  );
  expect((await exportRun(page, panel, 1)).text).toBe(one.text);

  // Reload and Continue: the tape's setting was saved, and the runs were kept (the run history):
  // a new shot is #3, listed first, above the two from before.
  await reloadAndContinue(page, aim);
  await expectStation(page, launcher, 'idle velocity=8 angle=45 gravity=9.81 resolution=0.001 ');
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await approach(page, aim, -3.6, 10.4);
  await use(page, aim, BALL_1, `${RANGE}/ball-1`, 'Grab');
  await expectDebug(page, 'Holding', `${RANGE}/ball-1`);
  await approach(page, aim, -2.1, 11.75);
  await use(page, aim, T.launcher, `${RANGE}/launcher`, 'Load into the launcher');
  await expectStation(
    page,
    launcher,
    'configured velocity=8 angle=45 gravity=9.81 resolution=0.001 ',
  );
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, launcher, `completed .* range=${theory.range.toFixed(3)} `);
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  const again = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  const rows = again.locator('li.results-run[data-run]');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('#3 · v₀ 8 m/s · θ 45 ° · g Earth · d 0.001 m');
  await expect(rows.nth(1)).toContainText('#2 · v₀ 8 m/s · θ 45 ° · g Earth · d 0.001 m');
  await expect(rows.nth(2)).toContainText('#1 · v₀ 8 m/s · θ 45 ° · g Earth · d 0.1 m');
  await expectReading(again, 'range', [`${fine} m`, '0.001 m', '0.00029 m', '0.0005 m']);
  expect(errors).toEqual([]);
});

test('pendulum: the period read by a timer at 0.1 s and 0.001 s; one swing, two readings', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await continueFrom(page, BAY_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  const pendulum = `${BAY}/pendulum`;
  const period = pendulumPeriod30(1, 9.81);
  const smallAngle = 2 * Math.PI * Math.sqrt(1 / 9.81);
  const fine = expectedReading(period, 3);
  const coarse = expectedReading(period, 1);
  await expectStation(page, pendulum, 'configured length=1 angle=30 gravity=9.81 resolution=0.01 ');

  // Run 1 with the timer at 0.1 s, run 2 at 0.001 s: the same swing (L 1 m, θ₀ 30°, Earth).
  await use(page, aim, P.dialResolution, `${BAY}/dial-resolution`, 'Raise timer resolution d');
  await expectStation(page, pendulum, 'configured length=1 angle=30 gravity=9.81 resolution=0.1 ');
  await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
  await expectStation(page, pendulum, `completed .* period=${period.toFixed(3)} `);
  await dial(page, aim, P.dialResolution, `${BAY}/dial-resolution`, 'f', 2);
  await use(page, aim, P.reset, `${BAY}/button-reset`, 'RESET');
  await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
  await expectStation(
    page,
    pendulum,
    `completed .*resolution=0.001 .* period=${period.toFixed(3)} `,
  );

  // The current run: both theories kept apart, one simulated period, one timer reading.
  const panel = await openResults(page, aim, P.monitor, `${BAY}/monitor`);
  await expect(panel.locator('h2')).toContainText('run 2 (completed)');
  const small = panel.locator('tr[data-result="period-small-angle"]');
  const exact = panel.locator('tr[data-result="period"]');
  await expect(small.locator('.theory')).toHaveText(`${smallAngle.toFixed(3)} s`);
  await expect(exact.locator('.theory')).toHaveText(`${period.toFixed(3)} s`);
  await expect(small.locator('.measured')).toHaveText(`${period.toFixed(3)} s`);
  await expect(exact.locator('.measured')).toHaveText(`${period.toFixed(3)} s`);
  await expect(panel.locator('table.results-reading')).toHaveCount(1);
  await expect(panel.locator('.results-main h3')).toHaveText(
    'Period T, read with: Timer (period mode)',
  );
  await expectReading(panel, 'period', [`${fine} s`, '0.001 s', '0.00029 s', '0.0005 s']);
  await expect(panel.locator('.results-main .results-note').first()).toContainText(
    "a person's reaction time with a stopwatch",
  );
  await shot(page, 'measurement-4-pendulum-run-2');

  // Run 1 alone, then both compared: each run's own d, reading and u; the same swing.
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  await expectReading(panel, 'period', [`${coarse} s`, '0.1 s', '0.029 s', '0.05 s']);
  await panel.getByRole('checkbox', { name: 'Select run 2' }).check();
  await expect(panel.locator('h2')).toContainText('comparing runs #1, #2');
  const table = panel.locator('table.results-compare');
  await expect(table.locator('tr[data-parameter="resolution"] td')).toHaveText([
    '0.1 s',
    '0.001 s',
  ]);
  const readings = table.locator('tr[data-reading="period"] td');
  await expect(readings.locator('.reading')).toHaveText([`${coarse} s`, `${fine} s`]);
  await expect(readings.locator('.uncertainty')).toHaveText(['u 0.029 s', 'u 0.00029 s']);
  await expect(panel.locator('.results-legend')).toContainText('#1 · d 0.1 s');
  const angle = panel.locator('svg[data-compare="angle-time"]');
  const points = (run: number) =>
    angle.locator(`polyline[data-run="${run}"]`).getAttribute('points');
  expect(await points(2)).toBe(await points(1));
  const marks = angle.locator('line.mark');
  expect(await marks.nth(1).getAttribute('data-value')).toBe(
    await marks.nth(0).getAttribute('data-value'),
  );
  await shot(page, 'measurement-5-pendulum-compare');
  await page.setViewportSize({ width: 1699, height: 935 });
  await shot(page, 'measurement-5b-pendulum-compare-1699x935');
  await page.setViewportSize({ width: 1280, height: 720 });

  // The CSVs: identical samples and period; each run's own resolution, reading and u.
  const a = readCsv((await exportRun(page, panel, 1)).text);
  const b = readCsv((await exportRun(page, panel, 2)).text);
  expect(b.header).toEqual(a.header);
  expect(b.rows).toEqual(a.rows);
  expect(a.rows.at(-1)?.[0]).toBeCloseTo(3 * period, 6);
  const result = (meta: string[]) => meta.find((l) => l.startsWith('# Result period '));
  expect(result(b.meta)).toBe(result(a.meta));
  expect(a.meta).toContain(
    `# Measurement period (Period T) by Timer (period mode): reading = ${coarse} s ` +
      'at resolution d = 0.1 s',
  );
  expect(b.meta).toContain(
    `# Measurement period (Period T) by Timer (period mode): reading = ${fine} s ` +
      'at resolution d = 0.001 s',
  );
  expect(b.meta).toContain(
    `# Measurement period: standard uncertainty u = d/√12 = ${0.001 / Math.sqrt(12)} s; ` +
      'bound d/2 = 0.0005 s',
  );

  // Reload and Continue: the timer's setting was saved and the runs were kept — a new run is #3.
  await reloadAndContinue(page, aim);
  await expectStation(
    page,
    pendulum,
    'configured length=1 angle=30 gravity=9.81 resolution=0.001 ',
  );
  await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
  await expectStation(page, pendulum, `completed .* period=${period.toFixed(3)} `);
  const again = await openResults(page, aim, P.monitor, `${BAY}/monitor`);
  const rows = again.locator('li.results-run[data-run]');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('#3 · L 1 m · θ₀ 30 ° · g Earth · d 0.001 s');
  await expect(rows.nth(2)).toContainText('#1 · L 1 m · θ₀ 30 ° · g Earth · d 0.1 s');
  await expectReading(again, 'period', [`${fine} s`, '0.001 s', '0.00029 s', '0.0005 s']);
  expect(errors).toEqual([]);
});
