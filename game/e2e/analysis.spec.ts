import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  dial,
  expectDebug,
  exportRun,
  freeMouse,
  labSave,
  openResults,
  readCsv,
  use,
  shot,
  type Vec3,
  menuContinue,
} from './support';

// Phase 14B in the real app: the Hooke's law station's data analysis. Four runs to rest — one on
// the 100 N/m spring, three on the 200 N/m spring — then, on the results monitor, the runs as one
// table and a straight line fitted through the points the player keeps: ticking runs out and back
// updates the fit and its graph; one point is not enough; the other spring is its own group; the
// table and fit export as CSV; the run view, comparison and run CSV still work; a narrow window
// still fits. Software WebGL: everything is read from the page, nothing from pixels.

const LAB = 'physics-lab';
const T = {
  instructions: [10.717, 2.425, -7.03],
  dialMass: [11.617, 0.875, -5.9],
  dialStiffness: [11.817, 0.875, -5.9],
  dialOffset: [12.217, 0.875, -5.9],
  run: [12.667, 0.875, -5.9],
  reset: [13.167, 0.875, -5.9],
  monitor: [12.867, 1.775, -7.455],
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 12.417, z: -5.35 };
const AT_MONITOR = { x: 12.867, z: -5.35 };
const SAVE = labSave([12.417, 0, -5.35], T.instructions);

async function runToRest(page: Page, aim: Aim, settings: string) {
  await use(page, aim, T.run, `${LAB}/spring-run`, 'RUN');
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${LAB}/spring completed ${settings} `),
    { timeout: 60_000 },
  );
  await use(page, aim, T.reset, `${LAB}/spring-reset`, 'RESET');
}

test("hooke's law analysis: a table of runs, a fitted line, points ticked in and out", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(SAVE) },
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Phase', 'playing');
  const aim = new Aim(page);
  await aim.sync();
  await approach(page, aim, T.instructions[0], AT_DESK.z);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);

  // 1. Four runs to rest: 0.5 kg on 100 N/m, then 0.5, 1 and 2 kg on 200 N/m.
  // Held at rest (y₀ = 0): each run is a static measurement, at rest at once.
  await dial(page, aim, T.dialOffset, `${LAB}/dial-offset`, 'f', 3);
  await dial(page, aim, T.dialStiffness, `${LAB}/dial-stiffness`, 'e', 2);
  await runToRest(page, aim, 'mass=0.5 stiffness=100');
  await dial(page, aim, T.dialStiffness, `${LAB}/dial-stiffness`, 'e', 1);
  await runToRest(page, aim, 'mass=0.5 stiffness=200');
  await dial(page, aim, T.dialMass, `${LAB}/dial-mass`, 'e', 1);
  await runToRest(page, aim, 'mass=1 stiffness=200');
  await dial(page, aim, T.dialMass, `${LAB}/dial-mass`, 'e', 1);
  await runToRest(page, aim, 'mass=2 stiffness=200');

  // 2. The analysis: the 200 N/m spring's three runs, from their records, and the fitted line.
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  const panel = await openResults(page, aim, T.monitor, `${LAB}/spring-monitor`);
  await freeMouse(page);
  // A run held at rest is a static measurement: no table of a swing it never made.
  const run4 = panel.getByRole('checkbox', { name: 'Select run 4' });
  await run4.check();
  await expect(panel).toContainText('No swing: the mass was held at rest (y₀ = 0)');
  await expect(panel.locator('table.oscillation-table')).toHaveCount(0);
  await run4.uncheck();
  await panel.getByRole('button', { name: 'Analyse the runs: table and fitted line' }).click();
  await expect(panel.locator('h2')).toHaveText("Hooke's law — data analysis");
  const group = panel.locator('select.analysis-group');
  await expect(group).toHaveValue('200');
  await expect(group.locator('option')).toHaveText(['k 100 N/m (1 runs)', 'k 200 N/m (3 runs)']);
  const table = panel.locator('table.analysis-table');
  await expect(table.locator('tr').first().locator('th')).toHaveText([
    'Fit',
    'Run',
    'm (kg)',
    'm·g (N)',
    'L₀ (m)',
    'L (m)',
    'Δl (m)',
    'm·g/Δl (N/m)',
  ]);
  const rows = table.locator('tr[data-run]');
  await expect(rows).toHaveCount(3);
  const expected = [
    [2, '0.5', '4.905'],
    [3, '1', '9.81'],
    [4, '2', '19.62'],
  ] as const;
  for (const [i, [run, m, w]] of expected.entries()) {
    await expect(rows.nth(i)).toHaveAttribute('data-run', String(run));
    await expect(rows.nth(i).locator('td').nth(1)).toHaveText(m); // m, as recorded
    await expect(rows.nth(i).locator('td').nth(2)).toHaveText(w); // m·g
  }
  const fit = (name: string) => panel.locator(`table.analysis-fit tr[data-fit="${name}"] td`);
  await expect(fit('n')).toHaveText('3 of 3');
  const slopeText = (await fit('slope').textContent()) ?? '';
  expect(slopeText).toMatch(/^[\d.]+ ± [\d.e−-]+ N\/m$/);
  const k = parseFloat(slopeText);
  expect(Math.abs(k - 200)).toBeLessThan(0.5); // k_exp, within 0.25 % of the spring's k
  await expect(fit('theory')).toHaveText('200 N/m'); // k_theory, from the runs' own theory
  await expect(fit('equation')).toContainText('m·g = ');
  await expect(fit('equation')).toContainText(' N/m · Δl ');
  expect(Number(await fit('r2').textContent())).toBeGreaterThan(0.9999);
  const chart = panel.locator('svg[data-analysis="hooke"]');
  await expect(chart.locator('circle.dot')).toHaveCount(3);
  await expect(chart.locator('polyline[data-line="fit"]')).toHaveCount(1);
  await expect(chart.locator('polyline[data-line="theory"]')).toHaveCount(1);
  await shot(page, 'analysis-1-fit');

  // 3. Run 3 left out: two points, a line through both — said to prove nothing.
  await panel.getByRole('checkbox', { name: 'Use run 3 in the fit' }).uncheck();
  await expect(fit('n')).toHaveText('2 of 3');
  await expect(rows.nth(1)).toHaveAttribute('data-used', 'false');
  await expect(chart.locator('circle.dot')).toHaveCount(2);
  await expect(panel.locator('.analysis-message')).toContainText('Two points always lie');
  await expect(fit('slope')).toHaveText(/^[\d.]+ N\/m$/); // no standard error from 2 points

  // 4. Run 2 out too: one point, no line, and the reason.
  await panel.getByRole('checkbox', { name: 'Use run 2 in the fit' }).uncheck();
  await expect(panel.locator('table.analysis-fit')).toHaveCount(0);
  await expect(panel.locator('.analysis-message')).toContainText(
    'No line: a fit needs at least 2 usable points, and 1 is ticked.',
  );
  await expect(chart.locator('polyline[data-line="fit"]')).toHaveCount(0);
  await panel.getByRole('checkbox', { name: 'Use run 2 in the fit' }).check();
  await panel.getByRole('checkbox', { name: 'Use run 3 in the fit' }).check();
  await expect(fit('n')).toHaveText('3 of 3');
  expect(parseFloat((await fit('slope').textContent()) ?? '')).toBe(k); // the same three points

  // 5. The table and the fit as CSV: every listed run, its included flag, the fit apart.
  await panel.getByRole('checkbox', { name: 'Use run 3 in the fit' }).uncheck();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Export the table and the fit as CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('simlab-hookes-law-analysis-hooke-stiffness-200.csv');
  const { readFileSync } = await import('node:fs');
  const csv = readCsv(readFileSync(await download.path(), 'utf8'));
  expect(csv.header.slice(0, 3)).toEqual(['run', 'included', 'mass_kg']);
  expect(csv.rows.map((r) => [r[0], r[1]])).toEqual([
    [2, 1],
    [3, 0],
    [4, 1],
  ]);
  expect(csv.meta.some((l) => l.startsWith('# Fit: n = 2; a = '))).toBe(true);
  await panel.getByRole('checkbox', { name: 'Use run 3 in the fit' }).check();

  // 6. The other spring is its own group: one run, nothing to fit.
  await group.selectOption('100');
  await expect(rows).toHaveCount(1);
  await expect(panel.locator('.analysis-message')).toContainText('and 1 is ticked');

  // 7. Back to the runs: the view, comparison and run CSV as before.
  await panel.getByRole('button', { name: 'Back to the run' }).click();
  await expect(panel.locator('h2')).toHaveText("Hooke's law"); // reset: no current run
  await expect(panel).toContainText('No current run');
  await panel.getByRole('checkbox', { name: 'Select run 3' }).check();
  await panel.getByRole('checkbox', { name: 'Select run 4' }).check();
  await expect(panel.locator('h2')).toContainText('comparing runs #3, #4');
  await expect(panel.locator('svg[data-compare="force-extension"] polyline[data-run]')).toHaveCount(
    2,
  );
  const run1 = await exportRun(page, panel, 1);
  expect(run1.name).toBe('simlab-hookes-law-run-001.csv');
  expect(readCsv(run1.text).header).toContain('extension_m');

  // 8. A narrow window: the analysis still fits, its table scrolling inside the panel.
  await page.setViewportSize({ width: 430, height: 820 });
  await panel.getByRole('button', { name: 'Analyse the runs: table and fitted line' }).click();
  await expect(table.locator('tr[data-run]')).toHaveCount(1); // the group chosen is kept
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await panel.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 430).toBe(true);
  await shot(page, 'analysis-2-narrow');
  expect(errors).toEqual([]);
});
