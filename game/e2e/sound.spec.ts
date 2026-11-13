import { expect, test } from '@playwright/test';
import { expectDebug, newGame, settingsSection } from './support';

// The game's sound (Phase S): the engine comes with the first click, plays nothing it was not
// asked to, and fetches nothing from outside the game; the music is written as it plays. This checks that sounds start (the debug
// panel counts them); whether they sound right is Phú's QA by ear.

test('sound: starts at the first click, settings kept, steps and the room’s air in the world', async ({
  page,
}) => {
  const errors = await newGame(page); // its click is the first gesture: the engine comes with it
  await expectDebug(page, 'Sound', 'running, [0-9]+ playing, [0-9]+ started, last .*, air-quiet');
  await expectDebug(page, 'Sound', '.* · music lab'); // the labs' music in the world

  // Walking: footsteps on the preparation room's vinyl.
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  await expectDebug(page, 'Sound', 'running, [0-9]+ playing, [0-9]+ started, last step-vinyl');
  const started = Number(
    /(\d+) started/.exec((await page.locator('.debug-text').textContent()) ?? '')?.[1],
  );
  expect(started).toBeGreaterThanOrEqual(3);

  // The settings: a slider per volume, kept for the next visit, outside the save.
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'sound');
  const room = page.getByRole('slider', { name: 'Room sound' });
  await expect(room).toHaveValue('70');
  await expect(page.getByRole('slider', { name: 'Music' })).toHaveValue('70');
  await expectDebug(page, 'Sound', '.* · music lab'); // through a pause too
  await room.fill('35');
  await page.getByLabel('Mute').check();
  expect(
    await page.evaluate(() => [
      localStorage.getItem('simlab.settings.volume.room'),
      localStorage.getItem('simlab.settings.muted'),
    ]),
  ).toEqual(['35', 'true']);

  // Every sound file came from the game itself.
  const fetched = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  );
  const origin = new URL(page.url()).origin;
  expect(fetched.filter((url) => url.includes('/audio/')).length).toBeGreaterThan(0);
  expect(fetched.filter((url) => !url.startsWith(origin) && !url.startsWith('data:'))).toEqual([]);
  expect(errors).toEqual([]);
});
