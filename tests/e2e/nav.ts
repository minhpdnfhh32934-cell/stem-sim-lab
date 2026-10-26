import type { Page } from '@playwright/test';

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
