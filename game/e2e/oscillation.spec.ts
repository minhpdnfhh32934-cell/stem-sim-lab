import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  dial,
  expectDebug,
  freeMouse,
  labSave,
  openResults,
  shot,
  use,
  type Vec3,
  menuContinue,
} from './support';

// Phase 14C in the real app, played in Vietnamese: the spring's swing measured and analysed. Three
// runs on the 200 N/m spring, ζ = 0.05, let go 0.02 m below rest, with 0.5, 1 and 2 kg: on the
// results monitor, the last run's period measured from its samples against the damped and
// undamped theory, its peaks and decay; then the runs' T² against m fitted, 4π²/a against
// k(1 − ζ²); then a 430 px window. Software WebGL: everything is read from the page.

const LAB = 'physics-lab';
const T = {
  instructions: [10.717, 2.425, -7.03],
  dialMass: [11.617, 0.875, -5.9],
  dialStiffness: [11.817, 0.875, -5.9],
  dialOffset: [12.217, 0.875, -5.9],
  dialDamping: [12.417, 0.875, -5.9],
  run: [12.667, 0.875, -5.9],
  reset: [13.167, 0.875, -5.9],
  monitor: [12.867, 1.775, -7.455],
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 12.417, z: -5.35 };
const AT_MONITOR = { x: 12.867, z: -5.35 };
const SAVE = labSave([12.417, 0, -5.35], T.instructions);
// The damped period of 2 kg on 200 N/m at ζ = 0.05, and 4π²/a in theory, k(1 − ζ²).
const TD = (2 * Math.PI * Math.sqrt(2 / 200)) / Math.sqrt(1 - 0.05 ** 2);
const K_DAMPED = 200 * (1 - 0.05 ** 2);

async function runToEnd(page: Page, aim: Aim, settings: string) {
  await use(page, aim, T.run, `${LAB}/spring-run`, 'CHẠY');
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${LAB}/spring completed ${settings} `),
    { timeout: 60_000 },
  );
}

test('the spring swing in Vietnamese: period, decay, and T² against m', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ save, value }) => {
      if (localStorage.getItem('simlab.save.slot-1') === null) {
        localStorage.setItem('simlab.save.slot-1', save);
      }
      localStorage.setItem('simlab.settings.language', value);
    },
    { save: JSON.stringify(SAVE), value: 'vi' },
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Phase', 'playing');
  const aim = new Aim(page);
  await aim.sync();
  await approach(page, aim, T.instructions[0], AT_DESK.z);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);

  // 1. k 200 N/m, y₀ 0.02 m below rest, ζ 0.05; then 0.5, 1 and 2 kg, each run to its end.
  await dial(page, aim, T.dialStiffness, `${LAB}/dial-stiffness`, 'e', 3);
  await dial(page, aim, T.dialOffset, `${LAB}/dial-offset`, 'f', 2);
  await dial(page, aim, T.dialDamping, `${LAB}/dial-damping`, 'f', 1);
  await expectDebug(
    page,
    'Station',
    `${LAB}/spring configured mass=0.5 stiffness=200 resolution=0.001 offset=0.02 damping=0.05 `,
  );
  for (const mass of ['0.5', '1']) {
    await runToEnd(page, aim, `mass=${mass} stiffness=200`);
    await use(page, aim, T.reset, `${LAB}/spring-reset`, 'ĐẶT LẠI');
    await dial(page, aim, T.dialMass, `${LAB}/dial-mass`, 'e', 1);
  }
  await runToEnd(page, aim, 'mass=2 stiffness=200');

  // 2. The last run's swing, measured from its samples: T against T_d and T₀, peaks, decay.
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  const panel = await openResults(page, aim, T.monitor, `${LAB}/spring-monitor`);
  await expect(panel.locator('h3').filter({ hasText: 'Dao động, đo từ các mẫu' })).toBeVisible();
  const swing = (name: string) =>
    panel.locator(`table.oscillation-table tr[data-oscillation="${name}"] td`);
  await expect(swing('period')).toHaveText(/^[\d.]+ s qua \d+ dao động trọn vẹn$/);
  const measured = parseFloat((await swing('period').textContent()) ?? '');
  const damped = parseFloat((await swing('period-damped').textContent()) ?? '');
  const undamped = parseFloat((await swing('period-undamped').textContent()) ?? '');
  expect(Math.abs(damped / TD - 1)).toBeLessThan(1e-4); // the theory shown is T_d …
  expect(Math.abs(measured / TD - 1)).toBeLessThan(5e-3); // … which the samples give,
  expect(undamped).toBeLessThan(damped); // … not T₀
  await expect(swing('zeta')).toContainText('(đặt là 0.05)');
  const peaks = panel.locator('svg[data-oscillation="peaks"]');
  expect(await peaks.locator('circle.dot').count()).toBeGreaterThanOrEqual(3);
  await expect(peaks.locator('polyline[data-line="fit"]')).toHaveCount(1);
  await expect(peaks.locator('polyline[data-line="theory"]')).toHaveCount(1);
  await expect(panel).toContainText('Lý thuyết qua các đỉnh: |y₀|·e^(−ζω₀t)');
  await shot(page, 'oscillation-1-swing');

  // 3. T² against m over the three runs: one spring, one ζ; 4π²/a against k(1 − ζ²).
  await freeMouse(page);
  await panel.getByRole('button', { name: 'Phân tích các lần chạy: bảng và đường khớp' }).click();
  await panel.locator('select.analysis-which').selectOption('period');
  await expect(panel.locator('select.analysis-group option')).toHaveText([
    'k 200 N/m · ζ 0.05 (3 lần chạy)',
  ]);
  const fit = (name: string) => panel.locator(`table.analysis-fit tr[data-fit="${name}"] td`);
  await expect(fit('n')).toHaveText('3 trên 3');
  const k = parseFloat((await fit('derived').textContent()) ?? '');
  expect(Math.abs(k / K_DAMPED - 1)).toBeLessThan(1e-2);
  await expect(fit('derived-theory')).toHaveText('199.5 N/m');
  await expect(panel.locator('svg[data-analysis="period"] circle.dot')).toHaveCount(3);
  await expect(panel).toContainText('k(1 − ζ²)');
  await shot(page, 'oscillation-2-period-fit');

  // 4. A narrow window: still no sideways scroll of the page.
  await page.setViewportSize({ width: 430, height: 820 });
  // The canvas follows on the window's resize event, a moment later under software WebGL.
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
  const box = await panel.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 430).toBe(true);
  await shot(page, 'oscillation-3-narrow');
  expect(errors).toEqual([]);
});
