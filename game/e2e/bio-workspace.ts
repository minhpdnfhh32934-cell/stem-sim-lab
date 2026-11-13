import { expect, type Locator, type Page } from '@playwright/test';
import { workspace } from './chem-workspace';

// Helpers for the Biology workspaces in the real app (not a spec file), on top of the generic ones
// in chem-workspace.ts (open, the lifecycle bar, exit). A Biology piece carries its own controls:
// its presets are radio cards inside the piece, its setup steps are buttons inside the piece that
// owns them (the host's library and callouts are the other way to the same commands).

/** A piece of the open workspace, by its id in the definition. */
export const piece = (page: Page, id: string): Locator =>
  workspace(page).locator(`.ws-piece[data-piece="${id}"]`);

/** The card of a preset inside a piece (a radio in a label): `label` is its text, or a pattern. */
export const card = (page: Page, pieceId: string, label: string | RegExp): Locator =>
  piece(page, pieceId).locator('label', { hasText: label });

/** Chooses a preset of a piece by clicking its card, and checks the radio took it. */
export async function pick(page: Page, pieceId: string, label: string | RegExp) {
  const chosen = card(page, pieceId, label);
  await chosen.click();
  await expect(chosen.locator('input')).toBeChecked();
}

/** A setup step's button (inside the piece that owns it). */
export const stepButton = (page: Page, id: string): Locator =>
  workspace(page).locator(`.bio-step[data-step="${id}"]`);

/** Does a setup step by clicking its button; it shows pressed once the station has marked it. */
export async function doStep(page: Page, id: string) {
  const button = stepButton(page, id);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/** Opens the results sheet of the open workspace and returns the existing results panel. */
export async function openNotebookResults(page: Page): Promise<Locator> {
  await workspace(page).locator('.ws-results-button').click();
  const panel = workspace(page).locator('.results-panel');
  await expect(panel).toBeVisible();
  return panel;
}
