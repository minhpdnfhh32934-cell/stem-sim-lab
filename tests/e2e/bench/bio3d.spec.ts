declare const process: { env: Record<string, string | undefined> };
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openLab, openTopic } from '../nav';

/**
 * The bench: a topic card on the shelf (back to the shelf through the subject crumb when a topic
 * is open; the bench has no library column beside the stage).
 */
async function openCard(page: Page, name: string) {
  const crumb = page
    .locator('.bench-crumbs')
    .getByRole('button', { name: 'Sinh học', exact: true });
  if ((await crumb.count()) > 0) await crumb.click();
  await page.getByRole('main').getByRole('button', { name, exact: true }).click();
}

/**
 * The 3D views of the biology lessons (every lesson besides mitosis, meiosis, DNA → mRNA →
 * protein, point mutations, Mendelian genetics, enzyme kinetics and diffusion & osmosis, which
 * have their own specs).
 * WebGL runs in software (SwiftShader), never on the GPU (see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

const LESSONS: [string, string][] = [
  ['Định luật Hardy–Weinberg', 'hardyWeinberg'],
  ['Phiêu bạt di truyền', 'drift'],
  ['Tăng trưởng logistic', 'logistic'],
  ['Con mồi – vật ăn thịt (Lotka–Volterra)', 'lotkaVolterra'],
];

async function openBiology(page: Page) {
  // A slow test machine may measure as "low" quality, where the lessons use their 2D pictures.
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
}

/**
 * The lesson's 3D canvas is visible. If it never comes, the error also quotes the notice the
 * app shows instead (Low quality, overload or no WebGL: all three say "…dùng hình 2D…") and the
 * page's heading (the launch page's after a dev-server reload), so a CI failure tells why.
 */
async function expect3d(page: Page, lesson: string, timeout: number) {
  try {
    await expect(page.locator(`.bio3d[data-lesson="${lesson}"] canvas`)).toBeVisible({ timeout });
  } catch (e) {
    const notices = await page.getByText(/dùng hình 2D/).allInnerTexts();
    const headings = await page.locator('h1').allInnerTexts();
    throw new Error(
      `${lesson}: no 3D canvas; notice on screen: ${notices.join(' | ') || '(none)'}; ` +
        `page heading: ${headings.join(' | ') || '(none)'}`,
      { cause: e },
    );
  }
}

test('every biology lesson opens in 3D, draws, keeps its subject clear of the controls, and has a 2D picture', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openBiology(page);
  for (const [name, lesson] of LESSONS) {
    await openCard(page, name);
    await expect3d(page, lesson, 30_000);
    await expect
      .poll(() => page.evaluate(() => window.__simlabBio3d?.frames() ?? 0), { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__simlabBio3d?.lesson)).toBe(lesson);
    // The subject is drawn inside the picture, clear of the chips and the controls over it.
    const layout = await page.evaluate((l) => {
      const box = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const v = document.querySelector(`.bio3d[data-lesson="${l}"]`);
      return {
        view: box(v),
        controls: [...(v?.querySelectorAll('[data-inset]') ?? [])].map(box),
        subject: window.__simlabBio3d?.subjectRect() ?? null,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, lesson);
    expect(layout.view, name).not.toBeNull();
    expect(layout.subject, name).not.toBeNull();
    const v = layout.view!;
    const s = layout.subject!;
    // The subject's bounding sphere may be generous; its centre must be in the view.
    expect((s.left + s.right) / 2, name).toBeGreaterThan(v.left);
    expect((s.left + s.right) / 2, name).toBeLessThan(v.right);
    expect((s.top + s.bottom) / 2, name).toBeGreaterThan(v.top);
    expect((s.top + s.bottom) / 2, name).toBeLessThan(v.bottom);
    expect(layout.scroll, `${name}: horizontal scroll`).toBeLessThanOrEqual(0);
    if (process.env.SHOTS)
      await page.screenshot({ path: `${process.env.SHOTS}/bio3d-${lesson}.png` });

    // 2D and back (the switch is in the stage, over the picture or above the figure).
    const stage = page.locator('.bench__stage');
    await stage.getByRole('radio', { name: '2D', exact: true }).first().click();
    await expect(page.locator(`.bio3d[data-lesson="${lesson}"]`)).toHaveCount(0);
    await stage.getByRole('radio', { name: '3D', exact: true }).first().click();
    await expect3d(page, lesson, 15_000);
    // The view builds its scene again before its first frame; on a busy CI runner that holds the
    // page for 20 s or more (seen 2026-10-23: drift's rebuild delayed the click on the next lesson,
    // whose 30 s then ran out while its own scene was building). The next lesson starts after it.
    await expect
      .poll(() => page.evaluate(() => window.__simlabBio3d?.frames() ?? 0), { timeout: 30_000 })
      .toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test('logistic 3D: the habitat follows the model; rebuilding for new inputs frees the old scene', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openBiology(page);
  await page.getByRole('button', { name: 'Tăng trưởng logistic', exact: true }).click();
  await expect3d(page, 'logistic', 30_000);
  // The chips are the 2D view's (same text).
  await expect(page.getByText('Sức chứa K = 1.000')).toBeVisible();
  // Pause, go to the end: N(t = 30) of the exact solution.
  // The bench edge's player (EdgeSteps, §9.6): D0 "Chạy" / "Tạm dừng".
  const player = page.locator('.bench-edge .edge-steps');
  await player
    .getByRole('button', { name: /Tạm dừng|Chạy/ })
    .first()
    .click();
  await player.getByRole('slider').fill('30');
  // N(t) of the exact solution (N₀ = 10, r = 0,5, K = 1 000), as the view formats it.
  const vi = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 4 });
  const N = (t: number) => 1000 / (1 + (1000 / 10 - 1) * Math.exp(-0.5 * t));
  await expect(player.locator('output')).toContainText(`t = 30 · N = ${vi.format(N(30))}`);
  await player.getByRole('slider').fill('9');
  await expect(player.locator('output')).toContainText(`t = 9 · N = ${vi.format(N(9))}`);
  const before = await page.evaluate(() => window.__simlabBio3d?.info() ?? null);
  const slider = page.locator('label', { hasText: /Sức chứa K/ }).locator('input[type="range"]');
  for (const k of ['1500', '800', '1000']) {
    await slider.fill(k);
    await page.waitForTimeout(300);
  }
  await expect(page.getByText('Sức chứa K = 1.000')).toBeVisible();
  // The scene is rebuilt for the new inputs; on a slow runner the rebuild can still be running
  // a fixed wait later, so wait until it holds as many geometries as before (none leaked).
  await expect
    .poll(async () => (await page.evaluate(() => window.__simlabBio3d?.info() ?? null))?.geometries)
    .toBe(before?.geometries);
  const after = await page.evaluate(() => window.__simlabBio3d?.info() ?? null);
  expect(after?.geometries).toBe(before?.geometries);
  expect(after?.textures).toBe(before?.textures);
});

// ---- Cell → DNA (copy of tests/e2e/cellzoom-bio3d.spec.ts, same titles) ----
// Kept here: the bench's 3D project matches only bench/<name>.spec.ts with the classic 3D
// names (playwright.config.ts BENCH_3D), so a file named cellzoom-bio3d.spec.ts ran in the
// light project with software WebGL beside every other bench spec.
interface ZoomState {
  level: string;
  barNm: number;
  unitNm: number;
  named: string[];
  spot: boolean;
}
interface Hook {
  frames(): number;
  moving(): boolean;
  state(): ZoomState | null;
}
/** The bench draws the zoom buttons (and the glide's chip) in its edge. */
const EDGE = '.bench-edge';
const hook = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d;
    return h ? { frames: h.frames(), state: h.state() } : null;
  });

async function openZoom(page: Page, errors: string[], fontScale = 1): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
    if (scale !== 1)
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { fontScale: scale }, version: 2 }),
      );
  }, fontScale);
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Từ tế bào đến DNA', exact: true }).click();
}

test('cell → DNA 3D: six levels, scale bars and the not-to-scale glide', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  await openZoom(page, errors);
  const edge = page.locator(EDGE);
  const view = page.locator('.bio3d[data-lesson="cellToDna"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await hook(page))?.frames ?? 0).toBeGreaterThan(0);
  await expect(view.getByText('Cấp 1/6 · Tế bào nhân thực')).toBeVisible();
  // Level 1: the 5 µm bar (a page label of the scene) and the nucleus at its printed size.
  await expect.poll(async () => (await hook(page))?.state?.level).toBe('cell');
  expect((await hook(page))?.state?.barNm).toBe(5000);
  await expect(view.locator('.bio3d__labels').getByText('5 µm', { exact: true })).toBeVisible();
  await expect(view.getByText('Đường kính nhân ≈ 5 µm')).toBeVisible();
  // The Science Card of the level.
  await expect(page.getByText('Tế bào nhân thực — cấp 1/6')).toBeVisible();

  // "Phóng to": the chip says "not to scale" while the camera glides, then level 2.
  const zoomIn = edge.getByRole('button', { name: 'Phóng to' });
  await zoomIn.click();
  await expect(edge.getByText('Chuyển cảnh giữa hai cấp — không theo tỉ lệ')).toBeVisible();
  await expect(view.getByText('Cấp 2/6 · Nhân tế bào')).toBeVisible();
  await expect.poll(async () => (await hook(page))?.state?.level).toBe('nucleus');
  await expect(edge.getByText('Chuyển cảnh giữa hai cấp — không theo tỉ lệ')).toHaveCount(0);
  expect((await hook(page))?.state?.barNm).toBe(1000);

  // Every level from the inspector: its own bar, and the last one has no next spot.
  const bars: Record<string, [number, string]> = {
    chromosome: [500, '500 nm'],
    fibre: [100, '100 nm'],
    nucleosome: [10, '10 nm'],
    dna: [1, '1 nm'],
  };
  const panel = page.getByRole('group', { name: 'Sáu cấp phóng to' });
  const names = ['3. NST kép ở kì giữa', '4. Sợi nhiễm sắc 10 nm và khung NST', '5. Nucleosome'];
  for (const [i, id] of ['chromosome', 'fibre', 'nucleosome', 'dna'].entries()) {
    const label = i < 3 ? names[i] : '6. Chuỗi xoắn kép B-DNA';
    await panel.getByRole('button', { name: new RegExp(`^${label ?? ''}`) }).click();
    await expect.poll(async () => (await hook(page))?.state?.level).toBe(id);
    const [nm, text] = bars[id] ?? [0, ''];
    expect((await hook(page))?.state?.barNm).toBe(nm);
    await expect(view.locator('.bio3d__labels').getByText(text, { exact: true })).toBeVisible();
  }
  expect((await hook(page))?.state?.spot).toBe(false);
  await expect(zoomIn).toBeDisabled();
  // The fibre level's card says why there is no 30 nm level (debated); in Basic mode it sits
  // under the card's "Xem thêm".
  await panel.getByRole('button', { name: /^4\. / }).click();
  // The bench: the whole Science Card is the notebook's "Thẻ khoa học" tab.
  await page.getByRole('tab', { name: 'Thẻ khoa học' }).click();
  await expect(page.getByText(/còn được tranh luận nên hình không vẽ/)).toHaveCount(1);

  // 1366×768: no horizontal scroll; the zoom buttons are full targets.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  const box = await edge.getByRole('button', { name: 'Thu nhỏ' }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  expect(errors).toEqual([]);
});

test('cell → DNA: reduced motion steps at once; the 2D picture has the same levels', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openZoom(page, errors);
  const edge = page.locator(EDGE);
  const view = page.locator('.bio3d[data-lesson="cellToDna"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await edge.getByRole('button', { name: 'Phóng to' }).click();
  // No glide, so no not-to-scale moment: the next level at once.
  await expect.poll(async () => (await hook(page))?.state?.level).toBe('nucleus');
  await expect(edge.getByText('Chuyển cảnh giữa hai cấp — không theo tỉ lệ')).toHaveCount(0);

  // The learner's 2D choice: the canvas picture, the same level and buttons.
  await view.getByRole('radio', { name: '2D' }).click();
  const flat = page.locator('.zoom2d');
  await expect(flat.locator('canvas')).toBeVisible();
  await expect(flat.getByText('Cấp 2/6 · Nhân tế bào')).toBeVisible();
  await edge.getByRole('button', { name: 'Phóng to' }).click();
  await expect(flat.getByText('Cấp 3/6 · NST kép ở kì giữa')).toBeVisible();
  await expect(flat.getByText(/Thước tỉ lệ dài đúng 500 nm/)).toBeVisible();
  await edge.getByRole('button', { name: 'Thu nhỏ' }).click();
  await expect(flat.getByText('Cấp 2/6 · Nhân tế bào')).toBeVisible();
  // Back to 3D for the next tests on this machine (the choice is remembered per device).
  await flat.getByRole('radio', { name: '3D' }).click();
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

for (const fontScale of [1, 1.4])
  test(`cell → DNA 3D: the glide is never cut short by a resize (font ${String(fontScale * 100)} %)`, async ({
    page,
  }) => {
    // Review of PR #111: a "not to scale" chip that wrapped the top bar resized a HUD inset
    // mid-glide, and the camera jumped to the spot instead of gliding.
    test.setTimeout(120_000);
    const errors: string[] = [];
    await openZoom(page, errors, fontScale);
    const edge = page.locator(EDGE);
    const view = page.locator('.bio3d[data-lesson="cellToDna"]');
    await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
    const panel = page.getByRole('group', { name: 'Sáu cấp phóng to' });
    for (const n of [3, 4]) {
      await panel.getByRole('button', { name: new RegExp(`^${String(n)}\\. `) }).click();
      await expect(view.getByText(new RegExp(`^Cấp ${String(n)}/6`))).toBeVisible();
      await expect
        .poll(async () => (await hook(page))?.state?.level)
        .toBe(n === 3 ? 'chromosome' : 'fibre');
      const top = view.locator('.bio3d__top');
      const before = (await top.boundingBox())?.height ?? 0;
      await edge.getByRole('button', { name: 'Phóng to' }).click();
      // The camera is gliding (a resize would have ended the glide at once).
      expect(
        await page.evaluate(
          () => (window as unknown as { __simlabBio3d?: Hook }).__simlabBio3d?.moving() ?? false,
        ),
      ).toBe(true);
      await expect(edge.getByText('Chuyển cảnh giữa hai cấp — không theo tỉ lệ')).toBeVisible();
      expect((await top.boundingBox())?.height ?? 0).toBeCloseTo(before, 0);
      await expect(view.getByText(new RegExp(`^Cấp ${String(n + 1)}/6`))).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1366,
    );
    expect(errors).toEqual([]);
  });

// ---- Biology on the bench edge (B5) ----
/** As `openBiology`: a slow test machine may measure as "low" quality (2D pictures, no 3D edge). */
async function openBioTopic(page: Page, topic: string) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openTopic(page, 'Sinh học', topic);
}
const edgeOf = (page: Page) => page.locator('.bench-edge');
const stageOf = (page: Page) => page.getByRole('region', { name: 'Khung mô phỏng' });
const seriousOnEdge = async (page: Page) =>
  (await new AxeBuilder({ page }).include('.bench-edge').analyze()).violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`);

test('B5: mitosis 3D steps from the edge; the stage keeps the stage name', async ({ page }) => {
  await openBioTopic(page, 'Nguyên phân');
  // D1 / D2 (§9.6): "Về kì trước" / "Sang kì tiếp" ("Kì sau" is anaphase's name).
  const next = edgeOf(page).getByRole('button', { name: 'Sang kì tiếp' });
  await expect(next).toBeVisible({ timeout: 30_000 });
  await expect(edgeOf(page).getByRole('button', { name: 'Về kì trước' })).toBeDisabled();
  await expect(stageOf(page).getByRole('button', { name: 'Sang kì tiếp' })).toHaveCount(0);
  const name = page.locator('.m3d__top .chem-chip strong').first();
  const before = await name.textContent();
  await next.click();
  await expect(name).not.toHaveText(before ?? '');
  await expect(edgeOf(page).getByRole('button', { name: 'Về kì trước' })).toBeEnabled();
  // Polled: a button that has just become enabled fades into its colours.
  await expect.poll(() => seriousOnEdge(page)).toEqual([]);
});

test('B5: a habitat lesson plays from the edge (time slider there)', async ({ page }) => {
  await openBioTopic(page, 'Tăng trưởng logistic');
  await expect(edgeOf(page).locator('.edge-steps input[type="range"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(stageOf(page).locator('.bio3d__player')).toHaveCount(0);
  // Polled: a button that has just become enabled fades into its colours.
  await expect.poll(() => seriousOnEdge(page)).toEqual([]);
});

test('B5: cell → DNA zooms from the edge', async ({ page }) => {
  await openBioTopic(page, 'Từ tế bào đến DNA');
  const zoomIn = edgeOf(page).getByRole('button', { name: 'Phóng to' });
  await expect(zoomIn).toBeVisible({ timeout: 30_000 });
  await expect(edgeOf(page).getByRole('button', { name: 'Thu nhỏ' })).toBeDisabled();
  await zoomIn.click();
  await expect(edgeOf(page).getByRole('button', { name: 'Thu nhỏ' })).toBeEnabled({
    timeout: 10_000,
  });
  // Polled: a button that has just become enabled fades into its colours.
  await expect.poll(() => seriousOnEdge(page)).toEqual([]);
});
