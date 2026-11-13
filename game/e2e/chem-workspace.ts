import { expect, type Locator, type Page } from '@playwright/test';
import { type Aim, position, use, type Vec3 } from './support';

// Helpers for the Chemistry workspaces in the real app (not a spec file): walk up to the apparatus,
// press E, work its pieces with clicks, leave and be where you stood. The workspace is the DOM
// overlay (`.workspace`); its parts are found by the data attributes the host sets.

/** The open workspace root. */
export const workspace = (page: Page): Locator => page.locator('.workspace');

/** Looks at the apparatus, presses E (the "Work at the bench" action) and waits for the workspace. */
export async function openWorkspace(
  page: Page,
  aim: Aim,
  target: Vec3,
  entityId: string,
  presentation: string,
): Promise<Locator> {
  await use(page, aim, target, entityId, 'Work at the bench');
  const ws = workspace(page);
  await expect(ws).toBeVisible();
  await expect(ws).toHaveAttribute('data-presentation', presentation);
  return ws;
}

/** The library card with this text (a material or a piece of equipment). */
export const libraryItem = (page: Page, text: string | RegExp): Locator =>
  workspace(page).locator('.ws-item', { hasText: text });

/** The button that chooses a piece (what a click on it, with an item in hand, places that item on). */
export const pieceButton = (page: Page, pieceId: string): Locator =>
  workspace(page).locator(`.ws-piece-select[data-piece="${pieceId}"]`);

/** Picks up a library card and puts it on a piece: the click-to-place the library offers. */
export async function place(page: Page, text: string | RegExp, pieceId: string) {
  await libraryItem(page, text).click();
  await pieceButton(page, pieceId).click();
  // What was placed leaves the hand.
  await expect(libraryItem(page, text)).toHaveAttribute('aria-pressed', 'false');
}

/** Opens a piece's callout and picks one of its presets (a radio chip), then puts the callout away. */
export async function choose(page: Page, pieceId: string, preset: string | RegExp) {
  await pieceButton(page, pieceId).click();
  const callout = workspace(page).locator('.ws-callout');
  await expect(callout).toBeVisible();
  await callout.locator('label.ws-chip', { hasText: preset }).click();
  await expect(callout.locator('input:checked + span', { hasText: preset })).toBeVisible();
  await page.keyboard.press('Escape'); // closes the callout, not the workspace
  await expect(callout).toBeHidden();
}

/** The lifecycle bar's buttons. */
export const bar = (page: Page, id: 'run' | 'stop' | 'reset' | 'clear'): Locator =>
  workspace(page).locator(`.ws-command.ws-${id}`);

/** Leaves with the Exit button and checks the player stands where they did. */
export async function exitWorkspace(page: Page, stoodAt: Vec3) {
  await workspace(page).locator('.ws-exit').click();
  await expect(workspace(page)).toBeHidden();
  await page.waitForTimeout(400); // the 4 Hz debug text
  const now = await position(page);
  expect(Math.hypot(now[0] - stoodAt[0], now[2] - stoodAt[2])).toBeLessThan(0.05);
}
