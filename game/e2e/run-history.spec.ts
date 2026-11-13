import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  AT_DESK,
  AT_MONITOR,
  continueFrom,
  dial,
  expectDebug,
  expectStation,
  exportRun,
  freeMouse,
  labSave,
  openResults,
  PROJECTILE_TARGETS as T,
  projectileTheory,
  RANGE,
  use,
  menuNewGame,
  menuContinue,
} from './support';

// Phase P2b in the real app: ended runs are kept in the browser's run history (IndexedDB, its
// own database, apart from the save in localStorage). Two projectile runs survive a reload and
// Continue — listed once each, compared with their own theory, exported to the same CSV — a new
// run is numbered after them, and New game keeps them. With the history store failing, the run
// is reported as not kept and the completion is still saved. Rendering is software WebGL.

const RANGE_SAVE = labSave([AT_DESK.x, 0, AT_DESK.z], T.dialVelocity, {
  [`${RANGE}/launcher`]: { loaded: `${RANGE}/ball-2` },
});
const LAUNCHER = `${RANGE}/launcher`;

/** What the run history database holds now, read by the page itself (not the game's memory). */
const storedRuns = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ version: number; stores: string[]; keyPath: unknown; ids: string[] }>(
        (resolve, reject) => {
          const open = indexedDB.open('simlab.history');
          open.onerror = () => reject(open.error ?? new Error('open failed'));
          open.onsuccess = () => {
            const db = open.result;
            const runs = db.transaction('runs').objectStore('runs');
            const keys = runs.getAllKeys();
            keys.onerror = () => reject(keys.error ?? new Error('read failed'));
            keys.onsuccess = () => {
              resolve({
                version: db.version,
                stores: [...db.objectStoreNames],
                keyPath: runs.keyPath,
                ids: keys.result.map(String).sort(),
              });
              db.close();
            };
          };
        },
      ),
  );
const ids = (...n: number[]) => n.map((i) => `${LAUNCHER}#${i}`).sort();
const savedText = (page: Page) => page.evaluate(() => localStorage.getItem('simlab.save.slot-1'));

async function reloadAndContinue(page: Page, aim: Aim) {
  await page.reload();
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'physics-lab');
  await expectDebug(page, 'Phase', 'playing');
  await aim.sync();
}

test('two runs survive a reload: listed once, compared, exported the same; numbering goes on', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await continueFrom(page, RANGE_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  const first = projectileTheory(8, 45, 9.81);
  const second = projectileTheory(8, 30, 9.81);

  // Run 1 at 45°, run 2 at 30°.
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, LAUNCHER, `completed .* range=${first.range.toFixed(3)} `);
  await dial(page, aim, T.dialAngle, `${RANGE}/dial-angle`, 'f', 3);
  await use(page, aim, T.reset, `${RANGE}/button-reset`, 'RESET');
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, LAUNCHER, `completed .*angle=30 .* range=${second.range.toFixed(3)} `);

  // In the history database (its own, version 1, one store keyed by run id), not in the save.
  await expect.poll(async () => (await storedRuns(page)).ids).toEqual(ids(1, 2));
  expect(await storedRuns(page)).toMatchObject({ version: 1, stores: ['runs'], keyPath: 'runId' });
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  let panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  const csv = await exportRun(page, panel, 1);

  // Reload and Continue: both back, once each, newest first, neither current.
  await reloadAndContinue(page, aim);
  const save = (await savedText(page)) ?? '';
  expect(save).not.toContain('sampleTimes');
  expect(save.length).toBeLessThan(10_000); // the save stays small: no run data in it
  panel = await openResults(page, aim, T.monitor, `${RANGE}/monitor`);
  const rows = panel.locator('li.results-run[data-run]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('#2 · v₀ 8 m/s · θ 30 ° · g Earth');
  await expect(rows.nth(1)).toContainText('#1 · v₀ 8 m/s · θ 45 ° · g Earth');
  await expect(rows.nth(0)).not.toHaveAttribute('aria-current', 'true');
  expect((await storedRuns(page)).ids).toEqual(ids(1, 2)); // loading wrote nothing back

  // Compared after the reload: each with its own measured range and theory.
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  await panel.getByRole('checkbox', { name: 'Select run 2' }).check();
  await expect(panel.locator('h2')).toContainText('comparing runs #1, #2');
  const marks = panel.locator('svg[data-compare="trajectory"] line.mark');
  expect(Number(await marks.nth(0).getAttribute('data-value'))).toBeCloseTo(first.range, 9);
  expect(Number(await marks.nth(1).getAttribute('data-value'))).toBeCloseTo(second.range, 9);
  const compared = panel.locator('table.results-compare tr[data-result="range"] td');
  await expect(compared.nth(0)).toContainText(`theory ${first.range.toFixed(3)} m`);
  await expect(compared.nth(1)).toContainText(`theory ${second.range.toFixed(3)} m`);

  // The CSV of run 1 after the reload is the file it gave before, byte for byte.
  const again = await exportRun(page, panel, 1);
  expect(again.name).toBe(csv.name);
  expect(again.text).toBe(csv.text);

  // A new run is #3: no id is reused, nothing is duplicated.
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await expect(panel).toBeHidden();
  await approach(page, aim, -3.6, 10.4);
  await use(page, aim, [-3.85, 0.83, 9.5], `${RANGE}/ball-1`, 'Grab');
  await expectDebug(page, 'Holding', `${RANGE}/ball-1`);
  await approach(page, aim, -2.1, 11.75);
  await use(page, aim, T.launcher, LAUNCHER, 'Load into the launcher');
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, LAUNCHER, 'completed ');
  await expect.poll(async () => (await storedRuns(page)).ids).toEqual(ids(1, 2, 3));

  // New game: a new playthrough, the run history stays (it belongs to the browser).
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await expectDebug(page, 'Phase', 'menu');
  await menuNewGame(page);
  await expectDebug(page, 'Phase', 'playing');
  expect((await storedRuns(page)).ids).toEqual(ids(1, 2, 3));
  expect(errors).toEqual([]);
});

test('with the history store failing, the run is reported as not kept and the completion is saved', async ({
  page,
}) => {
  test.setTimeout(240_000);
  // Every write to the run history fails as a full disk would; localStorage works.
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });
  const errors = await continueFrom(page, RANGE_SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, LAUNCHER, 'completed ');
  await expect(page.locator('.hud-toast.error').last()).toContainText(
    'The run history could not be kept (The quota has been exceeded.)',
  );
  // The progression save does not depend on it: completed, in storage, before any reload.
  await expect
    .poll(async () => {
      const save = JSON.parse((await savedText(page)) ?? '{}') as {
        progression?: { completedExperiments: string[] };
      };
      return save.progression?.completedExperiments;
    })
    .toEqual(['projectile-motion']);

  await reloadAndContinue(page, aim);
  await expectDebug(page, 'Completed', 'projectile-motion');
  // The run was not kept, and is not shown as if it had been.
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  await aim.at(T.monitor);
  await expect(page.locator('.hud-prompt')).toContainText(
    'No results yet: run the experiment first.',
  );
  expect(errors).toEqual([]);
});
