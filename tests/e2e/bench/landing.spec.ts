import { expect, test } from '@playwright/test';

/**
 * #205 B1: "Cửa vào" says what AI Teacher does on its door; "AI Teacher là một AI nên có thể sai."
 * is a note under the doors with the privacy line; a first visit fits 1366 × 768 at 100 % and
 * 140 %, nothing cut at the bottom, no scrolling either way. With "Tiếp tục" (a returning learner)
 * 140 % may scroll down a little, never sideways.
 */
for (const fontScale of [1, 1.4] as const) {
  test(`the launch page fits 1366 × 768 at ${String(fontScale * 100)} %, the AI note under the doors`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
    }, fontScale);
    await page.goto('/');
    const teacher = page.getByRole('button', { name: /AI Teacher/ });
    await expect(teacher).toContainText('Hỏi bài và xem giảng từng bước trên bảng');
    await expect(teacher).not.toContainText('có thể sai');
    const note = page.getByText('AI Teacher là một AI nên có thể sai.');
    const privacy = page.getByText('Em chọn khi nào chia sẻ ngữ cảnh màn hình');
    for (const line of [note, privacy]) {
      await expect(line).toBeVisible();
      const box = await line.boundingBox();
      if (!box) throw new Error('no box');
      expect(box.y + box.height).toBeLessThanOrEqual(768);
    }
    // The note comes after the doors.
    const doorBox = await teacher.boundingBox();
    const noteBox = await note.boundingBox();
    expect((noteBox?.y ?? 0) > (doorBox?.y ?? 0) + (doorBox?.height ?? 0)).toBe(true);
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(overflow).toEqual({ x: 0, y: 0 });
  });
}

for (const fontScale of [1, 1.4] as const) {
  test(`a returning learner's launch page at ${String(fontScale * 100)} %: "Tiếp tục" and the notes reachable, no sideways scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript((scale) => {
      localStorage.setItem(
        'stemsim.settings',
        JSON.stringify({ state: { locale: 'vi', fontScale: scale }, version: 2 }),
      );
      localStorage.setItem(
        'stemsim.profile',
        JSON.stringify({
          state: {
            level: 'foundation',
            grade: 'all',
            interests: [],
            lastTopic: 'obliqueProjectile',
          },
          version: 2,
        }),
      );
    }, fontScale);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Tiếp tục: Ném xiên (Vật lý)' })).toBeVisible();
    const privacy = page.getByText('Em chọn khi nào chia sẻ ngữ cảnh màn hình');
    await privacy.scrollIntoViewIfNeeded();
    await expect(privacy).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (fontScale === 1) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
        ),
      ).toBe(0);
    }
  });
}
