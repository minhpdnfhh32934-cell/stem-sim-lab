import { expect, test, type Page } from '@playwright/test';

/**
 * #205 B5, the AI Teacher room at 1366 × 768, 100 % and 140 %: one title (the header's h1 "AI
 * Teacher"; the page and the chat panel no longer repeat it); no bar repeating "Chưa kết nối", the
 * empty conversation offers "Kết nối AI" instead; "Think" reads "Deepthink" (user decision 14/11/2026); the face
 * column is narrower, so the conversation is wider.
 */
async function openTeacherRoom(page: Page, fontScale: number) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((scale) => {
    localStorage.setItem(
      'stemsim.settings',
      JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
    );
  }, fontScale);
  await page.goto('/');
  await page.locator('.launch-card--teacher').click();
  await expect(page.getByRole('region', { name: 'Dạy học bằng AI' })).toBeVisible({
    timeout: 20_000,
  });
}

for (const fontScale of [1, 1.4] as const) {
  test(`AI Teacher at ${String(fontScale * 100)} %: one title, "Kết nối AI", "Deepthink", a wider chat`, async ({
    page,
  }) => {
    await openTeacherRoom(page, fontScale);
    const room = page.getByRole('region', { name: 'Dạy học bằng AI' });
    // One title: the header's h1; nothing in the room repeats "AI Teacher" or "Dạy học bằng AI".
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI Teacher');
    await expect(room.getByText('AI Teacher', { exact: true })).toHaveCount(0);
    await expect(room.getByText('Dạy học bằng AI', { exact: true })).toHaveCount(0);

    // Not connected: no notice bar; the empty conversation's button opens Kết nối AI.
    await expect(room.getByText(/Chưa kết nối AI/)).toHaveCount(0);
    await room.getByRole('button', { name: 'Kết nối AI' }).click();
    const settings = page.getByRole('dialog', { name: 'Cài đặt' });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('tab', { name: 'Kết nối AI', selected: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(room.getByRole('button', { name: /Deepthink/ })).toBeVisible();

    // The conversation takes at least 70 % of the room's width (the face column was 30 %).
    const chat = await room.getByRole('main').boundingBox();
    const whole = await room.boundingBox();
    expect((chat?.width ?? 0) / (whole?.width ?? 1)).toBeGreaterThanOrEqual(0.7);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });
}
