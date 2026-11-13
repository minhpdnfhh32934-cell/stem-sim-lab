import { describe, expect, it } from 'vitest';
import { Registry } from '../core/Registry';
import { bundledContent } from '../content';
import { coreContent } from '../content/core';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { BUILT_IN_MODELS } from '../simulation/models';
import { addLabContent, buildContent, buildCoreContent, type LabPack } from './content';
import { labPack } from './labPack';
import { bootTestGame } from './testing';

const files = import.meta.glob<{ id: string }>('../content/experiments/*.json', {
  eager: true,
  import: 'default',
});
const code = (models = BUILT_IN_MODELS) => ({
  behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
  models: new Registry('simulation model', models),
});
const all = () => buildContent(bundledContent, code());

type RawPlacements = { room: string; placements: { id: string; item: string }[] }[];
/** How many placements each room has, by id. */
const placementsOf = (rooms: { all(): { id: string; placements: unknown[] }[] }) =>
  Object.fromEntries(rooms.all().map((r) => [r.id, r.placements.length]));
/** The rooms the laboratories are made of. */
const labRooms = new Set(
  (bundledContent.laboratories as { rooms: string[] }[]).flatMap((l) => l.rooms),
);

describe('the lab pack', () => {
  it('is the bundled experiments, topics and models: one file per experiment, named after it', () => {
    expect(labPack.experiments).toEqual(bundledContent.experiments);
    expect(labPack.topics).toEqual(bundledContent.topics);
    expect(labPack.models).toBe(BUILT_IN_MODELS);
    for (const [path, { id }] of Object.entries(files)) {
      expect(path).toBe(`../content/experiments/${id}.json`);
    }
    // The old single file is gone; a recreated one would be ignored by the pack without a word.
    expect(import.meta.glob('../content/experiments.json', { eager: true })).toEqual({});
    // In a stable order: as the laboratories list them, then any other by id.
    const ids = (labPack.experiments as { id: string }[]).map((e) => e.id);
    const listed = (bundledContent.laboratories as { experiments?: string[] }[]).flatMap(
      (l) => l.experiments ?? [],
    );
    expect(ids.slice(0, listed.length)).toEqual(listed);
    expect(ids.slice(listed.length)).toEqual(ids.slice(listed.length).sort());
  });

  it('added to the core makes the bundled content: its items and placements, the rest unchanged', () => {
    const core = buildCoreContent(coreContent, code([]));
    const whole = all();
    // The labs' stations are not in the core: their rooms' placements are partly the pack's.
    expect(core.items.size).toBeLessThan(whole.items.size);
    for (const { room } of labPack.placements as RawPlacements) expect(labRooms).toContain(room);
    expect(placementsOf(core.rooms)).not.toEqual(placementsOf(whole.rooms));

    addLabContent(core, code([]), labPack);
    expect(core.items.all()).toEqual(whole.items.all());
    expect(core.rooms.all()).toEqual(whole.rooms.all());
    expect(core.experiments.all()).toEqual(whole.experiments.all());
    expect(core.topics.all()).toEqual(whole.topics.all());
  });

  it('leaves in the core no item only the labs place: it would be downloaded with the menu', () => {
    const rooms = [
      ...(coreContent.rooms as { id: string; placements: { item: string }[] }[]),
      ...(labPack.placements as RawPlacements).map((a) => ({ id: a.room, ...a })),
    ];
    const labOnly = (coreContent.items as { id: string }[]).filter(({ id }) => {
      const placedIn = rooms.filter((r) => r.placements.some((p) => p.item === id));
      return placedIn.length > 0 && placedIn.every((r) => labRooms.has(r.id));
    });
    // Move such an item to items.json, and its placements to lab-placements.json.
    expect(labOnly.map((i) => i.id)).toEqual([]);
  });

  it('is not loaded at boot; once loaded, the game has every bundled experiment and topic', async () => {
    const { game } = await bootTestGame();
    const content = all();
    expect(game.content.experiments.size).toBe(0);
    expect(game.content.topics.size).toBe(0);
    expect(game.content.items.size).toBeLessThan(content.items.size);
    expect(() => game.experiments.session('test/free-fall', 'free-fall')).toThrow(
      'Unknown experiment "free-fall"',
    );

    await game.loadLab();
    expect(game.content.experiments.all()).toEqual(content.experiments.all());
    expect(game.content.topics.all()).toEqual(content.topics.all());
    // Into the registries and the very rooms the systems hold.
    expect(game.content.items.all()).toEqual(content.items.all());
    expect(game.content.rooms.all()).toEqual(content.rooms.all());
    // The systems hold the registries the pack filled: a session finds its definition and model.
    expect(game.experiments.session('test/free-fall', 'free-fall').definition.id).toBe('free-fall');
  });

  it('loads once for every caller; a failure adds nothing, says why, and the next call tries again', async () => {
    let calls = 0;
    const { game } = await bootTestGame({
      labPack: () => {
        calls++;
        return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(labPack);
      },
    });
    game.setLanguage('vi');
    const before = [game.content.items.size, placementsOf(game.content.rooms)];
    await expect(game.loadLab()).rejects.toThrow('Không tải được các thí nghiệm: offline');
    expect(game.content.experiments.size).toBe(0);
    expect([game.content.items.size, placementsOf(game.content.rooms)]).toEqual(before);

    await Promise.all([game.loadLab(), game.loadLab(), game.savedCompletedExperiments()]);
    await game.loadLab();
    expect(calls).toBe(2);
    expect(game.content.experiments.size).toBe(all().experiments.size);
  });

  it('is refused whole when it does not fit the core content, every problem named', async () => {
    const broken: LabPack = { ...labPack, models: [] };
    const { game } = await bootTestGame({ labPack: () => Promise.resolve(broken) });
    const loading = game.loadLab();
    await expect(loading).rejects.toThrow('experiments.free-fall.model: unknown simulation model');
    await expect(loading).rejects.toThrow('experiments.hookes-law.model: unknown simulation model');
    expect(game.content.experiments.size).toBe(0);
    expect(game.content.topics.size).toBe(0);
    // A world scene waits for it: refused too, with the same reason, the menu kept.
    await expect(game.newGame('researcher-male')).rejects.toThrow('unknown simulation model');
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(game.world.entityCount).toBe(0);
  });

  it('is refused whole when its items or placements do not fit the core, nothing added', async () => {
    const placements = structuredClone(labPack.placements) as RawPlacements;
    // In front of the Physics Lab's door from the hub, where the player arrives; an id it has.
    placements
      .find((a) => a.room === 'physics-lab')!
      .placements.push(
        { id: 'in-the-way', item: 'lab-bench', position: [-3.95, 0, 0] } as never,
        { id: 'door-hub', item: 'lab-bench', position: [0, 0, 2] } as never,
      );
    const strays: LabPack = {
      ...labPack,
      items: [...(labPack.items as object[]), (coreContent.items as object[])[0]],
      placements: [...(labPack.placements as RawPlacements), { room: 'atlantis', placements: [] }],
    };
    const crowded: LabPack = { ...labPack, placements };
    const doors = structuredClone(labPack.placements) as RawPlacements;
    // Doors are paired once, at boot: one only the pack places would never open or link a scene.
    doors[0]!.placements.push({ id: 'side-door', item: 'door', position: [0, 0, 0] } as never);
    const doored: LabPack = { ...labPack, placements: doors };
    for (const [pack, problems] of [
      [
        doored,
        [`lab-placements.0.placements.${doors[0]!.placements.length - 1}: "side-door" is a door`],
      ],
      [
        strays,
        [
          'items: duplicate id "door"',
          `lab-placements.${placements.length}.room: unknown room "atlantis"`,
        ],
      ],
      [
        crowded,
        [
          'rooms.physics-lab.placements.door-hub: duplicate placement id',
          'the arrival point in front of "physics-lab/door-hub" overlaps placement "in-the-way"',
        ],
      ],
    ] as const) {
      const { game } = await bootTestGame({ labPack: () => Promise.resolve(pack) });
      const before = [game.content.items.size, placementsOf(game.content.rooms)];
      const loading = game.loadLab();
      for (const problem of problems) await expect(loading).rejects.toThrow(problem);
      expect(game.content.experiments.size).toBe(0);
      expect([game.content.items.size, placementsOf(game.content.rooms)]).toEqual(before);
    }
  });

  it('comes before a lab scene and before Continue: a lab item carried in the save stays carried', async () => {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    await first.game.newGame('researcher-male');
    await first.game.scenes.load('physics-lab');
    expect(first.game.world.entity('physics-lab/tower')).toBeDefined(); // a station of the pack's
    const ball = 'projectile-range/ball-1';
    const carried = [{ slot: 0, item: 'projectile-ball', placements: [ball] }];
    first.game.state.player.inventory.stacks = structuredClone(carried);
    expect(first.game.save()?.ok).toBe(true);
    first.game.dispose();

    let calls = 0;
    const { game } = await bootTestGame({
      storage,
      labPack: () =>
        calls++ === 0 ? Promise.reject(new Error('offline')) : Promise.resolve(labPack),
    });
    // Refused before anything changes: still the menu, nothing carried yet.
    await expect(game.continueGame()).rejects.toThrow('offline');
    expect(game.state.session.phase).toBe('menu');
    expect(game.state.player.inventory.stacks.filter((s) => s.item !== 'phone')).toEqual([]);

    // The ball and its placement are the pack's: without it, Continue would drop it as unknown.
    expect((await game.continueGame()).ok).toBe(true);
    expect(game.state.player.inventory.stacks.filter((s) => s.item !== 'phone')).toEqual(carried);
    expect(game.world.entity(ball)).toBeUndefined(); // carried, not placed again
    expect(game.world.entity('projectile-range/ball-2')).toBeDefined();
    expect(game.world.entity('physics-lab/tower')).toBeDefined();
  });
});
