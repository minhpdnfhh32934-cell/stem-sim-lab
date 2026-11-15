import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Physics checks written after PR #198 for the bench (tests/e2e/bench, no longer run), carried
 * over to the classic window: runs without end (#205 C1), the energy drift notice (#205 C2), the
 * hint of a parameter row and Tệp → "Thông tin máy" (#201). What each test checks is unchanged;
 * only the way to the screen is the classic one. (The lessons added by #255 are in
 * physics.spec.ts's list.)
 */

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function openPhysics(page: Page, topic: string) {
  await openTopic(page, 'Vật lý', topic);
  // The dev server compiles a scene's chunk on first use (up to ~20 s on a busy machine).
  await expect(page.locator('.stage__hud-title')).toBeVisible({ timeout: 20_000 });
}

/** The time the engine reached, from the app's own store (the timeline shows it rounded). */
const simTime = (page: Page) =>
  page.evaluate(async () => {
    const mod = '/src/app/workspaceStore.ts';
    const { useWorkspaceStore } = (await import(/* @vite-ignore */ mod)) as {
      useWorkspaceStore: { getState(): { simTime: number } };
    };
    return useWorkspaceStore.getState().simTime;
  });

// #205 C1: a periodic lesson runs until the learner pauses it. Two-source interference used to
// stop at 20 periods (2 s with the defaults) and show "Kết thúc"; the standing wave at 0.8 s.
for (const [topic, oldEnd] of [
  ['Giao thoa sóng hai nguồn', 2],
  ['Sóng dừng trên dây', 0.8],
] as const) {
  test(`${topic} runs past its former end (${String(oldEnd)} s) until paused`, async ({ page }) => {
    await openPhysics(page, topic);
    await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
    const pause = page.getByRole('button', { name: 'Tạm dừng (Space)' }).first();
    await expect(pause).toBeVisible();
    await expect.poll(() => simTime(page), { timeout: 30_000 }).toBeGreaterThan(oldEnd + 1);
    // Still running: no "Kết thúc", the main action still pauses.
    await expect(pause).toBeVisible();
    await expect(page.getByText('Kết thúc', { exact: true })).toHaveCount(0);
    await pause.click();
    await expect(page.getByRole('button', { name: 'Chạy (Space)' }).first()).toBeVisible();
    // The time stays where "Tạm dừng" was pressed: a frame the worker ran past it is not shown
    // (#205: it moved one step, 3,1955 → 3,1995 s on CI). Read five times over 2 s.
    const stopped = await simTime(page);
    for (let i = 0; i < 5; i += 1) {
      await page.waitForTimeout(400);
      expect(await simTime(page)).toBe(stopped);
    }
  });
}

// #205 C2: an energy drift above 10⁻⁹ is said on the Science Card with its number and the card
// turns "gần đúng"; everything fits the Inspector at 100 % and 140 %. A real run needs days to
// drift that far, so the card a measured 3·10⁻⁹ makes is put in place (the runtime's path from the
// runner to the card is a unit test, `runtime.test.ts`). The bench tray's own button "Đặt lại để
// về kết quả chính xác" is not in the classic window: the timeline's "Đặt lại" is the reset.
for (const fontScale of [1, 1.4] as const) {
  test(`a drift above 10⁻⁹ is said, with its number, and fits the Inspector at ${String(fontScale * 100)} %`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
    }, fontScale);
    await openPhysics(page, 'Con lắc đơn');
    const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
    const card = inspector.locator('.science-card');
    await expect(card).toContainText('Định lượng chính xác', { timeout: 20_000 });
    await page.evaluate(async () => {
      const ws = '/src/app/workspaceStore.ts';
      const ty = '/src/science-card/types.ts';
      type Card = { confidence: string };
      const { useWorkspaceStore } = (await import(/* @vite-ignore */ ws)) as {
        useWorkspaceStore: {
          getState(): { scienceCard: Card | null };
          setState(s: { scienceCard: Card }): void;
        };
      };
      const { withDrift } = (await import(/* @vite-ignore */ ty)) as {
        withDrift: (c: Card, d: number) => Card;
      };
      const current = useWorkspaceStore.getState().scienceCard;
      if (!current) throw new Error('no card');
      useWorkspaceStore.setState({ scienceCard: withDrift(current, 3e-9) });
    });

    const notice = card.getByRole('note').filter({ hasText: 'Năng lượng đã lệch' });
    await expect(notice).toContainText('Năng lượng đã lệch 3·10⁻⁹ so với lúc đầu');
    await expect(card).toContainText('Định lượng gần đúng');
    // Whole inside the Inspector: nothing cut at its right edge.
    await notice.scrollIntoViewIfNeeded();
    const panel = await inspector.boundingBox();
    const box = await notice.boundingBox();
    if (!panel || !box) throw new Error('no box');
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
    expect(
      await notice.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      'the notice is not cut',
    ).toBe(true);
    expect(await sideScroll(page)).toBeLessThanOrEqual(0);

    // The reset runs again from the start: the measured drift is 0, the card exact again.
    await page.getByRole('button', { name: 'Đặt lại (R)' }).click();
    await expect(notice).toHaveCount(0);
    await expect(card).toContainText('Định lượng chính xác');
  });
}

test('a parameter that can change while running: its hint spans the row', async ({ page }) => {
  await openPhysics(page, 'Ném xiên');
  const inspector = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  // g can change while running: its hint spans the row (it once wrapped word by word in the − cell).
  const hint = inspector.locator('.param__hint').first();
  await hint.scrollIntoViewIfNeeded();
  const [hintBox, rowBox] = await Promise.all([
    hint.boundingBox(),
    hint.locator('xpath=..').boundingBox(),
  ]);
  expect(hintBox && rowBox && hintBox.width / rowBox.width).toBeGreaterThan(0.9);
});

// #201: Tệp → "Thông tin máy" (Advanced) shows the render quality, FPS and RAM. The bench test
// also held the bench edge's columns in place; here it is the timeline's controls that stay put.
for (const fontScale of [1, 1.4] as const)
  test(`Tệp → "Thông tin máy" (Advanced) at ${String(fontScale * 100)} %: inside the window, the timeline stays put, Esc gives Tệp back (#201)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({
          state: { locale: 'vi', fontScale: scale, uiMode: 'advanced' },
          version: 2,
        }),
      );
    }, fontScale);
    await openPhysics(page, 'Ném xiên');
    await expect(
      page.getByRole('complementary', { name: 'Bảng thuộc tính' }).locator('.science-card'),
    ).toBeVisible();
    // Every timeline control's box, before and while the box is open.
    const slots = () =>
      page.locator('.timeline > *').evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return [Math.round(r.x), Math.round(r.width)];
        }),
      );
    const before = await slots();
    const file = page.getByRole('button', { name: 'Tệp', exact: true });
    await file.click();
    await page.getByRole('menuitem', { name: 'Thông tin máy' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thông tin máy' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Chất lượng hiển thị');
    await expect(dialog).toContainText('FPS');
    await expect(dialog).toContainText('Bộ nhớ');
    const box = await dialog.boundingBox();
    if (!box) throw new Error('no dialog box');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1366);
    expect(await sideScroll(page)).toBe(0);
    expect(await slots()).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(file).toBeFocused();
  });
