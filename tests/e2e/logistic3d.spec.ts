declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { logistic, logisticInflection } from '../../src/biology/ecology/ecology';
import { drawScale } from '../../src/biology/view3d/sampling';
import { openLab } from './nav';

/**
 * The 3D habitat of "Tăng trưởng logistic": the time slider scrubs the exact solution N(t), the
 * scene draws round(N(t) / per) animals, fills the column to N(t) and grazes the clover by N/K,
 * "Tới t*" goes to the inflection, a tap opens a card with the model's values, and with N₀ > K
 * the population falls towards K. WebGL runs in software (SwiftShader), never on the GPU (see
 * mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Vec3 = [number, number, number];
interface LogiState {
  t: number;
  N: number;
  drawn: number;
  per: number;
  slots: number;
  kSlots: number;
  fill: number;
  column: number;
  arrow: number;
  food: { lush: number; grazed: number };
  figurePoint: Vec3 | null;
  gaugePoint: Vec3;
  settling: boolean;
}
interface Hook {
  frames(): number;
  moving(): boolean;
  state(): LogiState | null;
  project(p: Vec3): [number, number] | null;
  callouts(): string[];
}
const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.frames() ?? 0);
const state = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.state() ?? null,
  );
const project = (page: Page, p: Vec3) =>
  page.evaluate(
    (q) => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.project(q) ?? null,
    p,
  );
const callouts = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.callouts() ?? [],
  );

/**
 * Where a world point is on the page once the camera has stopped: no framing glide running and
 * two reads in a row agree. The glide moves the camera only when a frame is drawn; with software
 * WebGL on the busy CI runner a frame can take longer than the 250 ms between reads, so two
 * equal reads alone could be taken mid-glide (a tap aimed where the target no longer was, a
 * scale measured before the camera had pulled back).
 */
async function settled(page: Page, p: Vec3): Promise<[number, number]> {
  let last: [number, number] | null = null;
  for (let k = 0; k < 40; k++) {
    const now = await page.evaluate((q) => {
      const h = (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d;
      return h && !h.moving() ? h.project(q) : null;
    }, p);
    if (now && last && Math.hypot(now[0] - last[0], now[1] - last[1]) < 0.5) return now;
    last = now;
    await page.waitForTimeout(250);
  }
  throw new Error('the camera never settled');
}

/** Pixels per world unit around a point (how close the camera is to it). */
async function scaleAt(page: Page, p: Vec3): Promise<number> {
  const a = await settled(page, [p[0] - 1, p[1], p[2]]);
  const b = await project(page, [p[0] + 1, p[1], p[2]]);
  return b ? Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 : 0;
}

/** The lesson's defaults (store.ts), the Medium tier's figure cap (binding.ts) and its clover. */
const LESSON = { N0: 10, r: 0.5, K: 1000, tEnd: 30 };
const MEDIUM_CAP = 200;
const MEDIUM_FOOD = 28;
const vi = (v: number, d: number) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);
const N = (t: number, n0 = LESSON.N0) => logistic(n0, LESSON.r, LESSON.K, t);

test('logistic growth 3D: the habitat follows N(t) of the exact solution', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Tăng trưởng logistic', exact: true }).click();
  const view = page.locator('.bio3d[data-lesson="logistic"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => frames(page), { timeout: 15_000 }).toBeGreaterThan(0);

  // One figure per 5 individuals: max(K, the run's peak N(30) ≈ 999,5) as at most 200 figures.
  const per = drawScale(Math.max(LESSON.K, N(LESSON.tEnd)), MEDIUM_CAP);
  expect(per).toBe(5);
  await expect(view.locator('[data-chip="scale"]')).toHaveText(
    `1 hình = ${vi(per, 6)} cá thể (làm tròn)`,
  );

  // Scrub to t = 12 (the slider stops the playback): the model's N(12) everywhere.
  const player = view.locator('.bio3d__player');
  const slider = player.getByRole('slider', { name: 'Thời gian t' });
  await slider.fill('12');
  await expect(player.locator('output')).toHaveText(`t = 12 · N = ${vi(N(12), 4)}`);
  await expect.poll(async () => (await state(page))?.t).toBe(12);
  let s = await state(page);
  expect(s?.N).toBeCloseTo(N(12), 9);
  expect(s?.drawn).toBe(Math.round(N(12) / per));
  expect(s?.per).toBe(per);
  expect(s?.kSlots).toBe(LESSON.K / per);
  // The column is filled to N / top, top = 1,08 · max(K, peak).
  const top = 1.08 * Math.max(LESSON.K, N(LESSON.tEnd));
  expect((s?.fill ?? 0) / (s?.column ?? 1)).toBeCloseTo(N(12) / top, 6);
  // The clover grazed in proportion N/K.
  expect(s?.food.grazed).toBe(Math.round(MEDIUM_FOOD * Math.min(1, N(12) / LESSON.K)));
  expect((s?.food.grazed ?? 0) + (s?.food.lush ?? 0)).toBe(MEDIUM_FOOD);

  // "Tới t*": the inflection N = K/2, where the growth arrow is longest (dN/dt = rK/4).
  const tStar = logisticInflection(LESSON.N0, LESSON.r, LESSON.K);
  await player.getByRole('button', { name: /Tới t\*/ }).click();
  await expect(player.locator('output')).toHaveText(`t = ${vi(tStar, 3)} · N = ${vi(500, 4)}`);
  await expect.poll(async () => (await state(page))?.drawn).toBe(Math.round(500 / per));
  s = await state(page);
  expect(s?.arrow).toBeCloseTo(0.34 * (s?.column ?? 0), 6);

  // "Cận cảnh đàn": the camera moves in on the crowd (about 2.5×), and back.
  await expect.poll(async () => (await state(page))?.settling, { timeout: 30_000 }).toBe(false);
  const fp = s?.figurePoint;
  expect(fp).toBeTruthy();
  const far = await scaleAt(page, fp as Vec3);
  const overview = player.getByRole('radio', { name: 'Toàn cảnh' });
  const herd = player.getByRole('radio', { name: 'Cận cảnh đàn' });
  await expect(overview).toBeChecked();
  await herd.click();
  await expect(herd).toBeChecked();
  await expect.poll(() => scaleAt(page, fp as Vec3)).toBeGreaterThan(far * 1.8);
  await overview.click();
  await expect
    .poll(async () => Math.abs((await scaleAt(page, fp as Vec3)) / far - 1))
    .toBeLessThan(0.05);

  // A tap on an animal opens its card with the moment's numbers and moves in on it; neither
  // framing is checked while the camera frames the pick.
  const at = await settled(page, fp as Vec3);
  await page.mouse.click(at[0], at[1]);
  const card = view.locator('.logi3d__card');
  await expect(card).toContainText('Một cá thể của quần thể');
  await expect(card).toContainText(`đại diện cho ${vi(per, 6)} cá thể`);
  await expect(card).toContainText(`N = ${vi(500, 4)} cá thể = ${vi(50, 3)} % sức chứa K`);
  await expect(overview).not.toBeChecked();
  await expect(herd).not.toBeChecked();
  await expect.poll(() => scaleAt(page, fp as Vec3)).toBeGreaterThan(far * 1.8);
  // The column's moment label waits while the animal's card is open.
  const moment = view.locator('.logi3d__moment');
  await expect(moment).toBeHidden();
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect(card).toHaveCount(0);
  await expect(overview).toBeChecked();

  // A tap on the column: its card, the column nearer beside it, its label clear of the card.
  const gp = await settled(page, s?.gaugePoint ?? [0, 0, 0]);
  const gaugeFar = await scaleAt(page, s?.gaugePoint ?? [0, 0, 0]);
  await page.mouse.click(gp[0], gp[1] + 12);
  await expect(card).toContainText('Cột N(t)');
  await expect(card).toContainText(`rK/4 = ${vi(125, 3)}`);
  await expect(card).toContainText(`so với rK/4 = ${vi(125, 3)}`);
  // The whole column with its title and labels beside the card: nearer, never farther.
  await expect
    .poll(() => scaleAt(page, s?.gaugePoint ?? [0, 0, 0]))
    .toBeGreaterThan(gaugeFar * 1.15);
  await expect(moment).toBeVisible();
  const mb = await moment.boundingBox();
  const cb = await card.boundingBox();
  expect(mb).not.toBeNull();
  expect((mb?.x ?? Infinity) + (mb?.width ?? 0)).toBeLessThanOrEqual(cb?.x ?? 0);
  // Either framing closes the card.
  await overview.click();
  await expect(card).toHaveCount(0);

  // Names on the picture; the Tags button hides them.
  await expect.poll(async () => (await callouts(page)).length).toBeGreaterThan(0);
  for (const id of await callouts(page)) expect(['figure', 'fence', 'food']).toContain(id);
  const tags = view.getByRole('button', { name: 'Hiện tên các phần' });
  await tags.click();
  await expect.poll(() => callouts(page)).toEqual([]);
  await tags.click();

  // N₀ = 1 500 > K: the population falls towards K; the figures above K stand outside the fence.
  const n0 = page.locator('label', { hasText: /Số cá thể ban đầu/ }).locator('input[type="range"]');
  await n0.fill('1500');
  const perHigh = drawScale(Math.max(1500, LESSON.K), MEDIUM_CAP);
  await expect(view.locator('[data-chip="scale"]')).toHaveText(
    `1 hình = ${vi(perHigh, 6)} cá thể (làm tròn)`,
  );
  await slider.fill('0');
  await expect(player.locator('output')).toHaveText(`t = 0 · N = ${vi(1500, 4)}`);
  await expect.poll(async () => (await state(page))?.drawn).toBe(1500 / perHigh);
  s = await state(page);
  expect(s?.kSlots).toBe(LESSON.K / perHigh);
  expect(s?.arrow).toBeLessThan(0);
  await slider.fill('6');
  await expect(player.locator('output')).toHaveText(`t = 6 · N = ${vi(N(6, 1500), 4)}`);
  await expect.poll(async () => (await state(page))?.drawn).toBe(Math.round(N(6, 1500) / perHigh));
  expect(N(6, 1500)).toBeLessThan(1500);

  expect(errors).toEqual([]);
});
