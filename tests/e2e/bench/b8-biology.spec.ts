declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 B8, biology at 1366 × 768, 100 % and 140 %: the stage names of mitosis / meiosis stay on
 * one line, the timeline's names never overlap (only those with room show), the notebook rail's
 * label fits, a panel button is never cut off, and every slider has its number box and − / +.
 * WebGL in software (SwiftShader), as in meiosis3d.spec.ts.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

async function setUp(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
    );
    // A slow machine may measure as "low" quality, where the division lessons use 2D.
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
    // The logistic lesson's sliders are in the tray either way: its 2D picture is lighter.
    localStorage.setItem(
      'stemsim.bio3d',
      JSON.stringify({ state: { off: ['logisticGrowth'] }, version: 1 }),
    );
  }, fontScale);
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
}

async function open(page: Page, lesson: string) {
  await page.getByRole('main').getByRole('button', { name: lesson, exact: true }).click();
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

/** The timeline's shown names: inside the track and apart from each other. */
async function tickNames(page: Page) {
  return page.locator('.edge-steps__ticks').evaluate((ol) => {
    const track = ol.getBoundingClientRect();
    const boxes = [...ol.querySelectorAll('span:not(.is-unnamed)')].map((s) => {
      const b = s.getBoundingClientRect();
      return { text: s.textContent, left: b.left, right: b.right };
    });
    const overlaps = boxes.slice(1).filter((b, i) => b.left < (boxes[i]?.right ?? -Infinity));
    const outside = boxes.filter((b) => b.left < track.left - 1 || b.right > track.right + 1);
    return { names: boxes.map((b) => b.text), overlaps: overlaps.length, outside: outside.length };
  });
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const fontScale of [1, 1.4] as const) {
  const pct = `${String(fontScale * 100)} %`;

  test(`mitosis and meiosis at ${pct}: stage names on one line, timeline names apart, the rail label fits`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await setUp(page, fontScale);
    for (const [lesson, view, count] of [
      ['Nguyên phân', '.m3d', 7],
      ['Giảm phân', '.mei3d', 12],
    ] as const) {
      await open(page, lesson);
      await expect(page.locator(`${view} canvas`)).toBeVisible({ timeout: 30_000 });
      const stages = page.locator('.m3d__stage');
      await expect(stages).toHaveCount(count);
      for (const s of await layoutOf(stages)) {
        expect(s, `"${s.text}" on one line, not cut off`).toMatchObject({ lines: 1, cut: false });
      }
      const ticks = await tickNames(page);
      expect(ticks.overlaps, ticks.names.join(' · ')).toBe(0);
      expect(ticks.outside, ticks.names.join(' · ')).toBe(0);
      expect(ticks.names.length).toBeGreaterThanOrEqual(2);

      const rail = page.getByRole('tab', { name: 'Bảng số lượng' });
      await expect(rail).toBeVisible();
      for (const l of await layoutOf(rail.locator('span'))) {
        expect(l.cut, 'rail label not cut off').toBe(false);
        expect(l.lines).toBeLessThanOrEqual(3);
      }
      expect(await noSideScroll(page)).toBe(0);
      await page.locator('.bench-crumbs').getByRole('button', { name: 'Virtual Lab' }).click();
      await page.getByRole('radio', { name: 'Sinh học' }).click();
    }
    // Meiosis' panel button wraps instead of being cut off.
    await open(page, 'Giảm phân');
    const reshuffle = page.getByRole('button', { name: 'Sắp xếp ngẫu nhiên lại ở kì giữa I' });
    await expect(reshuffle).toBeVisible({ timeout: 30_000 });
    for (const b of await layoutOf(reshuffle)) expect(b.cut).toBe(false);
  });

  test(`logistic growth at ${pct}: every slider of the tray has its number box and − / +`, async ({
    page,
  }) => {
    await setUp(page, fontScale);
    await open(page, 'Tăng trưởng logistic');
    const tray = page.getByRole('complementary', { name: 'Điều chỉnh (bảng thuộc tính)' });
    const sliders = tray.getByRole('slider');
    await expect(sliders.first()).toBeVisible({ timeout: 20_000 });
    const names = await sliders.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const name of names) {
      if (!name) throw new Error('a slider without a name');
      await expect(tray.getByRole('textbox', { name })).toBeVisible();
      for (const b of [`Giảm ${name}`, `Tăng ${name}`]) {
        const r = await tray.getByRole('button', { name: b }).boundingBox();
        expect(Math.min(r?.width ?? 0, r?.height ?? 0)).toBeGreaterThanOrEqual(40);
      }
    }
    const k = tray.getByRole('textbox', { name: 'Sức chứa K' });
    const before = Number((await k.inputValue()).replace(',', '.'));
    await tray.getByRole('button', { name: 'Tăng Sức chứa K' }).click();
    await expect(k).toHaveValue(String(before + 50));
    await k.fill('1500');
    await expect(tray.getByRole('slider', { name: 'Sức chứa K' })).toHaveValue('1500');
    expect(await noSideScroll(page)).toBe(0);
  });
}
