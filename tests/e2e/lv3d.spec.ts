declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { lotkaVolterra } from '../../src/biology/ecology/ecology';
import { drawScale } from '../../src/biology/view3d/sampling';
import { openLab } from './nav';

/**
 * The 3D habitat of "Con mồi – vật ăn thịt (Lotka–Volterra)": the time slider steps through the
 * computed trajectory, the scene draws round(x/k) prey and round(y/k) predators of that sample,
 * fills the two columns to x and y on one scale and puts the board's bead at (x, y); a tap opens
 * a card with the model's values. WebGL runs in software (SwiftShader), never on the GPU (see
 * mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Vec3 = [number, number, number];
interface LvState {
  k: number;
  t: number;
  x: number;
  y: number;
  drawn: { prey: number; predators: number };
  per: number;
  fill: { prey: number; predators: number };
  column: number;
  bead: [number, number];
  preyPoint: Vec3 | null;
  predatorPoint: Vec3 | null;
  boardPoint: Vec3;
  settling: boolean;
}
interface Hook {
  frames(): number;
  moving(): boolean;
  state(): LvState | null;
  project(p: Vec3): [number, number] | null;
  callouts(): string[];
}
const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.frames() ?? 0);
const state = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.state() ?? null,
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

/** The lesson's defaults (store.ts), its 800 computed steps (data.ts) and the Medium cap. */
const P = { alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 };
const MEDIUM_CAP = 200;
const vi = (v: number, d: number) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);

test('predator–prey 3D: the habitat follows the computed trajectory', async ({ page }) => {
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
  await page
    .getByRole('button', { name: 'Con mồi – vật ăn thịt (Lotka–Volterra)', exact: true })
    .click();
  const view = page.locator('.bio3d[data-lesson="lotkaVolterra"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => frames(page), { timeout: 15_000 }).toBeGreaterThan(0);

  // The model the page computes: the same function, inputs and samples.
  const traj = lotkaVolterra(P, 10, 5, 30, 800);
  const per = drawScale(Math.max(...traj.x) + Math.max(...traj.y), MEDIUM_CAP);
  expect(per).toBe(1);
  await expect(view.locator('[data-chip="scale"]')).toHaveText('1 hình = 1 cá thể');

  // Scrub to t = 12 (sample 320; the slider stops the playback): the sample's x and y everywhere.
  const player = view.locator('.bio3d__player');
  const slider = player.getByRole('slider', { name: 'Thời gian t' });
  for (const [t, k] of [
    [12, 320],
    [20.25, 540],
  ] as const) {
    await slider.fill(String(t));
    const x = traj.x[k] ?? 0;
    const y = traj.y[k] ?? 0;
    await expect(player.locator('output')).toHaveText(
      `t = ${vi(t, 3)} · x = ${vi(x, 4)} · y = ${vi(y, 4)}`,
    );
    await expect.poll(async () => (await state(page))?.k).toBe(k);
    const s = await state(page);
    expect(s?.t).toBe(t);
    // The page and Node may differ in the last bits of Math.exp: values, not identities.
    expect(s?.x).toBeCloseTo(x, 9);
    expect(s?.y).toBeCloseTo(y, 9);
    expect(s?.drawn).toEqual({ prey: Math.round(x / per), predators: Math.round(y / per) });
    // Both columns on one scale: top = 1.08 · max(peaks, x* = γ/δ, y* = α/β).
    const top =
      1.08 *
      Math.max(Math.max(...traj.x), Math.max(...traj.y), P.gamma / P.delta, P.alpha / P.beta);
    expect((s?.fill.prey ?? 0) / (s?.column ?? 1)).toBeCloseTo(x / top, 6);
    expect((s?.fill.predators ?? 0) / (s?.column ?? 1)).toBeCloseTo(y / top, 6);
    // The board's bead on the 2D phase plot's axes.
    expect(s?.bead[0]).toBeCloseTo(x / (1.1 * Math.max(Math.max(...traj.x), 20)), 6);
    expect(s?.bead[1]).toBeCloseTo(y / (1.1 * Math.max(Math.max(...traj.y), 10)), 6);
  }

  // A tap on a prey animal opens its card with the moment's numbers.
  await expect.poll(async () => (await state(page))?.settling, { timeout: 30_000 }).toBe(false);
  let s = await state(page);
  const pp = s?.preyPoint;
  expect(pp).toBeTruthy();
  const at = await settled(page, pp as Vec3);
  await page.mouse.click(at[0], at[1]);
  const card = view.locator('.lv3d__card');
  await expect(card).toContainText(/Một (con mồi|vật ăn thịt)/);
  const x = traj.x[540] ?? 0;
  const y = traj.y[540] ?? 0;
  await expect(card).toContainText(`x = ${vi(x, 4)} con mồi, y = ${vi(y, 4)} vật ăn thịt`);
  const overview = player.getByRole('radio', { name: 'Toàn cảnh' });
  await expect(overview).not.toBeChecked();
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect(card).toHaveCount(0);
  await expect(overview).toBeChecked();

  // A tap on the board: the phase plane's card with the equilibrium (γ/δ; α/β) = (20; 10).
  s = await state(page);
  const bp = await settled(page, s?.boardPoint ?? [0, 0, 0]);
  await page.mouse.click(bp[0] + 30, bp[1] + 20);
  await expect(card).toContainText('Mặt phẳng pha');
  await expect(card).toContainText(`= (${vi(20, 4)}; ${vi(10, 4)})`);
  await overview.click();
  await expect(card).toHaveCount(0);

  // Names on the picture; the Tags button hides them.
  await expect.poll(async () => (await callouts(page)).length).toBeGreaterThan(0);
  for (const id of await callouts(page)) expect(['prey', 'predator', 'clover']).toContain(id);
  const tags = view.getByRole('button', { name: 'Hiện tên các phần' });
  await tags.click();
  await expect.poll(() => callouts(page)).toEqual([]);
  await tags.click();

  // New inputs rebuild the habitat from the new trajectory (γ = 1: x* = γ/δ changes).
  const gamma = page
    .locator('label', { hasText: /Tốc độ chết của vật ăn thịt/ })
    .locator('input[type="range"]');
  await gamma.fill('1');
  const t2 = lotkaVolterra({ ...P, gamma: 1 }, 10, 5, 30, 800);
  await slider.fill('12');
  const x2 = t2.x[320] ?? 0;
  const y2 = t2.y[320] ?? 0;
  await expect(player.locator('output')).toHaveText(`t = 12 · x = ${vi(x2, 4)} · y = ${vi(y2, 4)}`);
  const per2 = drawScale(Math.max(...t2.x) + Math.max(...t2.y), MEDIUM_CAP);
  await expect
    .poll(async () => (await state(page))?.drawn)
    .toEqual({ prey: Math.round(x2 / per2), predators: Math.round(y2 / per2) });

  expect(errors).toEqual([]);
});
