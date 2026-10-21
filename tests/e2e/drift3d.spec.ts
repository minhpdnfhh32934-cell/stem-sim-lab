declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { driftRuns } from '../../src/biology/genetics/population';
import { apportion } from '../../src/biology/view3d/sampling';
import { openLab } from './nav';

/**
 * The 3D archipelago of "Phiêu bạt di truyền": one island per run of the lesson's own model (the
 * same seed as the 2D chart). Scrubbing the generation slider moves every island to that
 * generation of its Wright–Fisher run: the chips, the bead counts, the p : q bands, the fates and
 * the mean heterozygosity are the model's. A close-up frames one island; a tap opens a card;
 * "Chạy lại" draws new runs; the 2D chart stays one switch away.
 * WebGL runs in software (SwiftShader), never on the GPU (see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

type Vec3 = [number, number, number];
interface DriftState {
  generation: number;
  islands: number;
  figures: number;
  per: number;
  beadsA: number[];
  tips: { A: number; a: number };
  bands: number[];
  fates: ('fixed' | 'lost' | 'polymorphic')[];
  tags: string[];
  figurePoint: Vec3 | null;
  islandPoints: Vec3[];
  bandPoints: Vec3[];
}
interface Hook {
  frames(): number;
  state(): DriftState | null;
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
/** Where a world point is on the page once the camera has stopped moving. */
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
/** Pixels per world unit around a point (how close the camera is to it). */
async function scaleAt(page: Page, p: Vec3): Promise<number> {
  const a = await settled(page, [p[0] - 1, p[1], p[2]]);
  const b = await project(page, [p[0] + 1, p[1], p[2]]);
  return b ? Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 : 0;
}

/** The lesson's defaults (`useDrift`) and the Medium tier's figures per island at 20 runs. */
const LESSON = { N: 50, p0: 0.5, generations: 150, runs: 20, seed: 1 };
const PER = 5;
const vi = (v: number, d = 6) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);

/** What the model says about generation g of the runs. */
function expected(runs: number[][], g: number) {
  const p = runs.map((r) => r[g] ?? 0);
  const twoN = 2 * LESSON.N;
  return {
    p,
    fixed: p.filter((x) => x >= 1).length,
    lost: p.filter((x) => x <= 0).length,
    meanH: p.reduce((s, x) => s + 2 * x * (1 - x), 0) / p.length,
    beadsA: p.map((x) => {
      const A = Math.round(x * twoN);
      return apportion([A, twoN - A], PER)[0] ?? -1;
    }),
  };
}

test('genetic drift 3D: the archipelago follows the model’s runs through the generations', async ({
  page,
}) => {
  test.setTimeout(150_000);
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
  await page.getByRole('button', { name: 'Phiêu bạt di truyền', exact: true }).click();
  const view = page.locator('.bio3d[data-lesson="drift"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => frames(page), { timeout: 15_000 }).toBeGreaterThan(0);

  const player = view.locator('.bio3d__player');
  const slider = player.getByRole('slider', { name: 'Thế hệ' });
  const fates = view.locator('[data-chip="fates"]');
  let runs = driftRuns(LESSON);

  // One island per run, 10 figures of 5 individuals each (N = 50), the scale on its chip.
  await expect(view.locator('[data-chip="scale"]')).toContainText(
    '1 hình = 5 cá thể · 1 hạt = 5 bản sao gen (làm tròn)',
  );
  await expect(view.locator('[data-chip="theory"]')).toContainText('p₀ = 0,5');

  // Scrub to generations 40 and 150: every number is the model's at that generation.
  for (const g of [40, 150]) {
    await slider.fill(String(g));
    const e = expected(runs, g);
    await expect(player.locator('output')).toHaveText(
      `Thế hệ ${String(g)}/150 · H̄ = ${vi(e.meanH, 3)}`,
    );
    await expect(fates.locator('[data-fate="fixed"]')).toHaveText(`A cố định: ${String(e.fixed)}`);
    await expect(fates.locator('[data-fate="lost"]')).toHaveText(`A mất: ${String(e.lost)}`);
    await expect(fates.locator('[data-fate="both"]')).toHaveText(
      `còn cả hai: ${String(LESSON.runs - e.fixed - e.lost)}`,
    );
    await expect.poll(async () => (await state(page))?.generation).toBe(g);
    const s = await state(page);
    expect(s?.islands).toBe(LESSON.runs);
    expect(s?.figures).toBe(LESSON.N / PER);
    expect(s?.per).toBe(PER);
    expect(s?.bands).toEqual(e.p);
    expect(s?.beadsA).toEqual(e.beadsA);
    expect((s?.tips.A ?? 0) + (s?.tips.a ?? 0)).toBe(2 * (LESSON.N / PER) * LESSON.runs);
    expect(s?.fates.filter((f) => f === 'fixed')).toHaveLength(e.fixed);
    expect(s?.fates.filter((f) => f === 'lost')).toHaveLength(e.lost);
    // A fixed island's tag shows the allele left (■ = A).
    const fixed = s?.fates.indexOf('fixed') ?? -1;
    if (fixed >= 0) expect(s?.tags[fixed]).toBe(`${String(fixed + 1)} ■`);
  }
  // "Cận cảnh một đảo": the camera glides nearer one island, and back.
  let s = await state(page);
  const front = s?.islandPoints[s.islandPoints.length - 1] ?? [0, 0, 0];
  const far = await scaleAt(page, front);
  await player.getByRole('radio', { name: 'Cận cảnh một đảo' }).click();
  await expect.poll(() => scaleAt(page, s?.islandPoints[18] ?? front)).toBeGreaterThan(far * 1.5);
  await player.getByRole('radio', { name: 'Toàn cảnh' }).click();
  await expect
    .poll(async () => Math.abs((await scaleAt(page, front)) / far - 1))
    .toBeLessThan(0.05);

  // A tap on island 1's first figure: its card, with the island's copies at generation 150 and
  // the drawing scale (one bead = 5 copies); island 1 comes close up beside the card.
  s = await state(page);
  const island1 = s?.islandPoints[0] ?? front;
  const island1Far = await scaleAt(page, island1);
  const at = await settled(page, s?.figurePoint as Vec3);
  await page.mouse.click(at[0], at[1]);
  const card = view.locator('.drift3d__card');
  await expect(card).toContainText('Cá thể trên đảo 1');
  await expect(card).toContainText('Hai hạt trên râu (mỗi hạt = 5 bản sao gen)');
  await expect(card).not.toContainText('là hai bản sao gen');
  const A1 = Math.round((runs[0]?.[150] ?? 0) * 2 * LESSON.N);
  await expect(card).toContainText(
    `A có ${vi(A1)}, a có ${vi(2 * LESSON.N - A1)} trong 100 bản sao`,
  );
  await expect(player.getByRole('radio', { name: 'Cận cảnh một đảo' })).toBeChecked();
  await expect.poll(() => scaleAt(page, island1)).toBeGreaterThan(island1Far * 1.5);
  await card.getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect(card).toHaveCount(0);
  // Back to the whole archipelago (the view the learner had chosen).
  await expect(player.getByRole('radio', { name: 'Toàn cảnh' })).toBeChecked();
  await expect
    .poll(async () => Math.abs((await scaleAt(page, front)) / far - 1))
    .toBeLessThan(0.05);

  // A tap on the front of island 3's band: the island's card.
  s = await state(page);
  const band = await settled(page, s?.bandPoints[2] as Vec3);
  await page.mouse.click(band[0], band[1]);
  await expect(card).toContainText('Đảo 3 — thế hệ 150');
  await expect(card).toContainText('p₀ = 0,5');
  // "Toàn cảnh" closes the card (the whole archipelago has no room beside it).
  await player.getByRole('radio', { name: 'Toàn cảnh' }).click();
  await expect(card).toHaveCount(0);

  // "Chạy lại" draws new runs (seed 2): the islands follow them.
  await view.getByRole('button', { name: 'Chạy lại' }).click();
  runs = driftRuns({ ...LESSON, seed: 2 });
  await slider.fill('60');
  const e60 = expected(runs, 60);
  await expect(player.locator('output')).toHaveText(`Thế hệ 60/150 · H̄ = ${vi(e60.meanH, 3)}`);
  await expect.poll(async () => (await state(page))?.bands).toEqual(e60.p);
  expect((await state(page))?.beadsA).toEqual(e60.beadsA);

  // The 3D/2D switch keeps the 2D chart of the same runs.
  await view.getByRole('radio', { name: '2D', exact: true }).click();
  await expect(page.locator('.bio3d[data-lesson="drift"]')).toHaveCount(0);
  await expect(
    page.locator('canvas[aria-label="Phiêu bạt di truyền (Wright–Fisher)"]'),
  ).toBeVisible();
  await page
    .locator('.shell__center')
    .getByRole('radio', { name: '3D', exact: true })
    .first()
    .click();
  await expect(page.locator('.bio3d[data-lesson="drift"] canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
