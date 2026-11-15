declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Locator, type Page } from '@playwright/test';
import { logistic, logisticInflection } from '../../src/biology/ecology/ecology';
import { lotkaVolterra } from '../../src/biology/ecology/ecology';
import { openLab } from './nav';
import { expectNoticesBelow, showOverloadNotices } from './overload';

/**
 * Biology checks written after PR #198 for the bench (tests/e2e/bench, no longer run), carried
 * over to the classic window: the runs without end of the 3D habitats and of diffusion & osmosis
 * (#205 C5), the dialogs that load on first use while a lesson runs (#205 C5), biology at 100 %
 * and 140 % (#205 B8), labels (#205 A5) and the overload notices. What each test checks is
 * unchanged; the run is driven from the classic player on the
 * stage ("Phát" / "Tạm dừng" / "Phát lại từ đầu", or the "Chạy lại" chip) instead of the bench edge.
 * WebGL runs in software (SwiftShader), never on the GPU (see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Medium quality: a slow test machine may measure as "low", where the lessons use 2D pictures. */
async function mediumQuality(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
}

async function openBiology(page: Page, lesson: string) {
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page
    .getByRole('complementary', { name: 'Thư viện chủ đề' })
    .getByRole('button', { name: lesson, exact: true })
    .click();
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

// ───────────── Runs without end (#205 C5) ─────────────

interface HabitatHook<S> {
  frames(): number;
  state(): S | null;
}
const frames = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __simlabBio3d?: HabitatHook<unknown> }).__simlabBio3d?.frames() ?? 0,
  );
const habitatState = <S>(page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __simlabBio3d?: HabitatHook<unknown> }).__simlabBio3d?.state() ??
      null,
  ) as Promise<S | null>;

const vi = (v: number, d: number) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);

/** The logistic lesson's defaults (store.ts). */
const LESSON = { N0: 10, r: 0.5, K: 1000, tEnd: 30 };
const N = (t: number) => logistic(LESSON.N0, LESSON.r, LESSON.K, t);
interface LogiState {
  t: number;
  N: number;
  drawn: number;
  per: number;
  kSlots: number;
}

test('logistic growth 3D: the run goes on past its span, then stands at K (#205 C5)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await mediumQuality(page);
  await openBiology(page, 'Tăng trưởng logistic');
  const view = page.locator('.bio3d[data-lesson="logistic"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => frames(page), { timeout: 15_000 }).toBeGreaterThan(0);

  // The end of the first span (paused there); "Phát" goes on to the next span.
  const player = view.locator('.bio3d__player');
  const slider = player.getByRole('slider', { name: 'Thời gian t' });
  await slider.fill(String(LESSON.tEnd));
  await player.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect
    .poll(async () => (await habitatState<LogiState>(page))?.t ?? 0, { timeout: 30_000 })
    .toBeGreaterThan(LESSON.tEnd + 1);
  await player.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(slider).toHaveAttribute('min', String(LESSON.tEnd));
  await expect(slider).toHaveAttribute('max', String(2 * LESSON.tEnd));
  const s = await habitatState<LogiState>(page);
  if (!s) throw new Error('no state');
  // The exact N(t) at the time shown: by then the herd stands at K.
  expect(s.N).toBeCloseTo(N(s.t), 6);
  expect(s.drawn).toBe(Math.round(N(s.t) / s.per));
  expect(s.drawn).toBe(s.kSlots);

  // "Tới t*" goes back to the span holding the inflection; "Phát lại từ đầu" plays from t = 0.
  const tStar = logisticInflection(LESSON.N0, LESSON.r, LESSON.K);
  await player.getByRole('button', { name: /Tới t\*/ }).click();
  await expect(player.locator('output')).toHaveText(`t = ${vi(tStar, 3)} · N = ${vi(500, 4)}`);
  await expect(slider).toHaveAttribute('min', '0');
  await player.getByRole('button', { name: 'Phát lại từ đầu' }).click();
  await expect
    .poll(async () => (await habitatState<LogiState>(page))?.t ?? Infinity)
    .toBeLessThan(tStar);
  await expect(player.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

/** The predator–prey lesson's defaults (store.ts) and its 800 computed steps per span (data.ts). */
const P = { alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5 };
interface LvState {
  t: number;
  x: number;
  y: number;
}

test('predator–prey 3D: the run goes on past its span, computed from its last sample (#205 C5)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await mediumQuality(page);
  await openBiology(page, 'Con mồi – vật ăn thịt (Lotka–Volterra)');
  const view = page.locator('.bio3d[data-lesson="lotkaVolterra"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => frames(page), { timeout: 15_000 }).toBeGreaterThan(0);

  // The end of the first span (paused there); "Phát" goes on to the next span, it does not stop
  // or start again from t = 0.
  const player = view.locator('.bio3d__player');
  const slider = player.getByRole('slider', { name: 'Thời gian t' });
  await slider.fill('30');
  await player.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect
    .poll(async () => (await habitatState<LvState>(page))?.t ?? 0, { timeout: 30_000 })
    .toBeGreaterThan(31);
  await player.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(slider).toHaveAttribute('min', '30');
  await expect(slider).toHaveAttribute('max', '60');

  // The moment shown is the run computed in one go over both spans: never an interpolation.
  const s = await habitatState<LvState>(page);
  if (!s) throw new Error('no state');
  const whole = lotkaVolterra(P, 10, 5, 60, 1600);
  const k = 800 + Math.round(((s.t - 30) / 30) * 800);
  expect(s.t).toBeCloseTo(whole.t[k] ?? 0, 9);
  expect(s.x).toBeCloseTo(whole.x[k] ?? 0, 9);
  expect(s.y).toBeCloseTo(whole.y[k] ?? 0, 9);
  // V is still conserved over both spans: the chip is not flagged.
  await expect(view.getByText(/Sai lệch của đại lượng bảo toàn V/)).not.toHaveClass(/approx/);
  expect(errors).toEqual([]);
});

interface TransportDebug {
  counts(): { n1: number; n2: number; left: number; right: number } | null;
  heights(): { hL: number; hR: number; drawnL: number; drawnR: number; sceneL: number } | null;
}
/** Calls one read-only debug hook of the transport view (`window.__simlab3d.transport`). */
const transportHook = <T>(page: Page, fn: keyof TransportDebug) =>
  page.evaluate((f) => {
    const d = (window as unknown as { __simlab3d?: Record<string, TransportDebug | undefined> })
      .__simlab3d?.transport;
    return d ? d[f]() : null;
  }, fn) as unknown as Promise<T | null>;

/**
 * The transport lesson's defaults (C₁ = 10 mM, C₂ = 0, V₁ = V₂ = 1 mL, PA = 0,2 mL/phút, 160
 * particles): N₁(t) = round(160 · C₁(t)V₁ / (C₁⁰V₁ + C₂⁰V₂)), C₁(t) = 5 + 5·e^(−0,4t) (exact Fick).
 */
const n1At = (t: number) => {
  const c1 = 5 + 5 * Math.exp(-0.4 * t);
  const q = (160 * c1) / 10;
  // Two classes by largest remainders: half rounds to side 1.
  return q - Math.floor(q) >= 0.5 ? Math.ceil(q) : Math.floor(q);
};

/** Time and span of the 3D view's endless run (its store). */
const run3d = (page: Page) =>
  page.evaluate(async () => {
    const mod = '/src/biology/transport/transport3d/store.ts';
    const { useTransport3D } = (await import(/* @vite-ignore */ mod)) as {
      useTransport3D: { getState(): { t: number; page: number } };
    };
    const s = useTransport3D.getState();
    return { t: s.t, page: s.page };
  });

test('diffusion & osmosis 3D: the run goes on past its span (#205 C5)', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await mediumQuality(page);
  await openBiology(page, 'Khuếch tán & thẩm thấu');
  await expect(page.locator('.tr3d canvas')).toBeVisible({ timeout: 30_000 });
  const player = page.locator('.tr3d .bio3d__player');
  const time = page.getByRole('slider', { name: 'Thời gian' });

  // Diffusion: from the end of the first span "Phát" goes on; the counts follow Fick past it.
  await time.focus();
  await page.keyboard.press('End');
  const end = (await run3d(page)).t;
  expect(end).toBeGreaterThan(0);
  await player.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect
    .poll(async () => (await run3d(page)).t, { timeout: 30_000 })
    .toBeGreaterThan(1.05 * end);
  await player.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const at = await run3d(page);
  expect(at.page).toBe(1);
  expect(Number(await time.getAttribute('min'))).toBeCloseTo(end, 9);
  const n1 = n1At(at.t);
  await expect(page.locator('.tr3d__counts')).toHaveText(
    `Ngăn 1: ${String(n1)} hạt · Ngăn 2: ${String(160 - n1)} hạt`,
  );
  expect(await transportHook(page, 'counts')).toEqual({
    n1,
    n2: 160 - n1,
    left: n1,
    right: 160 - n1,
  });

  // Osmosis: the same; past its first span the columns stand at the model's end state.
  await page.getByRole('radio', { name: 'Thẩm thấu' }).click();
  await expect(page.locator('.tr3d[data-mode="osmosis"] canvas')).toBeVisible();
  expect((await run3d(page)).page).toBe(0);
  await time.focus();
  await page.keyboard.press('End');
  const oEnd = (await run3d(page)).t;
  const first = (await transportHook<{ hL: number }>(page, 'heights'))!;
  await player.getByRole('button', { name: 'Phát', exact: true }).click();
  await expect
    .poll(async () => (await run3d(page)).t, { timeout: 30_000 })
    .toBeGreaterThan(1.05 * oEnd);
  await player.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  expect((await run3d(page)).page).toBe(1);
  const h = (await transportHook<{ hL: number; hR: number; drawnL: number; drawnR: number }>(
    page,
    'heights',
  ))!;
  expect(h.drawnL).toBeCloseTo(h.hL, 6);
  expect(h.drawnR).toBeCloseTo(h.hR, 6);
  // Closer still to the defaults' equilibrium (C₀ = 1 mM, i = 1, 25 °C, h₀ = 20 cm) than at the
  // end of the first span (the sample-for-sample check is osmosis's endless.test.ts).
  const RT = 8.314462618 * 298.15;
  const rg = 1000 * 9.80665;
  const hEq = (2 * rg * 0.2 + Math.sqrt((2 * rg * 0.2) ** 2 + 8 * rg * 0.2 * RT)) / (4 * rg);
  expect(Math.abs(h.hL - hEq)).toBeLessThan(Math.abs(first.hL - hEq));
  expect(Math.abs(h.hL - hEq)).toBeLessThan(1e-3);
  // "Chạy lại": the run plays again from t = 0, in its first span.
  await page.getByRole('button', { name: 'Chạy lại' }).click();
  await expect.poll(async () => (await run3d(page)).page).toBe(0);
  expect((await run3d(page)).t).toBeLessThan(oEnd);
  await expect(time).toHaveAttribute('min', '0');
  expect(errors).toEqual([]);
});

// ───────────── Dialogs that load on first use (#205 C5) ─────────────

// With React's `lazy()` their retry was starved while the predator–prey habitat updated every
// frame, and Ctrl+K or "Nguồn & Giả định" opened nothing (every time on the desktop machine).
test('Ctrl+K and "Nguồn & Giả định" open while a lesson runs without end', async ({ page }) => {
  await mediumQuality(page);
  await openBiology(page, 'Con mồi – vật ăn thịt (Lotka–Volterra)');
  await expect(page.locator('.science-card__title')).toBeVisible({ timeout: 20_000 });
  // Running: the player's main action pauses.
  await expect(page.getByRole('button', { name: /^Tạm dừng/ }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(2000);

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Tìm nhanh' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Tìm nhanh' })).toBeHidden();

  await page.locator('.topbar').getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: 'Nguồn & Giả định' }).click();
  await expect(page.getByRole('dialog', { name: 'Nguồn & Giả định' })).toBeVisible();
});

// ───────────── Mitosis: overload notices ─────────────

async function openMitosis(page: Page, quality: 'medium' | 'high' = 'medium') {
  await page.addInitScript((preference) => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference, benchmark: null }, version: 1 }),
    );
  }, quality);
  await openBiology(page, 'Nguyên phân');
  await expect(page.locator('.m3d canvas')).toBeVisible({ timeout: 30_000 });
}

// The bench drew the notices in a strip under its stage; the classic window says them in its
// status bar, which lies under the stage too.
test('overload notices: in the status bar under the stage, clear of the 3D view’s HUD', async ({
  page,
}) => {
  // High quality: a lower one (medium) keeps the 3D view and its HUD, as on a real machine.
  await openMitosis(page, 'high');
  await expect(page.locator('.m3d__hud')).toBeVisible();
  await showOverloadNotices(page);
  const notes = page.locator('.statusbar');
  await expect(notes).toContainText('Đã hạ chất lượng hiển thị');
  await expect(notes).toContainText('Chuyển động chậm ×0,5');
  // Below the whole stage, so nothing drawn in it (HUD, run buttons, overlays) can be covered.
  await expectNoticesBelow(page, '.statusbar', 'section.stage', '.m3d__hud');
  expect(await sideScroll(page)).toBeLessThanOrEqual(0);
});

// ───────────── Biology at 100 % and 140 % (#205 B8), labels (#205 A5) ─────────────

async function useFontScale(page: Page, fontScale: number, off2d: string[] = []) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(
    ([scale, off]) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
      localStorage.setItem(
        'stemsim.perf',
        JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
      );
      // Lessons listed here show their lighter 2D picture (the checks are not about the 3D view).
      localStorage.setItem('stemsim.bio3d', JSON.stringify({ state: { off }, version: 1 }));
    },
    [fontScale, off2d] as const,
  );
}

/** Lines of text in each element (distinct tops of its text's boxes) and whether it is cut off. */
const layoutOf = (loc: Locator) =>
  loc.evaluateAll((els) =>
    els.map((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const tops = new Set([...r.getClientRects()].map((b) => Math.round(b.top)));
      return {
        text: el.textContent,
        lines: tops.size,
        cut: el.scrollWidth > el.clientWidth + 1,
      };
    }),
  );

/** A label is whole, or (cut to "…") whole in its tooltip, reached with the keyboard too. */
async function wholeByKeyboard(page: Page, label: Locator, name: string) {
  const cut = await label.evaluate((el) => el.scrollWidth > el.clientWidth);
  if (!cut) {
    await expect(label).not.toHaveAttribute('tabindex');
    return;
  }
  await expect(label).toHaveAttribute('data-tip', name);
  await expect(label).toHaveAttribute('tabindex', '0');
  for (let i = 0; i < 200; i += 1) {
    await page.keyboard.press('Tab');
    if (await label.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(label).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText(name);
}

for (const fontScale of [1, 1.4] as const) {
  const pct = `${String(fontScale * 100)} %`;

  test(`mitosis and meiosis at ${pct}: stage names on one line, a panel button never cut off, "2n = 4" on one line`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await useFontScale(page, fontScale);
    const library = page.getByRole('complementary', { name: 'Thư viện chủ đề' });
    await openLab(page);
    await page.getByRole('radio', { name: 'Sinh học' }).click();
    for (const [lesson, view, count] of [
      ['Nguyên phân', '.m3d', 7],
      ['Giảm phân', '.mei3d', 12],
    ] as const) {
      await library.getByRole('button', { name: lesson, exact: true }).click();
      await expect(page.locator(`${view} canvas`)).toBeVisible({ timeout: 30_000 });
      const stages = page.locator('.m3d__stage');
      await expect(stages).toHaveCount(count);
      for (const s of await layoutOf(stages)) {
        expect(s, `"${s.text}" on one line, not cut off`).toMatchObject({ lines: 1, cut: false });
      }
      expect(await sideScroll(page)).toBe(0);
    }
    // Meiosis' panel button wraps instead of being cut off.
    const reshuffle = page.getByRole('button', { name: 'Sắp xếp ngẫu nhiên lại ở kì giữa I' });
    await expect(reshuffle).toBeVisible({ timeout: 30_000 });
    for (const b of await layoutOf(reshuffle)) expect(b.cut).toBe(false);
    // Short of room, the twelve stages take two rows split between the divisions: the second
    // starts at "Kì đầu II", never "Chia tế bào chất II" alone.
    const tops = await page
      .locator('.m3d__stage')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(2);
    expect(tops.findIndex((top) => top !== tops[0])).toBe(7);
    // "2n = 4" on one line beside its long label.
    const pairs = page.getByRole('combobox', { name: /Bộ NST lưỡng bội/ });
    const box = await pairs.boundingBox();
    expect(box?.height ?? 0).toBeLessThanOrEqual(40 * fontScale + 2);
    expect(await pairs.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });

  test(`logistic growth at ${pct}: every slider of the Inspector has its number box and − / +`, async ({
    page,
  }) => {
    // The sliders are in the Inspector either way: the lesson's 2D picture is lighter.
    await useFontScale(page, fontScale, ['logisticGrowth']);
    await openBiology(page, 'Tăng trưởng logistic');
    const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
    const sliders = inspector.getByRole('slider');
    await expect(sliders.first()).toBeVisible({ timeout: 20_000 });
    const names = await sliders.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(names.length).toBeGreaterThanOrEqual(3);
    // The bench drew − / + as 40 px targets; the classic window's icon buttons are 30 px at
    // 100 %, so their size is not checked here.
    for (const name of names) {
      if (!name) throw new Error('a slider without a name');
      await expect(inspector.getByRole('textbox', { name })).toBeVisible();
      for (const b of [`Giảm ${name}`, `Tăng ${name}`]) {
        await expect(inspector.getByRole('button', { name: b })).toBeVisible();
      }
    }
    const k = inspector.getByRole('textbox', { name: 'Sức chứa K' });
    const before = Number((await k.inputValue()).replace(',', '.'));
    await inspector.getByRole('button', { name: 'Tăng Sức chứa K' }).click();
    await expect(k).toHaveValue(String(before + 50));
    await k.fill('1500');
    await expect(inspector.getByRole('slider', { name: 'Sức chứa K' })).toHaveValue('1500');
    expect(await sideScroll(page)).toBe(0);
  });

  test(`Con mồi – vật ăn thịt (Lotka–Volterra): labels whole or reachable, font ${pct} (#205 A5)`, async ({
    page,
  }) => {
    // The 2D picture: this test checks labels, and software WebGL made every Tab press slow.
    await useFontScale(page, fontScale, ['lotkaVolterra']);
    await openBiology(page, 'Con mồi – vật ăn thịt (Lotka–Volterra)');
    const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
    const title = inspector.locator('.science-card__title');
    await expect(title).toBeVisible({ timeout: 20_000 });
    for (const mode of ['Cơ bản', 'Nâng cao']) {
      const radio = inspector.getByRole('radio', { name: mode, exact: true });
      expect((await layoutOf(radio))[0]?.lines, mode).toBe(1);
    }
    // The lesson's name above its controls (the bench header's h1 there), and the card's title.
    const name = inspector.locator('.section__title--keep-case');
    await wholeByKeyboard(page, name, (await name.textContent()) ?? '');
    await wholeByKeyboard(page, title, (await title.textContent()) ?? '');
    expect(await sideScroll(page)).toBeLessThanOrEqual(0);
  });
}
