import { expect, type Page, test } from '@playwright/test';
import { continueFrom, expectDebug, labSave, settingsSection } from './support';

// The browser grants pointer lock some time after the game asks for it. A grant that arrives after
// play stopped (Esc while the request was pending) must be given back at once, so the pause menu
// keeps the mouse; a grant while playing is kept. The browser's pointer lock is replaced here by a
// stand-in whose grant the test makes, so the race happens on purpose, not by chance.

/** A pointer lock that is only granted when the test says so, with a log of what happened. */
async function holdPointerLockGrants(page: Page) {
  await page.addInitScript(() => {
    let locked: Element | null = null;
    let pending: { element: Element; resolve: () => void } | null = null;
    const log: string[] = [];
    Object.defineProperty(Document.prototype, 'pointerLockElement', {
      configurable: true,
      get: () => locked,
    });
    Element.prototype.requestPointerLock = function (this: Element) {
      log.push('request');
      return new Promise<void>((resolve) => (pending = { element: this, resolve }));
    };
    Document.prototype.exitPointerLock = function () {
      log.push('exit');
      locked = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    Object.assign(window, {
      pointerLog: log,
      grantPointerLock: () => {
        if (!pending) return false;
        log.push('grant');
        locked = pending.element;
        pending.resolve();
        pending = null;
        document.dispatchEvent(new Event('pointerlockchange'));
        return true;
      },
    });
  });
}

interface PointerProbe {
  pointerLog: string[];
  grantPointerLock: () => boolean;
}
const pointer = (page: Page) =>
  page.evaluate(() => ({
    log: [...(window as unknown as PointerProbe).pointerLog],
    lockedOn: document.pointerLockElement?.className ?? null,
  }));
const grant = (page: Page) =>
  page.evaluate(() => (window as unknown as PointerProbe).grantPointerLock());

test('pointer lock: a grant that arrives after pausing is given back at once; one while playing is kept', async ({
  page,
}) => {
  await holdPointerLockGrants(page);
  const errors = await continueFrom(page, labSave([12.417, 0, -5.35], [12.667, 0.875, -5.9]));

  // Entering the world asked for the mouse; the browser has not granted it yet. Esc pauses.
  await expect.poll(async () => (await pointer(page)).log).toEqual(['request']);
  await page.keyboard.press('Escape');
  await expectDebug(page, 'Phase', 'playing · paused');

  // The grant arrives now, after the pause: the game gives the mouse back at once.
  expect(await grant(page)).toBe(true);
  expect(await pointer(page)).toEqual({ log: ['request', 'grant', 'exit'], lockedOn: null });
  await expectDebug(page, 'Phase', 'playing · paused');

  // The pause menu has the mouse: Settings opens, and Back returns to it.
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'graphics');
  await expect(page.getByRole('group', { name: 'FPS limit' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  // Resume asks again; a grant while playing is kept.
  await page.getByRole('button', { name: 'Resume' }).click();
  await expectDebug(page, 'Phase', 'playing');
  await expect
    .poll(async () => (await pointer(page)).log)
    .toEqual(['request', 'grant', 'exit', 'request']);
  expect(await grant(page)).toBe(true);
  expect(await pointer(page)).toEqual({
    log: ['request', 'grant', 'exit', 'request', 'grant'],
    lockedOn: 'viewport',
  });
  await expectDebug(page, 'Phase', 'playing');
  expect(errors).toEqual([]);
});
