import { expect, type Page, test } from '@playwright/test';
import {
  afterFrame,
  Aim,
  continueFrom,
  expectDebug,
  labSave,
  lookAngles,
  PROJECTILE_TARGETS as T,
  type Vec3,
  walkThrough,
  walkToDoor,
  doorsClosed,
} from './support';
import { countWebGL, webglCounts } from './webgl';

// GPU resources over real door round trips, in the real app, no developer scene jump: Continue
// from a save standing at the Physics Lab's arrival point, facing its hub door, then lab → hub →
// lab walking through the doors: trips 0 and 1 warm up, then the measured trips. At each arrival,
// once the door behind has closed and before any turn, it reads the page canvas's live WebGL
// objects by kind and one frame's draw calls (webgl.ts), and bodies, colliders and listeners from
// the dev panel; 10 frames later it reads again, and the two must be equal. Trip 2 is the baseline:
// every later trip must repeat it exactly (no tolerance: a leak of 5 buffers a trip was found this
// way before, P3.6) — all but the draw calls of the frame read and three's vertex-array and
// program caches, which depend on what was drawn in which view: a walk ends a little off where the
// last one did (not at an arrival point, as a teleport did). Before reading, the player looks all
// round, so every object of the scene has been drawn and has its buffers. No absolute
// number is asserted; each reading is an annotation and a stdout line with the project and the
// WebGL renderer (SwiftShader here: counts only, never timings or GPU numbers).
//
// The trips walk through the doors (no load): the hub is attached when the lab door opens, the lab
// released once that door has closed behind the player (SceneManager.release: its entities
// despawned, SceneDetached → its room shells and their materials freed), and the reading is taken
// then, standing, the other scene gone. The rest of this note is what a load (the Continue) frees:
// SceneLoading → prepareWorld (awaited) → unloadCurrent:
// World.clear despawns every entity (EntityDespawned → WorldRenderer.removeEntity frees its
// material, apparatus model, water stream, labels with their textures, screens and rigs) →
// SceneUnloaded (clearRooms: slabs and room materials; ExperimentView.clearStations: trail, marker
// and tape) → spawn → arrival pose → SceneLoaded (lighting, rooms built). three makes the new
// scene's GL objects in the frames that first draw them. What may stay for the renderer's life,
// filled during the warm-up: the geometry cache, control shapes, trim material, hands, the sun's
// shadow map and three's own internals. Programs are reference-counted: freed with their last
// material and compiled again on the next visit, so their count repeats too. Each test has a
// fresh page and storage: nothing to clean up.

const STAND: Vec3 = [-3.95, 0, 0]; // the lab's arrival point, 1 m in front of its hub door
const TRIPS = 4; // round trips: 0 and 1 warm up, 2 is the baseline

type Counts = Record<string, number>;
interface Reading {
  renderer: string;
  counts: Counts;
}

/** At least 10 display frames (afterFrame waits two). */
async function tenFrames(page: Page) {
  for (let i = 0; i < 5; i++) await afterFrame(page);
}

/** GL objects and one frame's draws of the page canvas's context; bodies, colliders, listeners. */
async function read(page: Page): Promise<Reading> {
  const { live, draws, elsewhere, renderer } = await webglCounts(page);
  const text = await page.locator('.debug-text').innerText();
  const physics = /bodies (\d+) · colliders (\d+)/.exec(text);
  const events = /(\d+) listeners/.exec(text);
  if (!physics || !events) throw new Error(`debug panel not readable:\n${text}`);
  const panel = {
    bodies: Number(physics[1]),
    colliders: Number(physics[2]),
    listeners: Number(events[1]),
  };
  return { renderer, counts: { ...live, elsewhere, draws, ...panel } };
}

/** A test annotation and one stdout line, prefixed with the project and the renderer. */
function record(label: string, { renderer, counts }: Reading) {
  const values = Object.entries(counts).map(([name, n]) => `${name}=${n}`);
  const line = `[${test.info().project.name}] ${renderer} | ${label} ${values.join(' ')}`;
  test.info().annotations.push({ type: 'resources', description: line });
  process.stdout.write(`${line}\n`);
}

/** At an arrival, before any turn: read 10 frames after the panel shows the scene, and 10 later. */
async function arrive(page: Page, aim: Aim, scene: string, label: string): Promise<Counts> {
  await expectDebug(page, 'Scene', scene);
  // A walk ends a little off where the last one did, so look all round first: everything of the
  // scene is drawn (three makes an object's GL buffers when it first draws it), and what exists
  // then does not depend on where the walk ended. The view is then always the same direction.
  for (const yaw of [Math.PI / 2, Math.PI, -Math.PI / 2, 0]) await aim.to(yaw, 0);
  await tenFrames(page);
  const first = await read(page);
  record(label, first);
  await tenFrames(page);
  const again = await read(page);
  expect(again.counts, `${label}: still changing 10 frames after arrival`).toEqual(first.counts);
  return first.counts;
}

test('resources: GL buffers and textures, bodies and listeners repeat exactly over walk-through lab-hub trips', async ({
  page,
}) => {
  test.setTimeout(480_000);
  await page.addInitScript(countWebGL);
  // Rooms out of sight off: with it on, what is drawn depends on where each walk stops (the lab's
  // arrival is near the 7 m at which the range wakes); its own cycles are room-sleep.spec.ts's.
  await page.addInitScript(() => localStorage.setItem('simlab.settings.roomSleep', 'false'));
  const errors = await continueFrom(page, labSave(STAND, T.labDoor));
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(STAND, T.labDoor); // a new Aim starts at yaw 0
  await tenFrames(page);
  const start = await read(page);
  test.info().annotations.push({ type: 'webgl-renderer', description: start.renderer });
  record('start (information only)', start);

  const hub: Counts[] = [];
  const lab: Counts[] = [];
  for (let trip = 0; trip <= TRIPS; trip++) {
    // Through the lab's door into the hub, on until it has closed and the lab is gone; read there.
    await walkToDoor(page, aim, T.labDoor, 'physics-lab/door-hub');
    const out = { label: 'Back to SIMLAB Hub', to: 'simlab-hub', done: (p: Vec3) => p[0] < 10.5 };
    await walkThrough(page, out);
    await doorsClosed(page, 'simlab-hub');
    hub.push(await arrive(page, aim, 'simlab-hub', `hub[${trip}]`));
    // And back the same way.
    await walkToDoor(page, aim, T.hubDoorPhysics, 'simlab-hub/door-physics');
    const back = { label: 'Enter Physics Lab', to: 'physics-lab', done: (p: Vec3) => p[0] > -2.6 };
    await walkThrough(page, back);
    await doorsClosed(page, 'physics-lab');
    lab.push(await arrive(page, aim, 'physics-lab', `lab[${trip}]`));
  }

  // By hub[2] and lab[2] every view and turn of the cycle has been drawn twice; later trips must
  // repeat every GL object (vertex arrays and programs included), bodies, colliders and
  // listeners. Not compared: the draws of the frame read, which follow where the walk ended
  // (measured: 63 then 62 in the hub, 192 then 191 in the lab, on SwiftShader).
  // In the hub, buffers and vertex arrays may also differ by the teacher's hand props (cup,
  // phone, book, key card, pen: ~10 small meshes, built hidden with the actor and uploaded at
  // their first use in a visit), which follow what the teacher happened to do (measured: ±8 to
  // ±16 buffers, ±2 vertex arrays). A prop first drawn in a later visit also compiles its
  // material's program then, once for the game (measured: 42 → 43 in the hub's fourth visit, and
  // the lab's count with it): programs may grow by 2 at most, never back. Everything else in the
  // hub, and all of the lab, stays exact.
  const fixed = ({ draws: _d, Buffer: _b, VertexArray: _v, Program: _p, ...rest }: Counts) => rest;
  const labFixed = ({ draws: _d, Program: _p, ...rest }: Counts) => rest;
  const programs = (c: Counts) => c.Program ?? 0;
  for (let k = 3; k <= TRIPS; k++) {
    expect(fixed(hub[k]!), `hub[${k}] equals hub[2]`).toEqual(fixed(hub[2]!));
    const off = (key: string) => Math.abs((hub[k]![key] ?? 0) - (hub[2]![key] ?? 0));
    expect(off('Buffer'), `hub[${k}] buffers`).toBeLessThanOrEqual(40);
    expect(off('VertexArray'), `hub[${k}] vertex arrays`).toBeLessThanOrEqual(10);
    expect(labFixed(lab[k]!), `lab[${k}] equals lab[2]`).toEqual(labFixed(lab[2]!));
    for (const [trips, label] of [
      [hub, 'hub'],
      [lab, 'lab'],
    ] as const) {
      const now = programs(trips[k]!);
      expect(now - programs(trips[2]!), `${label}[${k}] programs`).toBeGreaterThanOrEqual(0);
      expect(now - programs(trips[2]!), `${label}[${k}] programs`).toBeLessThanOrEqual(2);
      expect(now, `${label}[${k}] programs never back`).toBeGreaterThanOrEqual(
        programs(trips[k - 1]!),
      );
    }
  }
  expect(errors).toEqual([]);
});
