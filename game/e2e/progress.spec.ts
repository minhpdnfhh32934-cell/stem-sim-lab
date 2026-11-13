import { expect, type Page, test } from '@playwright/test';
import {
  afterFrame,
  Aim,
  continueFrom,
  expectDebug,
  labSave,
  use,
  type Vec3,
  menuContinue,
} from './support';

// Phase P2 in the real app: a Hooke's law run that ends by itself is saved as completed when it
// ends — the save in storage says so before any reload — and the catalog and Continue still say
// so after one; a stopped run, or one left running for the main menu, is never completed.

const LAB = 'physics-lab';
const RUN: Vec3 = [12.667, 0.875, -5.9];
const STOP: Vec3 = [12.917, 0.875, -5.9];
const SAVE = labSave([12.417, 0, -5.35], RUN); // at the spring desk, looking at RUN

/** The completed experiments of the save in storage, as it is now (not the game's memory). */
const savedCompletions = (page: Page) =>
  page.evaluate(() => {
    const text = localStorage.getItem('simlab.save.slot-1');
    return text === null
      ? null
      : (JSON.parse(text) as { progression: { completedExperiments: string[] } }).progression
          .completedExperiments;
  });

/** RUN at the spring desk (already in view), read by the game. */
async function run(page: Page) {
  await expectDebug(page, 'Focus', `${LAB}/spring-run`);
  await page.keyboard.press('e');
  await afterFrame(page);
  await expect(page.locator('.debug-text')).toContainText(/Station:\s+physics-lab\/spring running/);
}

/** The catalog's mark for Hooke's law, from the menu (opened and closed again). */
async function catalogMark(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  const mark = await page
    .locator('.menu-catalog-item[data-experiment="hookes-law"] .menu-run')
    .textContent();
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  return mark ?? '';
}

test('a run that ends by itself is saved as completed when it ends, and survives a reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await continueFrom(page, SAVE);
  expect(await savedCompletions(page)).toEqual([]);
  await run(page);
  // The model ends it (at rest): completed — and in storage now, with no door and no reload.
  await expect(page.locator('.debug-text')).toContainText(
    /Station:\s+physics-lab\/spring completed /,
    { timeout: 120_000 },
  );
  await expect.poll(() => savedCompletions(page)).toEqual(['hookes-law']);

  await page.reload();
  expect(await catalogMark(page)).toBe('Run completed');
  await menuContinue(page);
  await expectDebug(page, 'Scene', LAB);
  await expectDebug(page, 'Completed', 'hookes-law');
  expect(errors).toEqual([]);
});

test('a stopped run is not completed, before or after a reload', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await continueFrom(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await run(page);
  await use(page, aim, STOP, `${LAB}/spring-stop`, 'STOP');
  await expect(page.locator('.debug-text')).toContainText(/Station:\s+physics-lab\/spring stopped/);
  expect(await savedCompletions(page)).toEqual([]);

  await page.reload(); // leaving the page saves too: still nothing completed
  expect(await savedCompletions(page)).toEqual([]);
  expect(await catalogMark(page)).toBe('Not yet run to the end');
  expect(errors).toEqual([]);
});

test('a run left running for the main menu is not completed', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await continueFrom(page, SAVE);
  await run(page);
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await page.getByRole('button', { name: 'Save and go to the main menu' }).click();
  await expectDebug(page, 'Phase', 'menu');
  expect(await savedCompletions(page)).toEqual([]);

  await page.reload();
  expect(await catalogMark(page)).toBe('Not yet run to the end');
  await menuContinue(page);
  await expectDebug(page, 'Scene', LAB);
  await expectDebug(page, 'Completed', '—');
  await expectDebug(page, 'Station', `${LAB}/spring configured `); // no run came back
  expect(errors).toEqual([]);
});
