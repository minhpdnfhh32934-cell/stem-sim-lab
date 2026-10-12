import type { Page } from '@playwright/test';

/**
 * The app starts on the launch page (two entries: "Phòng thí nghiệm" and "Thầy AI").
 * Lab tests enter the simulator the way a learner does: by clicking the lab card.
 */
export async function enterLab(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Phòng thí nghiệm/ }).click();
}

export async function openLab(page: Page): Promise<void> {
  await page.goto('/');
  await enterLab(page);
}
