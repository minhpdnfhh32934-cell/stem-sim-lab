import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  doorsClosed,
  expectDebug,
  labSave,
  type Vec3,
  walkThrough,
  walkToDoor,
  menuContinue,
} from './support';

// Walk-through doors in the real app (Z1 §8, e2e): from the hub into each laboratory and back,
// and through the clean-area entrance and back, walking — no teleport: the campus position goes
// steadily on at the debug panel's 4 Hz (walking speed × the time between samples, at most 1 m a
// sample, never back), the view untouched, the scene switching on the way. Each door closes
// behind the player and the scene left goes. The player is put in place by Continue from a save
// (the game's own load path, no developer jump).
// The Preparation Room ⇄ Teacher Room pair: transitions.spec.ts.

interface Save {
  scene: string;
  stand: Vec3;
  look: Vec3;
  equipment?: string[];
  procedures?: Record<string, { completed: string[]; entered: boolean }>;
}

async function continueAt(page: Page, { scene, stand, look, equipment, procedures }: Save) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  const base = labSave(stand, look); // the current version: no migration moves the player
  const save = {
    ...base,
    player: { ...base.player, sceneId: scene, equipment: equipment ?? [] },
    progression: { ...base.progression, procedures: procedures ?? {} },
  };
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: 'simlab.save.slot-1', value: JSON.stringify(save) },
  );
  await page.goto('/');
  await menuContinue(page);
  await expectDebug(page, 'Scene', scene);
  await expectDebug(page, 'Phase', 'playing');
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = [base.player.yaw, base.player.pitch];
  return { errors, aim };
}

// The hub (x −13 … 13, z −12 … 6) and its doors; each laboratory's door back (its own coordinates).
const LABS = [
  {
    lab: 'physics-lab',
    hubDoor: {
      id: 'simlab-hub/door-physics',
      at: [12.95, 1.05, -3] as Vec3,
      label: 'Enter Physics Lab',
    },
    stand: [11.45, 0, -3] as Vec3,
    inLab: (p: Vec3) => p[0] > -2.55, // 2.4 m past its door at x −4.95
    labDoor: { id: 'physics-lab/door-hub', at: [-4.95, 1.05, 0] as Vec3 },
    inHub: (p: Vec3) => p[0] < 10.55,
  },
  {
    lab: 'biology-lab',
    hubDoor: {
      id: 'simlab-hub/door-biology',
      at: [-12.95, 1.05, -3] as Vec3,
      label: 'Enter Biology Lab',
    },
    stand: [-11.45, 0, -3] as Vec3,
    inLab: (p: Vec3) => p[0] < 2.55,
    labDoor: { id: 'biology-lab/door-hub', at: [4.95, 1.05, 0] as Vec3 },
    inHub: (p: Vec3) => p[0] > -10.55,
  },
  {
    lab: 'chemistry-lab',
    hubDoor: {
      id: 'simlab-hub/door-chemistry',
      at: [0, 1.05, -11.95] as Vec3,
      label: 'Enter Chemistry Lab',
    },
    stand: [0, 0, -10.45] as Vec3,
    inLab: (p: Vec3) => p[2] < 1.55,
    labDoor: { id: 'chemistry-lab/door-hub', at: [0, 1.05, 3.95] as Vec3 },
    inHub: (p: Vec3) => p[2] > -9.55,
  },
];

for (const { lab, hubDoor, stand, inLab, labDoor, inHub } of LABS) {
  test(`hub → ${lab} → hub, walking through its door both ways`, async ({ page }) => {
    test.setTimeout(180_000);
    const { errors, aim } = await continueAt(page, {
      scene: 'simlab-hub',
      stand,
      look: hubDoor.at,
    });
    await expectDebug(page, 'Focus', hubDoor.id);
    await expectDebug(page, 'Doors', '—');
    await page.screenshot({ path: `test-results/doors-${lab}-closed.png` });

    const there = await walkThrough(page, { label: hubDoor.label, to: lab, done: inLab });
    expect(there.length).toBeGreaterThan(4); // sampled all the way through
    await page.screenshot({ path: `test-results/doors-${lab}-inside.png` });
    await doorsClosed(page, lab);
    await expectDebug(page, 'Room', `${lab}  grounded`);

    await walkToDoor(page, aim, labDoor.at, labDoor.id);
    await walkThrough(page, { label: 'Back to SIMLAB Hub', to: 'simlab-hub', done: inHub });
    await doorsClosed(page, 'simlab-hub');
    await expectDebug(page, 'Room', 'simlab-hub  grounded');
    expect(errors).toEqual([]);
  });
}

test('the clean-area entrance: prepared, through into the hub and back into the corridor', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const procedures = JSON.parse(readFileSync('src/content/procedures.json', 'utf8')) as {
    id: string;
    steps: { id: string }[];
    requiredEquipment: string[];
  }[];
  const entry = procedures[0]!;
  const { errors, aim } = await continueAt(page, {
    scene: 'preparation-room',
    stand: [0, 0, -9.7], // in the corridor, 1.5 m before its door to the hub
    look: [0, 1.05, -11.2],
    equipment: entry.requiredEquipment,
    procedures: { [entry.id]: { completed: entry.steps.map((s) => s.id), entered: false } },
  });
  await expectDebug(page, 'Procedure', 'cleanroom-entry ready 15/15');
  await expectDebug(page, 'Focus', 'cleanroom-corridor/door-hub');
  await walkThrough(page, {
    label: 'Enter the clean area (SIMLAB Hub)',
    to: 'simlab-hub',
    done: (p) => p[2] < 3.45,
  });
  await expectDebug(page, 'Procedure', '—'); // no procedure in the hub
  await doorsClosed(page, 'simlab-hub');

  await walkToDoor(page, aim, [0, 1.05, 5.95], 'simlab-hub/door-preparation');
  await walkThrough(page, {
    label: 'Back to Preparation Room',
    to: 'preparation-room',
    done: (p) => p[2] > -8.75,
  });
  await doorsClosed(page, 'preparation-room');
  await expectDebug(page, 'Procedure', 'cleanroom-entry entered 15/15');
  expect(errors).toEqual([]);
});
