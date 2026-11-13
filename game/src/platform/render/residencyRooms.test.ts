import type * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Disposables } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import { bootTestGame, placePlayer } from '../../game/testing';
import { roomSlabs, WALL_THICKNESS } from '../../world/roomGeometry';
import { dressRoom } from './dress';
import { WorldRenderer } from './WorldRenderer';

// The renderer's side of residency, without WebGL (init() is never called): the room shells of
// each resident scene, in its own lighting, built when it comes and freed when it goes, and the
// lighting of the scene walked into. Reads private members on purpose, as WorldRenderer.test.ts.

const PHYSICS: Vec3 = [18.25, 0, -3]; // the Physics Lab's start in the hub's frame (campus.test)
/** Where each lit room light stands, in the hub's frame, and whether it casts (keys first). */
const lit = (view: Rooms) =>
  view.roomLights.slots
    .filter((s) => s.intensity > 0)
    .map((s) => [...s.position.toArray().map((v) => +v.toFixed(3)), s.castShadow]);
/** The hub's room lights: the key under the oculus, the fills under two ceiling panels. */
const HUB = [
  [0, 8.73, -3, true],
  [0, 8.9, -10.25, false],
  [0, 8.9, 4.25, false],
];
/** The Physics Lab's, moved by PHYSICS (WorldRenderer.test.ts's literals). */
const LAB = [
  [25.25, 4.92, -3, true], // Phase U-2: the lab 24 × 15 × 5 m, its key at x 7
  [24.25, 5.92, 8.75, true], // the range: z 11.75 − 3
  [18.25, 4.42, -14.75, true], // the bay's key over its middle
  [18.583, 4.92, -3, false],
  [31.917, 4.92, -3, false],
  [15.917, 4.92, -7.474, false], // the teacher's bench and its cabinets
  [15.917, 4.92, 1.211, false],
  [36.25, 5.92, 8.75, false],
  [42.5, 3.42, -5.2, false], // the dark optics room's fill
];
const keys = (lights: (number | boolean)[][]) => lights.filter((l) => l[3] === true);
const others = (lights: (number | boolean)[][]) => lights.filter((l) => l[3] === false);

interface Rooms {
  followScenes(s: Disposables): void;
  readonly rooms: THREE.Group;
  readonly sceneRooms: ReadonlyMap<string, { group: THREE.Group; materials: THREE.Material[] }>;
  readonly roomLights: { readonly slots: readonly THREE.SpotLight[]; readonly dropped: number };
}

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const done of cleanup.splice(0)) done();
});

/** A game in the hub with a renderer following its scenes from the start. */
async function hubWithRenderer(): Promise<{ game: Game; view: Rooms }> {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
  const subscriptions = new Disposables();
  const view = renderer as unknown as Rooms;
  view.followScenes(subscriptions);
  cleanup.push(() => {
    subscriptions.dispose();
    renderer.dispose();
    game.dispose();
  });
  await game.scenes.load('simlab-hub');
  return { game, view };
}

/** A scene's shell meshes: each room's slabs and, enhanced, its skirting (one more mesh). */
/** A scene's shell meshes: each room's slabs, its skirting and its style's dressing (a draw per finish). */
const slabs = (game: Game, sceneId: string) =>
  game.world
    .roomsOf(sceneId)
    .reduce(
      (n, room) =>
        n +
        roomSlabs(room, WALL_THICKNESS / 2).length +
        1 +
        dressRoom(room, (id) => game.content.items.tryGet(id)?.visual.size).length,
      0,
    );

/** Spies on the disposal of every geometry and material of a scene's shells. */
function spyOnShells(view: Rooms, sceneId: string) {
  const shells = view.sceneRooms.get(sceneId);
  if (!shells) throw new Error(`no shells for ${sceneId}`);
  const geometries = shells.group.children.map((m) =>
    vi.spyOn((m as THREE.Mesh).geometry, 'dispose'),
  );
  const materials = shells.materials.map((m) => vi.spyOn(m, 'dispose'));
  return { geometries, materials, group: shells.group };
}

describe('room shells of resident scenes', () => {
  it('builds a neighbour’s in its own lighting where it lies, and frees all of it when it goes', async () => {
    const { game, view } = await hubWithRenderer();
    expect([...view.sceneRooms.keys()]).toEqual(['simlab-hub']);
    const hub = view.sceneRooms.get('simlab-hub')!;
    expect(hub.group.children).toHaveLength(slabs(game, 'simlab-hub'));
    // The hub's own lighting (its scene's `lighting`), read before anything is attached.
    const hubRoughness = (hub.materials[0] as THREE.MeshStandardMaterial).roughness;
    expect(lit(view)).toEqual(HUB);

    expect(await game.scenes.attach('physics-lab')).toBeNull();
    expect([...view.sceneRooms.keys()]).toEqual(['simlab-hub', 'physics-lab']);
    const lab = view.sceneRooms.get('physics-lab')!;
    expect(lab.group.parent).toBe(view.rooms);
    expect(lab.group.children).toHaveLength(slabs(game, 'physics-lab'));
    expect(lab.materials).toHaveLength(16); // wall, floor, ceiling, skirting for each of its 4 rooms
    // Enhanced, as the lab is: matte walls, floors that receive shadows.
    expect((lab.materials[0] as THREE.MeshStandardMaterial).roughness).toBe(0.92);
    expect((lab.group.children[0] as THREE.Mesh).receiveShadow).toBe(true); // its floor
    // Its floor where the lab lies in the hub’s frame (the lab’s own centre is x 7, z 0).
    const floor = lab.group.children[0]!.position.toArray();
    [PHYSICS[0] + 7, -WALL_THICKNESS / 4, PHYSICS[2]].forEach((v, i) =>
      expect(floor[i]).toBeCloseTo(v, 9),
    );
    // The lights now cover both (what is seen through the door is shadowed like the rest); the
    // hub's own shells are untouched.
    // Its room lights join the hub's in the pool: the hub's first (current), keys then others.
    expect(lit(view)).toEqual([...keys(HUB), ...keys(LAB), ...others(HUB), ...others(LAB)]);
    expect((hub.materials[0] as THREE.MeshStandardMaterial).roughness).toBe(hubRoughness);

    const shells = spyOnShells(view, 'physics-lab');
    // Released: its shells leave the scene graph, each geometry and material freed once.
    expect(game.scenes.release('physics-lab')).toBe(true);
    expect([...view.sceneRooms.keys()]).toEqual(['simlab-hub']);
    expect(lit(view)).toEqual(HUB); // its lights gone with it
    expect(shells.group.parent).toBeNull();
    for (const spy of [...shells.geometries, ...shells.materials]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('changes no light walking in; only the Physics Lab’s lights once the hub goes', async () => {
    const { game, view } = await hubWithRenderer();
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    placePlayer(game, [PHYSICS[0], 0, PHYSICS[2]], -Math.PI / 2); // setup: into the lab
    game.update(1 / 60);
    expect(game.state.session.sceneId).toBe('physics-lab');
    // Walking in changes no light: the same ones, each in the slot it had (roomLights.ts: a slot
    // moved to another light redraws its shadow map).
    expect(lit(view)).toEqual([...keys(HUB), ...keys(LAB), ...others(HUB), ...others(LAB)]);

    // The hub released behind the player: its shells go, the lab's stay, and only the lab's
    // lights are lit.
    const hub = spyOnShells(view, 'simlab-hub');
    expect(game.scenes.release('simlab-hub')).toBe(true);
    expect([...view.sceneRooms.keys()]).toEqual(['physics-lab']);
    for (const spy of [...hub.geometries, ...hub.materials]) expect(spy).toHaveBeenCalledTimes(1);
    expect(lit(view)).toEqual(LAB);

    // A load frees everything left.
    const lab = spyOnShells(view, 'physics-lab');
    await game.scenes.load('chemistry-lab');
    expect([...view.sceneRooms.keys()]).toEqual(['chemistry-lab']);
    for (const spy of [...lab.geometries, ...lab.materials]) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps the same lights when more scenes are open than lit, then lights them all again', async () => {
    const { game, view } = await hubWithRenderer();
    const slots = [...view.roomLights.slots];
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    // A third scene (a second door left open): five keys for four slots, ten others for six; the
    // latest goes without (its key and four fills).
    expect(await game.scenes.attach('chemistry-lab')).toBeNull();
    expect(view.roomLights.dropped).toBe(8); // Phase X: and the practice room's key and two fills
    expect(keys(lit(view))).toEqual([...keys(HUB), ...keys(LAB)]);
    expect(game.scenes.release('physics-lab')).toBe(true);
    expect(view.roomLights.dropped).toBe(0);
    expect(keys(lit(view))).toHaveLength(3); // the hub's, the chemistry lab's and its practice room's
    // The same lights throughout: rooms fill and empty slots, none is made or lost.
    expect(view.roomLights.slots).toEqual(slots);
  });
});
