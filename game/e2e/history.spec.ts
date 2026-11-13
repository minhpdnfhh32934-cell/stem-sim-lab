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
  position,
  PROJECTILE_TARGETS as T,
  projectileTheory,
  RANGE,
  readCsv,
  shot,
  use,
  type Vec3,
} from './support';

// Phase 6C.3 in the real app: run history, comparison and CSV export at both stations, reached
// by Continue (no developer jump). Two runs with different settings, both listed; one picked to
// view, both picked to compare (overlays from each run's samples, each with its own theory); a
// run exported and the downloaded file read back; then the dials changed and the first run
// opened again — its settings and theory are those it ran with. The closure tests below add
// three and four runs compared, the fifth refused, keyboard-only ticking, the real Escape key,
// keys and focus, and narrow or short windows. Rendering is software WebGL.

/** At the projectile desk, a ball loaded, the defaults v₀ 8 m/s, θ 45°, Earth. */
const RANGE_SAVE = labSave([AT_DESK.x, 0, AT_DESK.z], T.dialVelocity, {
  [`${RANGE}/launcher`]: { loaded: `${RANGE}/ball-2` },
});
/** East of the pendulum desk: its dials, RUN, RESET and the results monitor all within reach. */
const BAY_STAND: Vec3 = [3.6, 0, -8.7];
const BAY_SAVE = labSave(BAY_STAND, P.run, { [`${BAY}/pendulum`]: { 'param.angle': 30 } });

test('projectile: two runs listed, compared and exported; run 1 keeps its own settings', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await continueFrom(page, RANGE_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  const launcher = `${RANGE}/launcher`;
  await expectStation(page, launcher, 'configured velocity=8 angle=45 gravity=9.81');

  // Run 1: v₀ down to 6 m/s (F, 0.5 m/s a click), 45°, Earth.
  await dial(page, aim, T.dialVelocity, `${RANGE}/dial-velocity`, 'f', 4);
  await expectStation(page, launcher, 'configured velocity=6 angle=45 gravity=9.81');
  const first = projectileTheory(6, 45, 9.81);
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, launcher, `completed .* range=${first.range.toFixed(3)} `);

  // Run 2: θ down to 30°, RESET, RUN.
  await dial(page, aim, T.dialAngle, `${RANGE}/dial-angle`, 'f', 3);
  await use(page, aim, T.reset, `${RANGE}/button-reset`, 'RESET');
  const second = projectileTheory(6, 30, 9.81);
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(
    page,
    launcher,
    `completed velocity=6 angle=30 .* range=${second.range.toFixed(3)} `,
  );

  // The results monitor: both runs listed, newest first, the current one marked.
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  let panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  const rows = panel.locator('li.results-run[data-run]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('data-run', '2');
  await expect(rows.nth(0)).toHaveAttribute('aria-current', 'true');
  await expect(rows.nth(0)).toContainText('#2 · v₀ 6 m/s · θ 30 ° · g Earth');
  await expect(rows.nth(1)).toContainText('#1 · v₀ 6 m/s · θ 45 ° · g Earth');
  await expect(rows.nth(1)).toContainText(`Range ${Number(first.range.toPrecision(4))} m`);
  await expect(panel.locator('h2')).toContainText('run 2 (completed)');
  await shot(page, 'history-1-projectile-runs');

  // Run 1 alone: shown instead of the current run, as recorded.
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  await expect(panel.locator('h2 .results-badge')).toHaveText('recorded');
  const range = panel.locator('tr[data-result="range"]');
  await expect(range.locator('.theory')).toHaveText(`${first.range.toFixed(3)} m`);
  await expect(range.locator('.measured')).toHaveText(`${first.range.toFixed(3)} m`);

  // Runs 1 and 2 compared: overlays from each run's samples, each with its own theory.
  await panel.getByRole('checkbox', { name: 'Select run 2' }).check();
  await expect(panel.locator('h2')).toContainText('comparing runs #1, #2');
  const trajectory = panel.locator('svg[data-compare="trajectory"]');
  await expect(trajectory.locator('polyline[data-run]')).toHaveCount(2);
  await expect(panel.locator('svg[data-compare="height-time"] polyline[data-run]')).toHaveCount(2);
  const marks = trajectory.locator('line.mark');
  expect(Number(await marks.nth(0).getAttribute('data-value'))).toBeCloseTo(first.range, 9);
  expect(Number(await marks.nth(1).getAttribute('data-value'))).toBeCloseTo(second.range, 9);
  await expect(panel.locator('.results-legend')).toContainText('#1 · θ 45 °');
  await expect(panel.locator('.results-legend')).toContainText('#2 · θ 30 °');
  const compared = panel.locator('table.results-compare tr[data-result="range"] td');
  await expect(compared.nth(0)).toContainText(`theory ${first.range.toFixed(3)} m`);
  await expect(compared.nth(1)).toContainText(`theory ${second.range.toFixed(3)} m`);
  await shot(page, 'history-2-projectile-compare');

  // Run 1 exported: the downloaded file is its recorded samples, identical each time.
  const csv = await exportRun(page, panel, 1);
  expect(csv.name).toBe('simlab-projectile-motion-run-001.csv');
  const { meta, header, rows: data } = readCsv(csv.text);
  expect(meta).toContain('# Parameter velocity (v₀) = 6 m/s');
  expect(meta).toContain('# Parameter angle (θ) = 45 °');
  expect(header).toEqual(['time_s', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'speed_m_s']);
  const samples = Number(
    await trajectory.locator('polyline[data-run="1"]').getAttribute('data-samples'),
  );
  expect(data).toHaveLength(samples);
  expect(data[0]?.slice(0, 3)).toEqual([0, 0, 0.59]); // launched from the muzzle
  const landing = data.at(-1) ?? [];
  expect(landing[0]).toBeCloseTo(first.time, 9);
  expect(landing[1]).toBeCloseTo(first.range, 9);
  expect(landing[2]).toBe(0);
  expect((await exportRun(page, panel, 1)).text).toBe(csv.text);

  // New dials at the desk (v₀ up to 10 m/s); run 1, opened again, is as it was run.
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await expect(panel).toBeHidden();
  await dial(page, aim, T.dialVelocity, `${RANGE}/dial-velocity`, 'e', 8);
  await expectStation(page, launcher, 'completed velocity=10 angle=30 gravity=9.81');
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  await expect(panel.locator('h2')).toContainText('comparing runs #1, #2'); // still picked
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 2' }).uncheck();
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const params = panel.locator('.results-params dd');
  await expect(params.nth(0)).toHaveText('6 m/s');
  await expect(params.nth(1)).toHaveText('45 °');
  await expect(params.nth(2)).toHaveText('9.81 m/s²');
  await expect(range.locator('.theory')).toHaveText(`${first.range.toFixed(3)} m`);
  await expect(range.locator('.measured')).toHaveText(`${first.range.toFixed(3)} m`);
  await expect(panel.locator('.results-recorded')).toContainText(
    'The dials now read v₀ 10 m/s · θ 30 ° · g Earth',
  );
  await shot(page, 'history-3-projectile-run1-later');
  expect(errors).toEqual([]);
});

test('pendulum: two lengths compared and exported; run 1 keeps its own theory', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await continueFrom(page, BAY_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  const pendulum = `${BAY}/pendulum`;
  await expectStation(page, pendulum, 'configured length=1 angle=30 gravity=9.81');

  // Run 1 at 1 m, run 2 at 1.5 m (θ₀ 30°, Earth): three periods each.
  const T1 = pendulumPeriod30(1, 9.81);
  const T2 = pendulumPeriod30(1.5, 9.81);
  await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
  await expectStation(page, pendulum, `completed .* period=${T1.toFixed(3)} `);
  await dial(page, aim, P.dialLength, `${BAY}/dial-length`, 'e', 2);
  await use(page, aim, P.reset, `${BAY}/button-reset`, 'RESET');
  await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
  await expectStation(page, pendulum, `completed length=1.5 .* period=${T2.toFixed(3)} `);

  // Both compared: θ, ω, phase and total energy overlaid; each run's own exact period marked.
  let panel = await openResults(page, aim, P.monitor, `${BAY}/monitor`);
  await expect(panel.locator('li.results-run[data-run]')).toHaveCount(2);
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  await panel.getByRole('checkbox', { name: 'Select run 2' }).check();
  await expect(panel.locator('h2')).toContainText('comparing runs #1, #2');
  for (const graph of ['angle-time', 'angular-velocity-time', 'phase', 'energy-time']) {
    await expect(panel.locator(`svg[data-compare="${graph}"] polyline[data-run]`)).toHaveCount(2);
  }
  const marks = panel.locator('svg[data-compare="angle-time"] line.mark');
  expect(Number(await marks.nth(0).getAttribute('data-value'))).toBeCloseTo(T1, 9);
  expect(Number(await marks.nth(1).getAttribute('data-value'))).toBeCloseTo(T2, 9);
  await expect(panel.locator('.results-legend')).toContainText('#1 · L 1 m');
  await expect(panel.locator('.results-legend')).toContainText('#2 · L 1.5 m');
  const periods = panel.locator('table.results-compare tr[data-result="period"] td');
  await expect(periods.nth(0)).toContainText(`theory ${T1.toFixed(3)} s`);
  await expect(periods.nth(1)).toContainText(`theory ${T2.toFixed(3)} s`);
  await shot(page, 'history-4-pendulum-compare');
  // The other tested window size: the maximized native window's 1699×935 CSS pixels.
  await page.setViewportSize({ width: 1699, height: 935 });
  await shot(page, 'history-4b-pendulum-compare-1699x935');
  await page.setViewportSize({ width: 1280, height: 720 });

  // Run 2 exported: θ as stored (with a degrees copy), every sample, the run's end last.
  const csv = await exportRun(page, panel, 2);
  expect(csv.name).toBe('simlab-pendulum-run-002.csv');
  const { meta, header, rows: data } = readCsv(csv.text);
  expect(meta).toContain('# Parameter length (L) = 1.5 m');
  expect(header.slice(0, 4)).toEqual(['time_s', 'theta_rad', 'theta_deg', 'omega_rad_s']);
  const samples = Number(
    await panel
      .locator('svg[data-compare="angle-time"] polyline[data-run="2"]')
      .getAttribute('data-samples'),
  );
  expect(data).toHaveLength(samples);
  expect(data[0]?.[1]).toBe((30 * Math.PI) / 180);
  expect(data[0]?.[2]).toBeCloseTo(30, 12);
  expect(data.at(-1)?.[0]).toBeCloseTo(3 * T2, 6); // ends at the third full swing

  // New dials (L 0.5 m, Moon); run 1, opened again, keeps its own settings and theory.
  await dial(page, aim, P.dialLength, `${BAY}/dial-length`, 'f', 4);
  await expect(panel).toBeHidden();
  await dial(page, aim, P.dialGravity, `${BAY}/dial-gravity`, 'f', 2);
  await expectStation(page, pendulum, 'completed length=0.5 angle=30 gravity=1.62');
  panel = await openResults(page, aim, P.monitor, `${BAY}/monitor`);
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 2' }).uncheck();
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const params = panel.locator('.results-params dd');
  await expect(params.nth(0)).toHaveText('1 m');
  await expect(params.nth(1)).toHaveText('30 °');
  await expect(params.nth(2)).toHaveText('9.81 m/s²');
  const exact = panel.locator('tr[data-result="period"]');
  await expect(exact.locator('.theory')).toHaveText(`${T1.toFixed(3)} s`);
  await expect(exact.locator('.measured')).toHaveText(`${T1.toFixed(3)} s`);
  await expect(panel.locator('tr[data-result="period-small-angle"] .theory')).toHaveText(
    `${(2 * Math.PI * Math.sqrt(1 / 9.81)).toFixed(3)} s`,
  );
  await expect(panel.locator('.results-recorded')).toContainText(
    'The dials now read L 0.5 m · θ₀ 30 ° · g Moon',
  );
  await shot(page, 'history-5-pendulum-run1-later');
  expect(errors).toEqual([]);
});

// ---- Phase 6C.3 closure ------------------------------------------------------------------------

type Turn = [Vec3, string, 'e' | 'f', number];

/** Presses Tab until the control named `name` has the keyboard focus (no mouse). */
async function tabTo(page: Page, name: string) {
  for (let i = 0; i < 40; i++) {
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (focused === name) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached "${name}"`);
}

const isLocked = (page: Page) => page.evaluate(() => document.pointerLockElement !== null);

const runsIn = (panel: Locator, selector: string) =>
  panel.locator(selector).evaluateAll((all) => all.map((e) => Number(e.getAttribute('data-run'))));

/**
 * The comparison shows exactly `picked`, in the order picked, everywhere (heading, legend,
 * table, every overlay), and each run's theory mark and table values are its own (`theory`).
 */
async function expectCompared(
  panel: Locator,
  picked: number[],
  graphs: string[],
  own: { graph: string; result: string; unit: string; theory: Record<number, number> },
) {
  await expect(panel.locator('h2')).toContainText(
    `comparing runs ${picked.map((n) => `#${n}`).join(', ')}`,
  );
  expect(await runsIn(panel, '.results-legend li[data-run]')).toEqual(picked);
  expect(await runsIn(panel, 'table.results-compare th[data-run]')).toEqual(picked);
  for (const graph of graphs) {
    expect(await runsIn(panel, `svg[data-compare="${graph}"] polyline[data-run]`)).toEqual(picked);
  }
  expect(await runsIn(panel, `svg[data-compare="${own.graph}"] line.mark`)).toEqual(picked);
  const marks = panel.locator(`svg[data-compare="${own.graph}"] line.mark`);
  const cells = panel.locator(`table.results-compare tr[data-result="${own.result}"] td`);
  for (const [i, n] of picked.entries()) {
    const value = own.theory[n] ?? NaN;
    expect(Number(await marks.nth(i).getAttribute('data-value'))).toBeCloseTo(value, 9);
    await expect(cells.nth(i).locator('.theory')).toHaveText(
      `theory ${value.toFixed(3)} ${own.unit}`,
    );
    await expect(cells.nth(i).locator('.measured')).toHaveText(`${value.toFixed(3)} ${own.unit}`);
  }
}

/** Everything the comparison draws: each line's points and samples, the marks, table, legend. */
const drawn = (panel: Locator) =>
  panel.evaluate((root) => ({
    lines: [...root.querySelectorAll('svg[data-compare] polyline')].map((l) => [
      l.closest('svg')?.getAttribute('data-compare'),
      l.getAttribute('data-run'),
      l.getAttribute('data-samples'),
      l.getAttribute('points'),
    ]),
    marks: [...root.querySelectorAll('svg[data-compare] line.mark')].map((m) => [
      m.getAttribute('data-run'),
      m.getAttribute('data-value'),
    ]),
    table: root.querySelector('table.results-compare')?.textContent,
    legend: root.querySelector('.results-legend')?.textContent,
  }));

test('projectile: three and four runs compared, a fifth refused, one dropped; later dials change nothing', async ({
  page,
}) => {
  test.setTimeout(400_000);
  const errors = await continueFrom(page, RANGE_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  const launcher = `${RANGE}/launcher`;
  // Five runs, the dials turned before each new one: (v₀, θ, g).
  const plan: [[number, number, number], Turn[]][] = [
    [[8, 45, 9.81], []],
    [[8, 30, 9.81], [[T.dialAngle, `${RANGE}/dial-angle`, 'f', 3]]],
    [[6, 30, 9.81], [[T.dialVelocity, `${RANGE}/dial-velocity`, 'f', 4]]],
    [[6, 30, 3.71], [[T.dialGravity, `${RANGE}/dial-gravity`, 'f', 1]]],
    [[6, 60, 3.71], [[T.dialAngle, `${RANGE}/dial-angle`, 'e', 6]]],
  ];
  const range: Record<number, number> = {};
  for (const [i, [[v, angle, g], turns]] of plan.entries()) {
    for (const turn of turns) await dial(page, aim, ...turn);
    if (i > 0) await use(page, aim, T.reset, `${RANGE}/button-reset`, 'RESET');
    await expectStation(page, launcher, `configured velocity=${v} angle=${angle} gravity=${g} `);
    const expected = projectileTheory(v, angle, g).range;
    range[i + 1] = expected;
    await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
    await expectStation(page, launcher, `completed .* range=${expected.toFixed(3)} `);
  }
  const own = { graph: 'trajectory', result: 'range', unit: 'm', theory: range };
  const graphs = ['trajectory', 'height-time'];
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  let panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  await expect(panel.locator('li.results-run[data-run]')).toHaveCount(5);

  // Three runs ticked with the keyboard alone (Tab to a box, Space), the mouse still captured.
  for (const n of [3, 2, 1]) {
    await tabTo(page, `Select run ${n}`);
    await page.keyboard.press('Space');
    await expect(panel.getByRole('checkbox', { name: `Select run ${n}` })).toBeChecked();
  }
  expect(await isLocked(page)).toBe(true);
  await expectCompared(panel, [3, 2, 1], graphs, own);
  await expect(panel.locator('.results-legend')).toContainText('#3 · v₀ 6 m/s · θ 30 °');
  // A box keeps the focus, yet game keys reach the game: F3 (the screenshot hides the overlay)
  // and S (a step back).
  await shot(page, 'closure-1-projectile-3-runs');
  const at = await position(page);
  await page.keyboard.down('s');
  await expect
    .poll(async () => Math.hypot(...(await position(page)).map((c, k) => c - (at[k] ?? 0))))
    .toBeGreaterThan(0.1);
  await page.keyboard.up('s');
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  await expectCompared(panel, [3, 2, 1], graphs, own);

  // A fourth with the mouse; then at most four: run 4's box is disabled, a click changes nothing.
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 5' }).check();
  await expectCompared(panel, [3, 2, 1, 5], graphs, own);
  const fifth = panel.getByRole('checkbox', { name: 'Select run 4' });
  await expect(fifth).toBeDisabled();
  await expect(fifth).toHaveAttribute('title', 'Compare at most 4 runs.');
  await expect(fifth).toHaveCSS('opacity', '0.35'); // visibly unavailable, not just inert
  await fifth.click({ force: true });
  await expect(fifth).not.toBeChecked();
  await expectCompared(panel, [3, 2, 1, 5], graphs, own);
  await shot(page, 'closure-2-projectile-4-runs');
  await page.setViewportSize({ width: 1699, height: 935 });
  await shot(page, 'closure-2b-projectile-4-runs-1699x935');
  await page.setViewportSize({ width: 1280, height: 720 });

  // One dropped: the others stay, in their order, each with its own data; run 4 is free again.
  await panel.getByRole('checkbox', { name: 'Select run 2' }).uncheck();
  await expectCompared(panel, [3, 1, 5], graphs, own);
  await expect(fifth).toBeEnabled();
  const kept = await drawn(panel);

  // Later dials (v₀ 10 m/s, Moon): the same lines, samples, marks, table and legend.
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await expect(panel).toBeHidden();
  await dial(page, aim, T.dialVelocity, `${RANGE}/dial-velocity`, 'e', 8);
  await dial(page, aim, T.dialGravity, `${RANGE}/dial-gravity`, 'f', 1);
  await expectStation(page, launcher, 'completed velocity=10 angle=60 gravity=1.62');
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  await expectCompared(panel, [3, 1, 5], graphs, own);
  expect(await drawn(panel)).toEqual(kept);
  expect(errors).toEqual([]);
});

test('pendulum: three and four runs on all four overlays, a stopped run kept out; usable from 1280 down to 430 px', async ({
  page,
}) => {
  test.setTimeout(400_000);
  const errors = await continueFrom(page, BAY_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  const pendulum = `${BAY}/pendulum`;
  const length = (key: 'e' | 'f', times: number): Turn => [
    P.dialLength,
    `${BAY}/dial-length`,
    key,
    times,
  ];
  // Four runs at θ₀ 30°: (L, g).
  const plan: [[number, number], Turn[]][] = [
    [[1, 9.81], []],
    [[1.5, 9.81], [length('e', 2)]],
    [[0.5, 9.81], [length('f', 4)]],
    [
      [1, 3.71],
      [length('e', 2), [P.dialGravity, `${BAY}/dial-gravity`, 'f', 1]],
    ],
  ];
  const period: Record<number, number> = {};
  for (const [i, [[L, g], turns]] of plan.entries()) {
    for (const turn of turns) await dial(page, aim, ...turn);
    if (i > 0) await use(page, aim, P.reset, `${BAY}/button-reset`, 'RESET');
    await expectStation(page, pendulum, `configured length=${L} angle=30 gravity=${g} `);
    const expected = pendulumPeriod30(L, g);
    period[i + 1] = expected;
    await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
    await expectStation(page, pendulum, `completed .* period=${expected.toFixed(3)} `);
  }
  // A fifth run STOPped mid-swing: kept, marked and exportable, never viewed or compared.
  await use(page, aim, P.reset, `${BAY}/button-reset`, 'RESET');
  await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
  await use(page, aim, P.stop, `${BAY}/button-stop`, 'STOP');
  await expectStation(page, pendulum, String.raw`stopped .* t=\d`);
  const own = { graph: 'angle-time', result: 'period', unit: 's', theory: period };
  const graphs = ['angle-time', 'angular-velocity-time', 'phase', 'energy-time'];
  let panel = await openResults(page, aim, P.monitor, `${BAY}/monitor`);
  await freeMouse(page);
  const stopped = panel.locator('li.results-run[data-run="5"]');
  await expect(stopped).toHaveAttribute('data-status', 'stopped');
  await expect(stopped.locator('.results-badge')).toHaveText(['current', 'stopped']);
  const box5 = panel.getByRole('checkbox', { name: 'Select run 5' });
  await expect(box5).toBeDisabled();
  await expect(box5).toHaveAttribute(
    'title',
    'Only completed runs can be viewed and compared; export it as CSV.',
  );
  const partial = await exportRun(page, panel, 5);
  expect(partial.name).toBe('simlab-pendulum-run-005.csv');
  const { meta: partialMeta, rows: partialRows } = readCsv(partial.text);
  expect(partialMeta.some((l) => l.startsWith('# Status: stopped at '))).toBe(true);
  expect(partialMeta).toContain('# Results: none (the run did not complete)');
  expect(partialRows.length).toBeGreaterThan(10);
  for (const n of [1, 2, 3]) await panel.getByRole('checkbox', { name: `Select run ${n}` }).check();
  await expectCompared(panel, [1, 2, 3], graphs, own);
  await expect(panel.locator('.results-legend')).toContainText('#3 · L 0.5 m');
  await shot(page, 'closure-3-pendulum-3-runs');
  await panel.getByRole('checkbox', { name: 'Select run 4' }).check();
  await expectCompared(panel, [1, 2, 3, 4], graphs, own);
  await expect(panel.locator('.results-legend')).toContainText('#4 · L 1 m · g Mars');
  await shot(page, 'closure-4-pendulum-4-runs');

  // Narrow and short windows: the panel stays inside the window and nothing is lost: every
  // run's box and CSV button, the table's last cell and the last graph can be scrolled to, and
  // the mouse still ticks runs there.
  for (const [width, height] of [
    [720, 720],
    [600, 720],
    [430, 860],
    [1280, 480],
  ] as const) {
    const size = `${width}×${height}`;
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
    const box = await panel.boundingBox();
    expect(box, size).not.toBeNull();
    expect(box!.x, size).toBeGreaterThanOrEqual(0);
    expect(box!.y, size).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, size).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height, size).toBeLessThanOrEqual(height);
    await expect(page.locator('.hud-objective')).toBeHidden();
    // The hint telling how to get the mouse back stays whole (it wraps when narrow).
    const hint = await page.locator('.hud-hint').boundingBox();
    expect(hint!.x, size).toBeGreaterThanOrEqual(0);
    expect(hint!.x + hint!.width, size).toBeLessThanOrEqual(width);
    for (const n of [1, 2, 3, 4]) {
      for (const control of [
        panel.getByRole('checkbox', { name: `Select run ${n}` }),
        panel.getByRole('button', { name: `Export run ${n} as CSV` }),
      ]) {
        await control.scrollIntoViewIfNeeded();
        await expect(control, size).toBeInViewport();
      }
    }
    for (const part of [
      panel.locator('table.results-compare tr').last().locator('td').last(),
      panel.locator('svg[data-compare="energy-time"]'),
    ]) {
      await part.scrollIntoViewIfNeeded();
      await expect(part, size).toBeInViewport();
    }
    const four = panel.getByRole('checkbox', { name: 'Select run 4' });
    await four.uncheck();
    await four.check();
    await expectCompared(panel, [1, 2, 3, 4], graphs, own);
    await shot(page, `closure-5-pendulum-4-runs-${width}x${height}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  // One dropped; later dials (L 3 m, Moon) change nothing drawn or tabulated.
  await panel.getByRole('checkbox', { name: 'Select run 2' }).uncheck();
  await expectCompared(panel, [1, 3, 4], graphs, own);
  const kept = await drawn(panel);
  await dial(page, aim, P.dialLength, `${BAY}/dial-length`, 'e', 8);
  await expect(panel).toBeHidden();
  await dial(page, aim, P.dialGravity, `${BAY}/dial-gravity`, 'f', 1);
  await expectStation(page, pendulum, 'stopped length=3 angle=30 gravity=1.62');
  panel = await openResults(page, aim, P.monitor, `${BAY}/monitor`);
  await expectCompared(panel, [1, 3, 4], graphs, own);
  expect(await drawn(panel)).toEqual(kept);
  expect(errors).toEqual([]);
});

test('keys: Escape pauses the game, a click on the view resumes it, a select keeps its keys', async ({
  page,
}) => {
  const errors = await continueFrom(page, BAY_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await aim.to(aim.yaw + 0.2, aim.pitch); // a click on the view captures the mouse
  await expect.poll(() => isLocked(page)).toBe(true);
  await expect(page.locator('.hud-hint')).toBeHidden();

  // The real Escape key, through Playwright: the page gets it and pauses the game — the pause menu
  // opens, the mouse is let go, nothing moves. (A player's Esc lets the mouse go first, which
  // pauses too — the browser's own job, not done by headless Edge for automated keys.)
  const still = await position(page);
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  await expect(page.locator('.pause-panel')).toBeVisible();
  await expect.poll(() => isLocked(page)).toBe(false);
  expect(await position(page)).toEqual(still);

  // A click on the scene beside the dialog resumes play and captures the mouse again.
  await page.locator('.viewport').click({ position: { x: 24, y: 360 } });
  await expect.poll(() => isLocked(page)).toBe(true);
  await expect(page.locator('.pause')).toBeHidden();
  // Looking around works.
  const yaw = aim.yaw;
  await aim.to(yaw + 0.5, aim.pitch);
  await expect.poll(() => isLocked(page)).toBe(true);
  await expect(page.locator('.debug-text')).not.toContainText('· paused');
  await expect(page.locator('.pause')).toBeHidden();
  await expect(page.locator('.hud-hint')).toBeHidden();
  await aim.sync();
  expect(aim.yaw).toBeCloseTo(yaw + 0.5, 1);

  // A field that keeps its keys (the developer panel's scene list): W and the arrows do not
  // move the player; the arrow changes the field. (A focused checkbox does not keep them: see
  // the projectile test above.)
  const scenes = page.getByLabel('Scene to load');
  const choice = await scenes.inputValue();
  await scenes.focus();
  const before = await position(page);
  await page.keyboard.down('w');
  await page.waitForTimeout(400); // held long enough to walk 0.6 m if it reached the game
  await page.keyboard.up('w');
  await page.keyboard.press('ArrowDown');
  await expect(scenes).not.toHaveValue(choice);
  await page.waitForTimeout(300); // the debug position refreshes 4 times a second
  expect(await position(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('menu at 430 px: it fits the window, and its character row opens the character page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 860 });
  await page.goto('/');
  const menu = page.locator('.menu-panel');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(430);
  const row = page.getByRole('button', { name: /Choose your character/ });
  const rowBox = await row.boundingBox();
  expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(430);
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.char-page[data-ready="true"]')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.char-name')).toHaveText('Tuấn');
  await page.keyboard.press('Escape');
  await expect(page.locator('.char-page')).toBeHidden();
  await page.screenshot({ path: 'test-results/closure-6-menu-430x860.png' });
});
