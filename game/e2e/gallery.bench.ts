import { expect, test } from '@playwright/test';
import { menuContinue } from './support';
import { readFileSync } from 'node:fs';
import { sceneSave } from './saves';
import type { Vec3 } from './support';

// A picture of every experiment's apparatus, from 2 m in front of it, on the real GPU (GALLERY=1
// npm run bench -- --project=gpu -g gallery): a clarity review of the stations, not a test.

const SCENE_OF: Record<string, string> = {
  'physics-lab': 'physics-lab',
  'projectile-range': 'physics-lab',
  'pendulum-bay': 'physics-lab',
  'waves-optics': 'physics-lab',
  'chemistry-lab': 'chemistry-lab',
  'chemistry-annex': 'chemistry-lab',
  'biology-annex': 'biology-lab',
  'biology-lab': 'biology-lab',
};

interface Placement {
  id: string;
  position: number[];
  rotationY?: number;
  params?: { experimentId?: string };
}

const placements: unknown = JSON.parse(readFileSync('src/content/lab-placements.json', 'utf8'));
const stations = (placements as { room: string; placements: Placement[] }[]).flatMap((g) =>
  g.placements
    .filter((p) => p.params?.experimentId)
    .map((p) => ({ room: g.room, ...p, experiment: p.params?.experimentId ?? '' })),
);

test.skip(!process.env.GALLERY, 'GALLERY=1 to take the pictures');

const only = process.env.GALLERY_ONLY ? new RegExp(process.env.GALLERY_ONLY) : null;
for (const s of stations.filter((x) => !only || only.test(x.experiment))) {
  test(`gallery ${s.experiment}`, async ({ page }) => {
    const scene = SCENE_OF[s.room];
    if (!scene) throw new Error(`no scene for ${s.room}`);
    const turn = s.rotationY ?? 0;
    const [x, , z] = s.position as [number, number, number];
    const far = Number(process.env.GALLERY_M ?? 2.2);
    const stand: Vec3 = [x + Math.sin(turn) * far, 0, z + Math.cos(turn) * far];
    const look: Vec3 = [x, 1.15, z];
    await page.addInitScript(() => {
      localStorage.setItem('simlab.settings.graphicsQuality', 'high');
    });
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: 'simlab.save.slot-1',
      value: JSON.stringify(sceneSave(scene, stand, look)),
    });
    await page.goto('/');
    await menuContinue(page);
    await expect(page.locator('.hud-hotbar, .hotbar').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(5000); // the lab pack in, shaders compiled, screens painted
    // GALLERY_EXPLAIN=1: the Explain view opened (H), the camera's glide done.
    if (process.env.GALLERY_EXPLAIN) {
      await page.keyboard.press('h');
      await expect(page.locator('.explain-panel')).toBeVisible();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: test.info().outputPath(`${s.experiment}.png`) });
  });
}
