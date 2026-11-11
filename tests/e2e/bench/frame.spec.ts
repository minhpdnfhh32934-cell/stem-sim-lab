import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isBench, openProblem, openTopic } from '../nav';

/**
 * The bench frame (0.8.1 B1, #115; docs/BENCH_DESIGN.md §3 and §8), the only shell since B8:
 * geometry at 1366×768, landmarks, the folding tray, the notebook,
 * one filled button per state, the stage's live line and 40 px targets.
 */

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error('not visible');
  return { w: Math.round(b.width), h: Math.round(b.height) };
};
const stage = (page: Page) => page.getByRole('region', { name: 'Khung mô phỏng' });

async function openProjectile(page: Page) {
  await openTopic(page, 'Vật lý', 'Ném xiên');
  // The dev server compiles a scene's chunk on first use.
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
}

/**
 * Exactly `n` filled buttons in `scope`: visible controls whose background is the play or the
 * accent colour (one main action per screen, PROMPT_PHAN_2 A4).
 */
async function expectFilled(scope: Locator, n: number) {
  // The pointer can rest on a button after the last click (opening a topic leaves it where the
  // main action appears): hovered, a filled button shows its hover colour instead. A button that
  // has just become enabled fades into its fill (background transition), so the count is polled.
  await scope.page().mouse.move(1, 1);
  const filledCount = () =>
    scope.evaluate((root) => {
      const probe = document.createElement('i');
      document.body.append(probe);
      const colour = (token: string) => {
        probe.style.background = `var(${token})`;
        return getComputedStyle(probe).backgroundColor;
      };
      const filled = [colour('--play'), colour('--accent')];
      probe.remove();
      // Both tokens must resolve (the bench sets --play); a transparent "fill" would match any button.
      if (filled.some((c) => c === 'rgba(0, 0, 0, 0)')) return -1;
      return [...root.querySelectorAll<HTMLElement>('button, [role="button"], a.btn')].filter(
        (el) => el.checkVisibility() && filled.includes(getComputedStyle(el).backgroundColor),
      ).length;
    });
  await expect.poll(filledCount).toBe(n);
}

test('a physics topic opens on the bench: stage 998×656, landmarks, no horizontal scroll', async ({
  page,
}) => {
  await openProjectile(page);
  expect(await isBench(page)).toBe(true);
  const s = await box(stage(page));
  expect(s.w).toBeGreaterThanOrEqual(998);
  expect(s.h).toBeGreaterThanOrEqual(656);
  await expect(page.getByRole('complementary', { name: 'Bảng thuộc tính' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bảng đồ thị và lời giải' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Điều khiển thời gian' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Công cụ mô phỏng' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Ném xiên' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 1366, height: 688 });
  await expect.poll(async () => (await box(stage(page))).h).toBe(576);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the tray folds to its 64 px spine and stays folded; the notebook pushes the stage', async ({
  page,
}) => {
  await openProjectile(page);
  const tray = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  await tray.getByRole('button', { name: 'Thu gọn khay' }).click();
  await expect.poll(async () => (await box(tray)).w).toBe(64);
  expect((await box(stage(page))).w).toBeGreaterThanOrEqual(1238);
  // The keyboard focus moves to the button that replaced the one pressed.
  await expect(tray.getByRole('button', { name: 'Mở khay Điều chỉnh' })).toBeFocused();

  await page.reload();
  await openProjectile(page);
  await expect.poll(async () => (await box(tray)).w).toBe(64);
  await tray.getByRole('button', { name: 'Mở khay Điều chỉnh' }).click();
  await expect.poll(async () => (await box(tray)).w).toBe(304);
  await expect(tray.getByRole('button', { name: 'Thu gọn khay' })).toBeFocused();

  // Notebook: a rail tab opens the drawer beside the stage (1366 − 64 − 352 − 304 = 646).
  const graphs = page.getByRole('tab', { name: 'Đồ thị' });
  await graphs.click();
  await expect(graphs).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Đồ thị' })).toBeVisible();
  await expect.poll(async () => (await box(stage(page))).w).toBe(646);
  await graphs.click();
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
  await expect.poll(async () => (await box(stage(page))).w).toBe(998);

  // Rail keys: arrows move the focus, Enter opens; Esc and "Đóng sổ" give the focus back.
  await graphs.focus();
  await page.keyboard.press('ArrowDown');
  const solution = page.getByRole('tab', { name: 'Lời giải' });
  await expect(solution).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tabpanel', { name: 'Lời giải' })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng sổ' }).click();
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
  await expect(solution).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Đóng sổ' }).focus();
  // One Esc: the focus tooltip goes and the drawer closes.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
  await expect(solution).toBeFocused();
});

test('one filled button on the bench, none at the 18+ question', async ({ page, browser }) => {
  await openProjectile(page);
  await expectFilled(page.locator('body'), 1);
  // Every notebook tab, the challenge first (a physics topic's first visit lands there).
  for (const name of ['Thử thách', 'Đồ thị', 'Lời giải', 'Thẻ khoa học', 'Hỏi AI']) {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expectFilled(page.locator('body'), 1);
  }

  // A first run that has not answered the 18+ question yet.
  const state = JSON.parse(readFileSync('tests/e2e/storage-state.json', 'utf8')) as {
    origins: { localStorage: { name: string }[] }[];
  };
  for (const o of state.origins)
    o.localStorage = o.localStorage.filter((e) => e.name !== 'stemsim.safety');
  const ctx = await browser.newContext({
    storageState: state as never,
    baseURL: 'http://localhost:1420',
    locale: 'vi-VN',
    viewport: { width: 1366, height: 768 },
  });
  const fresh = await ctx.newPage();
  await fresh.goto('/');
  const gate = fresh.locator('dialog.age-gate');
  await expect(gate).toBeVisible({ timeout: 20_000 });
  // App draws the gate at once; the bench shell marks <html> in an effect, a moment later.
  await expect.poll(() => isBench(fresh)).toBe(true);
  await expectFilled(gate, 0);
  await ctx.close();
});

test('the stage speaks only when its state changes; the time is the scrubber value', async ({
  page,
}) => {
  await openProjectile(page);
  await expect(page.locator('.stage__hud')).not.toHaveAttribute('aria-live');
  const live = page.locator('.stage [aria-live]');
  await expect(live).toHaveCount(1);
  await page.getByRole('button', { name: 'Chạy (Space)' }).click();
  await expect(live).toHaveText('Ném xiên: đang chạy.');
  await page.waitForTimeout(400);
  await expect(live).toHaveText('Ném xiên: đang chạy.');
  const scrubber = page.getByRole('slider', { name: 'Tua mô phỏng' });
  await expect(scrubber).toHaveAttribute('aria-valuetext', /^\d+,\d{3} s$/);

  // A pause (the worker may still send a frame) is one line, with the time the scrubber shows.
  await live.evaluate((el) => {
    new MutationObserver(() => {
      el.dataset.heard = String(Number(el.dataset.heard ?? 0) + 1);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Tạm dừng (Space)' }).click();
  await expect(live).toHaveText(/^Ném xiên: tạm dừng ở t = \d+,\d{3} s\.$/);
  await page.waitForTimeout(400);
  await expect(live).toHaveAttribute('data-heard', '1');
  const time = await scrubber.getAttribute('aria-valuetext');
  await expect(live).toHaveText(`Ném xiên: tạm dừng ở t = ${time ?? ''}.`);
});

test('every control on the frame is at least 40 px; "Đề bài" opens the problem box', async ({
  page,
}) => {
  await openProjectile(page);
  const controls = page.locator(
    '.bench-header button, .bench-edge button, .bench-edge select, .notebook__tab, .tray .panel__header button',
  );
  const n = await controls.count();
  expect(n).toBeGreaterThan(8);
  for (let i = 0; i < n; i++) {
    const c = controls.nth(i);
    if (!(await c.isVisible())) continue;
    const b = await box(c);
    expect(
      Math.min(b.w, b.h),
      await c.evaluate((el) => el.outerHTML.slice(0, 80)),
    ).toBeGreaterThanOrEqual(40);
  }

  const field = await openProblem(page);
  await expect(field).toBeVisible();
  await field.fill('Ném một vật với vận tốc 10 m/s.');
  await page.getByRole('button', { name: 'Đóng đề bài' }).click();
  await expect(field).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đề bài', exact: true })).toBeFocused();
});

test('the launch page: two 268×168 doors, the lab the only filled one, "Tiếp tục" after a visit', async ({
  page,
}) => {
  await page.goto('/');
  const lab = page.getByRole('button', { name: /Virtual Lab/ });
  await expect(lab).toBeVisible({ timeout: 20_000 });
  expect(await box(lab)).toEqual({ w: 268, h: 168 });
  expect(await box(page.locator('.launch-card--teacher'))).toEqual({ w: 268, h: 168 });
  await expectFilled(page.locator('body'), 1);
  // Nothing to undo and no AI on the launch page (§9.1).
  await expect(page.getByRole('button', { name: /Hoàn tác|Làm lại/ })).toHaveCount(0);
  await expect(page.locator('.ai-status')).toHaveCount(0);
  expect(await overflow(page)).toBe(0);

  await openProjectile(page);
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await page.getByRole('button', { name: 'Tiếp tục: Ném xiên (Vật lý)' }).click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên');
});

test('the launch page draws one still of the projectile beside the doors, captioned', async ({
  page,
}) => {
  await page.goto('/');
  const still = page.locator('.bench-launch__canvas');
  await expect(still).toBeVisible({ timeout: 20_000 });
  expect(await box(still)).toEqual({ w: 590, h: 440 });
  await expect(page.locator('.bench-launch__still figcaption')).toHaveText(
    'Hình vẽ từ mô phỏng Ném xiên với giá trị mặc định',
  );
  // Drawn once, after the first paint: some pixels are no longer the stage's background.
  await expect
    .poll(() =>
      still.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
        if (!d) return 0;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if ((d[i] ?? 0) > 0) n++;
        return n;
      }),
    )
    .toBeGreaterThan(1000);
  expect(await overflow(page)).toBe(0);
});

test('the tour waits on the shelf, then shows Chạy, the tray and the notebook on a topic', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: 'Hướng dẫn nhanh' }).click();
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'Rơi tự do', exact: true }).click();
  const tour = page.locator('.tour');
  await expect(tour.getByRole('heading', { name: 'Chạy thí nghiệm' })).toBeVisible({
    timeout: 20_000,
  });
  for (const [title, spot] of [
    ['Khay Điều chỉnh', '[data-tour="inspector"]'],
    ['Sổ ghi', '[data-tour="notebook"]'],
  ] as const) {
    await tour.getByRole('button', { name: 'Tiếp' }).click();
    await expect(tour.getByRole('heading', { name: title })).toBeVisible();
    const target = await page.locator(spot).boundingBox();
    // The spot glides to its target.
    await expect
      .poll(async () => ((await page.locator('.tour__spot').boundingBox())?.x ?? 0) + 4)
      .toBeCloseTo(target?.x ?? -1, 0);
  }
  await expect(tour.getByRole('button', { name: 'Bỏ qua hướng dẫn' })).toBeVisible();
  await tour.getByRole('button', { name: 'Bắt đầu' }).click();
  await expect(tour).toHaveCount(0);
});

test('presentation from Tệp: the HUD stays clear of the exit button; Esc leaves it', async ({
  page,
}) => {
  await openProjectile(page);
  await page.getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: 'Chế độ trình chiếu (F5)' }).click();
  const exit = page.getByRole('button', { name: 'Thoát trình chiếu (Esc)' });
  await expect(exit).toBeVisible();
  await expect(page.locator('.bench-header')).toHaveCount(0);
  // The HUD's right end (title, "Đã có can thiệp", PerfNotes) never sits under the button.
  const hud = await page.locator('.stage__hud').boundingBox();
  const button = await exit.boundingBox();
  if (!hud || !button) throw new Error('not visible');
  // A 40 px target (#202; it was 38 px).
  expect(Math.min(button.width, button.height)).toBeGreaterThanOrEqual(40);
  const apart =
    hud.x + hud.width <= button.x ||
    button.x + button.width <= hud.x ||
    hud.y + hud.height <= button.y ||
    button.y + button.height <= hud.y;
  expect(apart, `HUD ${JSON.stringify(hud)} vs exit ${JSON.stringify(button)}`).toBe(true);
  await page.keyboard.press('Escape');
  await expect(exit).toHaveCount(0);
  await expect(page.locator('.bench-header')).toHaveCount(1);
});
