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
  shot,
  use,
  type Vec3,
  menuContinue,
} from './support';

// Phase 14A in the real app: the Hooke's law station in the Physics Lab's main room, found in the
// main menu's catalog, reached the way a returning player reaches it — Continue from a save of a
// player standing in the lab — and played with keyboard and mouse: read the board; a load beyond
// the elastic limit refused with its reason; 2 kg on the 100 N/m spring, held 0.1 m below rest;
// RUN lets the mass go — it swings about rest — STOP freezes it and RESET takes it back; a run to
// rest, then the 200 N/m spring; the swing measured on the monitor; both runs compared, one
// exported as CSV; the completed run marked in the catalog. No developer scene jump. Software
// WebGL: the motion is checked from the run's data, not from frame timing.

const LAB = 'physics-lab';
// Interaction targets (centres of the faces the player looks at) and where the player stands.
const T = {
  spring: [11.867, 1.45, -6.73],
  instructions: [10.717, 2.425, -7.03],
  dialMass: [11.617, 0.875, -5.9],
  dialStiffness: [11.817, 0.875, -5.9],
  dialOffset: [12.217, 0.875, -5.9],
  run: [12.667, 0.875, -5.9],
  stop: [12.917, 0.875, -5.9],
  reset: [13.167, 0.875, -5.9],
  monitor: [12.867, 1.775, -7.455],
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 12.417, z: -5.35 };
const AT_MONITOR = { x: 12.867, z: -5.35 };

// Hooke's law at rest, written out here: k·Δl = m·g, for 2 kg on the 100 and 200 N/m springs.
const WEIGHT = 2 * 9.81;
const REST_100 = WEIGHT / 100;
const REST_200 = WEIGHT / 200;

/** A player in the Physics Lab facing the Hooke's law board on the north wall. */
const SAVE = labSave([11.517, 0, -5.35], T.instructions); // before the board (overhead since Phase T-1a), nearer the spring than the air track

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${LAB}/spring ${pattern}`),
    { timeout },
  );
}

/** The extension the debug panel shows live for run `n` (NaN while it shows none). */
async function liveExtension(page: Page, n: number) {
  const text = (await page.locator('.debug-text').textContent()) ?? '';
  return Number(new RegExp(`spring#${n} t=[\\d.]+ extension=([\\d.]+)`).exec(text)?.[1] ?? NaN);
}

/** True once the values rose and then fell back by at least `by`: down, then up again. */
function bounced(xs: readonly number[], by: number) {
  let low = Infinity;
  let high = -Infinity;
  for (const x of xs) {
    low = Math.min(low, x);
    if (x - low >= by) high = Math.max(high, x);
    if (high - x >= by) return true;
  }
  return false;
}

test("hooke's law: let go, the mass bounces and rests; refusal, STOP, RESET, compare, CSV", async ({
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

  // 1. The catalog lists it under Dynamics, where its station stands, not yet run.
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const hooke = catalog.locator('.menu-catalog-item[data-experiment="hookes-law"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(hooke.locator('.menu-experiment')).toHaveText("Hooke's law");
  await expect(hooke.locator('.menu-place')).toHaveText('Played in Physics Laboratory');
  await expect(hooke.locator('.menu-run')).toHaveText('Not yet run to the end');
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await menuContinue(page);
  await expectDebug(page, 'Scene', LAB);
  await expectDebug(page, 'Phase', 'playing');
  const aim = new Aim(page);
  await aim.sync();
  await expectStation(
    page,
    'configured mass=0.5 stiffness=20 resolution=0.001 offset=0.1 damping=0.1 step 0/5',
  );
  await expect(page.locator('.hud-objective')).toContainText("Hooke's law");

  // 2. Read the board; at the desk, 2 kg on the 20 N/m spring is refused, with the reason.
  await use(page, aim, T.instructions, `${LAB}/spring-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText("Hooke's law — instructions");
  await expectStation(page, 'configured .* step 1/5');
  await approach(page, aim, T.instructions[0], AT_DESK.z);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await dial(page, aim, T.dialMass, `${LAB}/dial-mass`, 'e', 2);
  await expectStation(page, 'configured mass=2 stiffness=20 .* step 2/5');
  await use(page, aim, T.run, `${LAB}/spring-run`, 'RUN');
  await expect(page.locator('.hud-toast').last()).toContainText(
    'This load is beyond the elastic limit of the spring: let go, the mass could stretch it to 1.08 m (0.98 m at rest)',
  );
  await expectStation(page, 'configured mass=2 ');

  // 3. 2 kg on the 100 N/m spring, held 0.1 m below rest.
  await dial(page, aim, T.dialStiffness, `${LAB}/dial-stiffness`, 'e', 2);
  await expectStation(
    page,
    'configured mass=2 stiffness=100 resolution=0.001 offset=0.1 damping=0.1 step 2/5',
  );
  await aim.at(T.spring);
  await page.waitForTimeout(400);
  await shot(page, 'hooke-1-held');

  // 4. RUN lets it go. Read live off the debug panel: it moves, down and then back up.
  await use(page, aim, T.run, `${LAB}/spring-run`, 'RUN');
  const seen: number[] = [];
  await expect
    .poll(
      async () => {
        const x = await liveExtension(page, 1);
        if (Number.isFinite(x)) seen.push(x);
        return bounced(seen, 0.002);
      },
      { timeout: 20_000, intervals: [100] },
    )
    .toBe(true);
  await aim.at(T.spring);
  await shot(page, 'hooke-2-moving');

  // 5. STOP freezes it where it is (an incomplete run); RESET lifts it back, no run left.
  await use(page, aim, T.stop, `${LAB}/spring-stop`, 'STOP');
  await expectStation(page, 'stopped mass=2 stiffness=100 .* \\S+#1 t=');
  const frozen = await liveExtension(page, 1);
  await page.waitForTimeout(600);
  expect(await liveExtension(page, 1)).toBe(frozen);
  await use(page, aim, T.reset, `${LAB}/spring-reset`, 'RESET');
  await expectStation(page, 'configured mass=2 stiffness=100 .* damping=0.1 step'); // no run

  // 6. A run to rest: the run ends by itself once the mass has settled, Δl and k as Hooke says.
  await use(page, aim, T.run, `${LAB}/spring-run`, 'RUN');
  await expectStation(
    page,
    `completed mass=2 stiffness=100 .* extension=${REST_100.toFixed(3)} stiffness=[\\d.]+ step 3/5`,
    60_000,
  );
  const k100 = Number(
    /stiffness=([\d.]+) step/.exec(await page.locator('.debug-text').innerText())?.[1],
  );
  expect(Math.abs(k100 - 100)).toBeLessThan(0.1 * 1.01); // within 0.1 % of 100 N/m
  await aim.at(T.spring);
  await page.waitForTimeout(400);
  await shot(page, 'hooke-3-rest');

  // 7. The stiffer spring under the same 2 kg: RESET, k 200 N/m, RUN to rest.
  await use(page, aim, T.reset, `${LAB}/spring-reset`, 'RESET');
  await dial(page, aim, T.dialStiffness, `${LAB}/dial-stiffness`, 'e', 1);
  // At rest it stretches 0.098 m: a 0.1 m start would slacken the spring, so y₀ = 0.05 m.
  await dial(page, aim, T.dialOffset, `${LAB}/dial-offset`, 'f', 1);
  await use(page, aim, T.run, `${LAB}/spring-run`, 'RUN');
  await expectStation(
    page,
    `completed mass=2 stiffness=200 .* extension=${REST_200.toFixed(3)} stiffness=[\\d.]+ step`,
    60_000,
  );

  // 8. The results monitor: the weight exact, Δl and k at rest within 0.1 % of Hooke's law.
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  const panel = await openResults(page, aim, T.monitor, `${LAB}/spring-monitor`);
  await expect(panel.locator('h2')).toContainText("Hooke's law");
  await expect(panel.locator('h2')).toContainText('run 3 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('load').locator('.theory')).toHaveText('19.620 N');
  await expect(result('load').locator('.measured')).toHaveText('19.620 N');
  await expect(result('extension').locator('.theory')).toHaveText(`${REST_200.toFixed(3)} m`);
  await expect(result('extension').locator('.measured')).toHaveText(`${REST_200.toFixed(3)} m`);
  await expect(result('stiffness').locator('.theory')).toHaveText('200.000 N/m');
  const k200 = parseFloat((await result('stiffness').locator('.measured').textContent()) ?? '');
  expect(Math.abs(k200 - 200)).toBeLessThan(0.2 * 1.01); // within 0.1 % of 200 N/m
  await expect(
    panel.locator('table.results-reading[data-reading="extension"] td').first(),
  ).toHaveText(`${REST_200.toFixed(3)} m`); // the ruler, at d = 1 mm
  await expect(panel.locator('svg[data-graph="force-extension"]')).toContainText('F (N)');
  await expect(panel.locator('svg[data-graph="extension-time"]')).toBeVisible();
  await expect(panel).toContainText('m·x″ + c·x′ + k·x = m·g');
  // The swing, measured from the run's own samples, against the damped and undamped theory.
  const swing = (name: string) =>
    panel.locator(`table.oscillation-table tr[data-oscillation="${name}"] td`);
  await expect(swing('period')).toHaveText(/^[\d.]+ s over \d+ whole swings$/);
  await expect(swing('period-damped')).toHaveText(/^[\d.]+ s$/);
  await expect(swing('period-undamped')).toHaveText(/^[\d.]+ s$/);
  await expect(swing('decay')).toHaveText(/^[\d.]+ 1\/s$/);
  await expectStation(page, 'completed .* step 5/5');

  // 9. The history keeps all three runs; runs 2 and 3 compared: two springs, two slopes.
  const runs = panel.locator('li.results-run[data-run]');
  await expect(runs).toHaveCount(3);
  await expect(runs.nth(2)).toHaveAttribute('data-status', 'stopped');
  await expect(runs.nth(2)).toContainText('#1 · m 2 kg · k 100 N/m · d 0.001 m');
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 2' }).check();
  await panel.getByRole('checkbox', { name: 'Select run 3' }).check();
  await expect(panel.locator('h2')).toContainText('comparing runs #2, #3');
  await expect(panel.locator('svg[data-compare="force-extension"] polyline[data-run]')).toHaveCount(
    2,
  );
  await expect(panel.locator('.results-legend')).toContainText('#2 · k 100 N/m');
  await expect(panel.locator('.results-legend')).toContainText('#3 · k 200 N/m');
  await shot(page, 'hooke-4-compare');

  // 10. Run 2's CSV holds the motion: let go at y₀ below rest, up past rest, back, at rest.
  const csv = await exportRun(page, panel, 2);
  const { meta, header, rows } = readCsv(csv.text);
  const x = rows.map((r) => r[header.indexOf('extension_m')]!);
  const force = rows.map((r) => r[header.indexOf('force_N')]!);
  expect(x[0]).toBeCloseTo(REST_100 + 0.1, 9); // held at y₀ = 0.1 m below rest,
  const highest = Math.min(...x);
  expect(highest).toBeLessThan(REST_100 - 0.05); // let go, it rose well past rest,
  expect(Math.max(...x.slice(x.indexOf(highest)))).toBeGreaterThan(REST_100); // and came back,
  expect(meta.some((l) => l.startsWith('# Oscillation: period T = '))).toBe(true);
  expect(Math.abs(x.at(-1)! - REST_100)).toBeLessThanOrEqual(1e-3 * REST_100); // and rested
  rows.forEach((_, i) => expect(force[i]).toBeCloseTo(100 * x[i]!, 9)); // F = k·x in every row

  // 11. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(hooke.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
