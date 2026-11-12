import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

/**
 * #205 C2: an energy drift above 10⁻⁹ is said on the Science Card with its number, the card turns
 * "gần đúng", and the tray's summary offers the reset; everything fits the tray at 100 % and 140 %.
 * A real run needs days to drift that far, so the card a measured 3·10⁻⁹ makes is put in place
 * (the runtime's path from the runner to the card is a unit test, `runtime.test.ts`).
 */
for (const fontScale of [1, 1.4] as const) {
  test(`a drift above 10⁻⁹ is said, with its number, and fits the tray at ${String(fontScale * 100)} %`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
    }, fontScale);
    await openLab(page);
    await page.getByRole('radio', { name: 'Vật lý' }).click();
    await page.getByRole('main').getByRole('button', { name: 'Con lắc đơn', exact: true }).click();
    await expect(page.locator('.bench-chip:not(.bench-chip--empty)')).toBeVisible({
      timeout: 20_000,
    });
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
      const card = useWorkspaceStore.getState().scienceCard;
      if (!card) throw new Error('no card');
      useWorkspaceStore.setState({ scienceCard: withDrift(card, 3e-9) });
    });

    const tray = page.getByRole('complementary', { name: 'Điều chỉnh (bảng thuộc tính)' });
    const notice = tray.getByRole('status').filter({ hasText: 'Năng lượng đã lệch' });
    await expect(notice).toContainText('Năng lượng đã lệch 3·10⁻⁹ so với lúc đầu');
    await expect(tray.getByText('Định lượng gần đúng')).toBeVisible();
    const reset = notice.getByRole('button', { name: 'Đặt lại để về kết quả chính xác' });
    await expect(reset).toBeVisible();
    // Whole inside the tray: nothing cut at its right edge.
    const trayBox = await tray.boundingBox();
    if (!trayBox) throw new Error('no tray');
    for (const el of [notice, reset]) {
      const b = await el.boundingBox();
      if (!b) throw new Error('no box');
      expect(b.x + b.width).toBeLessThanOrEqual(trayBox.x + trayBox.width + 0.5);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);

    // The whole card says it too.
    await tray.getByRole('button', { name: 'Xem thẻ' }).click();
    await expect(
      page.getByRole('note').filter({ hasText: 'Năng lượng đã lệch 3·10⁻⁹' }),
    ).toBeVisible();

    // The reset runs again from the start: the measured drift is 0, the card exact again.
    await reset.click();
    await expect(notice).toHaveCount(0);
    await expect(tray.getByText('Định lượng chính xác')).toBeVisible();
  });
}
