import type { Page } from '@playwright/test';
import { expectDebug, labSave, type Vec3, menuContinue } from './support';

// Saves of any world scene, in the one format labSave writes (support.ts), and Continue into them
// through the game's own load path, no developer jump. Not a spec file.

/** labSave with its scene id set: a player in `sceneId` at `stand` looking at `look`. */
export function sceneSave(sceneId: string, stand: Vec3, look: Vec3, entityStates?: object) {
  const save = labSave(stand, look, entityStates);
  return { ...save, player: { ...save.player, sceneId } };
}

/**
 * continueFrom (support.ts) for a save of any scene: it waits for the save's scene instead of the
 * Physics Lab. Returns the list console errors land in.
 */
export async function continueInto(
  page: Page,
  save: ReturnType<typeof sceneSave>,
): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(save) },
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Scene', save.player.sceneId);
  await expectDebug(page, 'Phase', 'playing');
  return errors;
}
