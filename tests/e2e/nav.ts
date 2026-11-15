import type { Locator, Page } from '@playwright/test';

/**
 * The app starts on the launch page (two entries: "Virtual Lab" and "AI Teacher").
 * Lab tests enter the simulator the way a learner does: by clicking the lab card.
 */
export async function enterLab(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Virtual Lab/ }).click();
}

export async function openLab(page: Page): Promise<void> {
  await page.goto('/');
  await enterLab(page);
}

/**
 * Science Studio lives inside the lab (no launch card since 2026-10-20): its entry is the first
 * button of the lab's topic library.
 */
export async function openStudioFromLab(page: Page): Promise<void> {
  // The bench's "Kệ bài" (B3): guided lessons are the "Có hướng dẫn" kind of lesson.
  if (await isBench(page)) {
    await page
      .getByRole('complementary', { name: 'Thư viện chủ đề' })
      .getByRole('radio', { name: 'Có hướng dẫn' })
      .click();
    return;
  }
  await page
    .getByRole('complementary', { name: 'Thư viện chủ đề' })
    .getByRole('button', { name: /^Science Studio/ })
    .click();
}

/** From the launch page: into the lab, then into Science Studio. */
export async function enterStudio(page: Page): Promise<void> {
  await enterLab(page);
  await openStudioFromLab(page);
}

/** True when the page runs the bench shell (0.8.1 dev switch, `tests/e2e/bench/storage-state.json`). */
export async function isBench(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.dataset.shell === 'bench');
}

/**
 * From the launch page into one topic: lab → subject → topic. The same steps in both shells: the
 * bench library keeps the "Môn học" radios; its topic cards are in the main area.
 */
export async function openTopic(
  page: Page,
  subject: 'Vật lý' | 'Hóa học' | 'Sinh học',
  topic: string | RegExp,
): Promise<void> {
  await openLab(page);
  await page.getByRole('radio', { name: subject }).click();
  // The bench's "Kệ bài" (B3) shows its topic cards in the main area, beside the filter column.
  const shelf = (await isBench(page))
    ? page.getByRole('main')
    : page.getByRole('complementary', { name: 'Thư viện chủ đề' });
  await shelf.getByRole('button', { name: topic, exact: typeof topic === 'string' }).click();
}

/** The problem box: in the classic top bar, behind the header's "Đề bài" button in the bench. */
export async function openProblem(page: Page): Promise<Locator> {
  if (await isBench(page)) await page.getByRole('button', { name: 'Đề bài', exact: true }).click();
  return page.locator('#problem-text');
}
