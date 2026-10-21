declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { matingRun, testHardyWeinberg } from '../../src/biology/genetics/population';
import { rng } from '../../src/biology/genetics/stats';
import { apportion, drawScale } from '../../src/biology/view3d/sampling';
import { openLab } from './nav';

/**
 * The 3D habitat of "Định luật Hardy–Weinberg": the generation slider shows the model's run of
 * random mating (generation 0 = the learner's counts), the scene draws exactly the model's
 * figures, the panel's "Cho ngẫu phối 1 thế hệ" is generation 1, and a tap opens a card. Name
 * callouts and a close-up beside the gene pool; an empty population stays empty.
 * WebGL runs in software (SwiftShader), never on the GPU (see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Vec3 = [number, number, number];
interface HwState {
  generation: number;
  drawn: { AA: number; Aa: number; aa: number };
  beads: { A: number; a: number };
  per: number;
  perBead: number;
  figurePoint: Vec3 | null;
  poolPoint: Vec3;
  hatching: boolean;
}
interface Hook {
  lesson: string;
  frames(): number;
  state(): HwState | null;
  project(p: Vec3): [number, number] | null;
  callouts(): string[];
}

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
/** Pixels per world unit around a point (how close the camera is to it). */
async function scaleAt(page: Page, p: Vec3): Promise<number> {
  const a = await settled(page, [p[0] - 1, p[1], p[2]]);
  const b = await project(page, [p[0] + 1, p[1], p[2]]);
  return b ? Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 : 0;
}
/** Where a world point is on the page once the camera has stopped moving (it re-frames when the
 * chips or a card change size). */
async function settled(page: Page, p: Vec3): Promise<[number, number]> {
  let last: [number, number] | null = null;
  for (let k = 0; k < 40; k++) {
    const now = await project(page, p);
    if (now && last && Math.hypot(now[0] - last[0], now[1] - last[1]) < 0.5) return now;
    last = now;
    await page.waitForTimeout(250);
  }
  throw new Error('the camera never settled');
}

/** The lesson's defaults (store.ts) and the view's figure cap on the Medium tier. */
const START = { AA: 360, Aa: 480, aa: 160 };
const N = 1000;
/** `figureCap` of the Medium tier: LEGIBLE_FIGURES (binding.ts). */
const MEDIUM_CAP = 150;
const vi = (v: number, d = 6) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);

test('Hardy–Weinberg 3D: the habitat follows the model through the generations', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // A slow test machine may measure as "low" quality, where the lesson uses its 2D picture.
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Định luật Hardy–Weinberg', exact: true }).click();
  const view = page.locator('.bio3d[data-lesson="hardyWeinberg"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.frames() ?? 0,
      ),
    )
    .toBeGreaterThan(0);

  const chip = (g: string) => view.locator(`[data-genotype="${g}"] strong`);
  const player = view.locator('.bio3d__player');

  // Generation 0: the learner's counts, drawn one figure per 10 individuals (1 000 > 150).
  await expect(chip('AA')).toHaveText(vi(START.AA));
  const per = drawScale(N, MEDIUM_CAP);
  expect(per).toBe(10);
  await expect(view.locator('[data-chip="scale"]')).toContainText(`1 hình = ${vi(per)} cá thể`);
  let s = await state(page);
  expect(s?.generation).toBe(0);
  expect(s?.per).toBe(per);
  const [fAA, fAa, faa] = apportion([START.AA, START.Aa, START.aa], per);
  expect(s?.drawn).toEqual({ AA: fAA, Aa: fAa, aa: faa });

  // Names on the picture: a figure of each genotype, its antennae, the beads and the p : q ring;
  // the Tags button hides them.
  const NAMES = ['antennae', 'AA', 'Aa', 'aa', 'beads', 'dial'];
  await expect.poll(async () => (await callouts(page)).includes('antennae')).toBe(true);
  for (const id of await callouts(page)) expect(NAMES).toContain(id);
  const tags = view.getByRole('button', { name: 'Hiện tên các phần' });
  await tags.click();
  await expect.poll(() => callouts(page)).toEqual([]);
  await tags.click();
  await expect.poll(async () => (await callouts(page)).length).toBeGreaterThan(0);

  // "Cận cảnh cá thể": the camera glides nearer the figures beside the jar, and back.
  const far = await scaleAt(page, s?.poolPoint ?? [0, 0, 0]);
  await view.getByRole('radio', { name: 'Cận cảnh cá thể' }).click();
  await expect.poll(() => scaleAt(page, s?.poolPoint ?? [0, 0, 0])).toBeGreaterThan(far * 1.4);
  await view.getByRole('radio', { name: 'Toàn cảnh' }).click();
  await expect
    .poll(async () => Math.abs((await scaleAt(page, s?.poolPoint ?? [0, 0, 0])) / far - 1))
    .toBeLessThan(0.05);

  // Scrub to generation 3: the model's third round of random mating (one stream, seed 1).
  const run = matingRun(START, N, 3, rng(1));
  const g3 = run[3];
  if (!g3) throw new Error('no generation 3');
  await player.getByRole('slider', { name: 'Thế hệ' }).fill('3');
  await expect(player.locator('output')).toContainText(`Thế hệ 3/10 · N = ${vi(N)}`);
  await expect(chip('AA')).toHaveText(vi(g3.AA));
  await expect(chip('Aa')).toHaveText(vi(g3.Aa));
  await expect(chip('aa')).toHaveText(vi(g3.aa));
  const t3 = testHardyWeinberg(g3.AA, g3.Aa, g3.aa);
  await expect(view.locator('[data-chip="pq"]')).toContainText(`p = ${vi(t3.p, 4)}`);
  await expect.poll(async () => (await state(page))?.generation).toBe(3);
  s = await state(page);
  const [gAA, gAa, gaa] = apportion([g3.AA, g3.Aa, g3.aa], per);
  expect(s?.drawn).toEqual({ AA: gAA, Aa: gAa, aa: gaa });
  expect((s?.beads.A ?? 0) + (s?.beads.a ?? 0)).toBe(Math.round((2 * N) / (s?.perBead ?? 1)));

  // A tap on a figure opens its card with the model's count for that genotype (once the new
  // generation has hatched: its figures grow in while the picture is animated).
  await expect.poll(async () => (await state(page))?.hatching, { timeout: 30_000 }).toBe(false);
  const fp = s?.figurePoint;
  expect(fp).toBeTruthy();
  const at = await settled(page, fp as Vec3);
  await page.mouse.click(at[0], at[1]);
  const card = view.locator('.hw3d__card');
  await expect(card).toContainText('Cá thể kiểu gen');
  await expect(card).toContainText('Thế hệ 3:');
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect(card).toHaveCount(0);

  // The panel's "Cho ngẫu phối 1 thế hệ" (seed 1 → 2): the 3D shows generation 1 = that sample.
  await page.getByRole('button', { name: 'Cho ngẫu phối 1 thế hệ' }).click();
  await expect(player.locator('output')).toContainText('Thế hệ 1/10');
  const sample = matingRun(START, N, 1, rng(2))[1];
  if (!sample) throw new Error('no sample');
  await expect(chip('AA')).toHaveText(vi(sample.AA));
  await expect(
    page.getByText(`AA ${String(sample.AA)} · Aa ${String(sample.Aa)} · aa ${String(sample.aa)}`),
  ).toBeVisible();

  // A tap on the plinth: the gene pool's card (copies of A = 2·AA + Aa).
  s = await state(page);
  const pool = await settled(page, s?.poolPoint ?? [0, 0, 0]);
  await page.mouse.click(pool[0], pool[1] + 4);
  await expect(card).toContainText('Vốn gen — thế hệ 1');
  await expect(card).toContainText(vi(2 * sample.AA + sample.Aa));

  // The 3D/2D switch keeps the 2D page (chart and table).
  await view.getByRole('radio', { name: '2D', exact: true }).click();
  await expect(page.locator('.bio3d[data-lesson="hardyWeinberg"]')).toHaveCount(0);
  await expect(page.getByText('Kì vọng (H–W)')).toBeVisible();
  await page
    .locator('.shell__center')
    .getByRole('radio', { name: '3D', exact: true })
    .first()
    .click();
  await expect(page.locator('.bio3d[data-lesson="hardyWeinberg"] canvas')).toBeVisible();

  // No individuals: no p or q, nothing to mate, and every later generation stays empty.
  for (const k of ['AA', 'Aa', 'aa'])
    await page.getByLabel(`Số cá thể ${k}`, { exact: true }).fill('0');
  const v3 = page.locator('.bio3d[data-lesson="hardyWeinberg"]');
  await expect(v3.locator('[data-chip="pq"]')).toHaveText('p = — · q = —');
  await expect(v3.locator('[data-chip="empty"]')).toHaveText('Chưa có cá thể nào');
  await expect(page.getByRole('button', { name: 'Cho ngẫu phối 1 thế hệ' })).toBeDisabled();
  await v3.locator('.bio3d__player').getByRole('slider', { name: 'Thế hệ' }).fill('3');
  await expect(v3.locator('.bio3d__player output')).toContainText('Thế hệ 3/10 · N = 0');
  await expect.poll(async () => (await state(page))?.generation).toBe(3);
  expect((await state(page))?.drawn).toEqual({ AA: 0, Aa: 0, aa: 0 });
  expect((await state(page))?.beads).toEqual({ A: 0, a: 0 });
  await expect(v3.locator('[data-chip="pq"]')).toHaveText('p = — · q = —');
  expect(errors).toEqual([]);
});
