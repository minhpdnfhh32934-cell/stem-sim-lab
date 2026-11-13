import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { afterFrame, EYE_HEIGHT, type Vec3 } from './support';
import { countWebGL, webglCounts, type WebGLCounts } from './webgl';

// Draw calls and live WebGL objects at named views, in the real app: Continue (no developer jump)
// from a save standing at the view, under a graphics quality written before load where Settings
// keeps it. 10 frames after the scene shows, it reads the page canvas's live GL objects by kind
// and one frame's draw calls, shadow pass included (webgl.ts); 10 frames later it reads again, and
// the two must be equal. No absolute number is asserted: the first reading is the view's baseline,
// an annotation and a stdout line with the project and the WebGL renderer (SwiftShader here:
// counts only, never timings or GPU numbers). The first reading is taken once the counts hold
// for 10 frames (background compiles done). One test per view and quality, each with a fresh
// page and storage: nothing is shared or cleaned up.

interface View {
  scene: string;
  name: string;
  stand: Vec3;
  look: Vec3;
}

const content = (file: string) =>
  JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8')) as unknown;
const scenes = content('scenes.json') as {
  id: string;
  kind: string;
  spawn?: { position: Vec3; yaw?: number }; // every world scene has one, yaw 0 by default
}[];

/** Each world scene at its spawn, looking along the spawn yaw at eye level (yaw 0 faces −Z). */
const SPAWNS = scenes.flatMap(({ id, kind, spawn }): View[] => {
  if (kind !== 'world' || !spawn) return [];
  const [x, y, z] = spawn.position;
  const yaw = spawn.yaw ?? 0;
  const look: Vec3 = [x - Math.sin(yaw), y + EYE_HEIGHT, z - Math.cos(yaw)];
  return [{ scene: id, name: 'spawn', stand: spawn.position, look }];
});
const LAB = 'physics-lab';
/** Down the projectile lane from its desk: the bench's idle view, without its launcher setup. */
const RANGE_LANE: View = {
  scene: LAB,
  name: 'range-lane',
  stand: [-1.2, 0, 13.1],
  look: [7, 2.4, 11.75],
};
const PENDULUM: View = {
  scene: LAB,
  name: 'pendulum',
  stand: [2.4, 0, -8.4],
  look: [0, 2.4, -12.1],
};
const LAB_CEILING: View = {
  scene: LAB,
  name: 'lab-ceiling',
  stand: [3.967, 0, 0],
  look: [1.933, 2.4, 7.5],
};
const BAY_WALL: View = { scene: LAB, name: 'bay-wall', stand: [0, 0, -8.7], look: [0, 2.2, -13.5] };

/** The views measured under each graphics quality, keyed by the value Settings stores. */
const VIEWS = {
  medium: [...SPAWNS, RANGE_LANE, PENDULUM],
  low: [LAB_CEILING, BAY_WALL, RANGE_LANE],
  high: [LAB_CEILING, BAY_WALL, RANGE_LANE],
};

/** At least 10 display frames (afterFrame waits two). */
async function tenFrames(page: Page) {
  for (let i = 0; i < 5; i++) await afterFrame(page);
}

const counts = ({ live, draws, elsewhere }: WebGLCounts) => ({ draws, ...live, elsewhere });

for (const [quality, views] of Object.entries(VIEWS)) {
  for (const view of views) {
    const label = `${view.scene}/${view.name} ${quality}`;
    test(`draw calls: ${label}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.addInitScript(countWebGL);
      await page.addInitScript(
        (value) => localStorage.setItem('simlab.settings.graphicsQuality', value),
        quality,
      );
      const errors = await continueInto(page, sceneSave(view.scene, view.stand, view.look));
      // The game read the quality: a stored value it rejects falls back to medium.
      await expect(page.locator('.debug-text')).toContainText(`graphics ${quality})`);
      await tenFrames(page);
      // The load's hidden parts compile in the background, left alone while the GPU process links
      // them (compileOnly): their shaders are freed a second or two after the scene shows. The
      // baseline is the first reading that holds for 10 frames; one that keeps changing (a leak)
      // never does and times out.
      let first = await webglCounts(page);
      await expect
        .poll(
          async () => {
            await tenFrames(page);
            const now = await webglCounts(page);
            const same = JSON.stringify(counts(now)) === JSON.stringify(counts(first));
            first = now;
            return same;
          },
          { timeout: 30_000 },
        )
        .toBe(true);
      const values = Object.entries(counts(first)).map(([name, n]) => `${name}=${n}`);
      const line = `[${test.info().project.name}] ${first.renderer} | ${label} ${values.join(' ')}`;
      test.info().annotations.push({ type: 'draw-calls', description: line });
      process.stdout.write(`${line}\n`);
      await tenFrames(page);
      const again = await webglCounts(page);
      expect(counts(again), `${label}: still changing 10 frames later`).toEqual(counts(first));
      expect(errors).toEqual([]);
    });
  }
}
