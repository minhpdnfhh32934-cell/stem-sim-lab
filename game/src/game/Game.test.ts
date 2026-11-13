import { describe, expect, it, vi } from 'vitest';
import { bundledContent } from '../content';
import type { Vec3 } from '../core/math';
import { SAVE_VERSION, type SaveData } from '../persistence/saveData';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { BootError, Game } from './Game';
import type { GameEvents } from './GameEvents';
import { bootTestGame, flush, lookAt, placePlayer, untilIdle } from './testing';

describe('Game boot', () => {
  it('boots headless to the main menu with every system active', async () => {
    const { game, logs } = await bootTestGame();
    expect(game.state.session).toEqual({ phase: 'menu', sceneId: 'main-menu', paused: false });
    expect(game.systems.statuses()).toEqual([
      { id: 'container-saves', status: 'active' }, // save v4: moved glassware's poses
      { id: 'clock', status: 'active' }, // Phase V: the time of day (save v9)
      { id: 'scenes', status: 'active' },
      { id: 'player', status: 'active' },
      { id: 'npcs', status: 'active' }, // Phase Y: the hub's teacher
      { id: 'papers', status: 'active' }, // Phase Y-5: his tests
      { id: 'peers', status: 'active' }, // Phase M: the other players of a LAN room
      { id: 'physics', status: 'active' },
      { id: 'gait', status: 'active' }, // Phase S: the walk and its footsteps
      { id: 'interaction', status: 'active' },
      { id: 'actions', status: 'active' }, // Phase H-3: actions acted out
      { id: 'liquids', status: 'active' }, // physical lab: pours detected
      { id: 'doors', status: 'active' },
      { id: 'hinges', status: 'active' }, // UX3.1: hinged leaves (cabinet doors, washroom door)
      { id: 'sliders', status: 'active' }, // Phase U: sliding doors between a scene's rooms
      { id: 'inventory', status: 'active' },
      { id: 'phone', status: 'active' },
      { id: 'rest', status: 'active' },
      { id: 'hits', status: 'active' },
      { id: 'circuit', status: 'active' },
      { id: 'fire', status: 'active' },
      { id: 'procedures', status: 'active' },
      { id: 'experiments', status: 'active' },
      { id: 'stations', status: 'active' },
      { id: 'held-targets', status: 'active' }, // what the held object can act on (outlines)
      { id: 'tasks', status: 'active' }, // the guided task followed
      { id: 'task-guide', status: 'active' }, // where it leads: the floor path
      { id: 'workspace', status: 'active' },
      { id: 'explain', status: 'active' },
      { id: 'progression', status: 'active' },
    ]);
    expect(logs.filter((l) => l.level === 'error' || l.level === 'warn')).toEqual([]);
    expect(game.world.entityCount).toBe(0);
  });

  it('runs platform systems after the game systems', async () => {
    const order: string[] = [];
    const { game } = await bootTestGame({
      platformSystems: () => [{ id: 'renderer', init: () => void order.push('renderer') }],
    });
    expect(
      game.systems
        .statuses()
        .map((s) => s.id)
        .at(-1),
    ).toBe('renderer');
    expect(order).toEqual(['renderer']);
  });

  it('reports the failing stage for bad configuration', async () => {
    const boot = Game.boot({ storage: new MemorySaveStorage(), config: { player: { reach: -1 } } });
    await expect(boot).rejects.toBeInstanceOf(BootError);
    await expect(boot).rejects.toMatchObject({ stage: 'configuration' });
  });

  it('reports the failing stage for broken content', async () => {
    const content = { ...bundledContent, scenes: [] };
    await expect(
      Game.boot({ storage: new MemorySaveStorage(), content, logSink: () => undefined }),
    ).rejects.toMatchObject({ stage: 'content' });
  });

  it('reports the failing stage and disposes systems when a platform system cannot start', async () => {
    let disposed = false;
    const boot = Game.boot({
      storage: new MemorySaveStorage(),
      logSink: () => undefined,
      platformSystems: () => [
        { id: 'needs-dispose', dispose: () => void (disposed = true) },
        {
          id: 'renderer',
          init: () => {
            throw new Error('WebGL is not available');
          },
        },
      ],
    });
    await expect(boot).rejects.toThrow(
      'Boot failed during systems: System "renderer" failed to initialize: WebGL is not available',
    );
    expect(disposed).toBe(true);
  });
});

describe('Game flow', () => {
  it('starts a new game in the preparation room with the chosen character', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await bootTestGame({ storage });
    await game.newGame('researcher-female');
    expect(game.state.session).toEqual({
      phase: 'playing',
      sceneId: 'preparation-room',
      paused: false,
    });
    expect(game.state.player.characterId).toBe('researcher-female');
    expect(game.state.player.eyeHeight).toBeCloseTo(1.65 * 0.93, 9);
    expect(game.state.player.position).toEqual([0, 0, 1]);
    // Preparation Room (10 + 2 lights, a door casing, 2 signs) and the cleanroom corridor (10 + 2
    // lights, 2 floor markings, 4 signs, a splashback, a waste bin, 3 wall rails), connected by a
    // doorway; the 18 fittings have no interactions.
    expect(game.world.activeRooms.map((r) => r.id)).toEqual([
      'preparation-room',
      'cleanroom-corridor',
    ]);
    expect(game.world.entityCount).toBe(56); // UX3: + door hardware 7, + ceiling details 10; H-1: + a mirror
    expect(game.interaction.count).toBe(21); // UX3: the waste bin (used gloves) is no longer decor
    expect(storage.data.has('simlab.save.slot-1')).toBe(true); // autosaved on entering the world
  });

  it('walks through a door into another scene: opened by interaction, nothing loaded', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    const seen: GameEvents['SceneLoaded'][] = [];
    game.events.subscribe('SceneLoaded', (e) => seen.push(e));
    const entered: GameEvents['SceneEntered'][] = [];
    game.events.subscribe('SceneEntered', (e) => entered.push(e));

    // The Teacher Room door is ungated (the hub door is gated by the cleanroom entry procedure).
    placePlayer(game, [1.5, 0, 1]);
    lookAt(game, [2.95, 1.05, 1]);
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe('preparation-room/door-teacher');
    game.input.press('interact');
    game.update(0.016);
    game.input.release('interact');
    untilIdle(game); // the key card held to its reader: the door asked to open
    await flush();
    // It slides open, one leaf at a time: 0.6 + 0.2 (LEAF_GAP_S) + 0.6 s = 84 frames.
    for (let i = 0; i < 90; i++) game.update(1 / 60);
    expect(game.doors.state('preparation-room/door-teacher')).toBe('open');
    // Both scenes are there: the Preparation Room (21) and the Teacher Room (door, desk,
    // chair, computer, cabinet and bed; the washroom door, toilet and sink of its bathroom: 9).
    expect(game.interaction.count).toBe(30);

    // Walk east through the doorway, 1 m into the Teacher Room (its west face at frame x 3.25).
    game.state.player.pitch = 0;
    const yaw = game.state.player.yaw;
    let last: Vec3 = [...game.state.player.position];
    let longest = 0;
    game.input.press('moveForward');
    for (let i = 0; i < 120 && game.state.player.position[0] < 4.25; i++) {
      game.update(1 / 60);
      const p = game.state.player.position;
      longest = Math.max(longest, Math.hypot(p[0] - last[0], p[2] - last[2]));
      last = [...p];
    }
    game.input.release('moveForward');
    expect(seen).toEqual([]); // nothing loaded
    expect(entered).toEqual([
      {
        sceneId: 'teacher-room',
        previousSceneId: 'preparation-room',
        through: 'preparation-room/door-teacher',
      },
    ]);
    expect(game.state.session.sceneId).toBe('teacher-room');
    expect(longest).toBeLessThanOrEqual(2.2 / 60 + 1e-4); // never more than a step of walking
    expect(game.state.player.position[2]).toBeCloseTo(1, 3); // straight on, not deflected
    expect(game.state.player.yaw).toBe(yaw); // the view untouched
    // In the Teacher Room's own coordinates: 1 m in from its west wall (x −2.5), at its z 0.
    const [ox, , oz] = game.scenes.origin;
    expect(game.state.player.position[0] - ox).toBeGreaterThan(-1.5);
    expect(game.state.player.position[2] - oz).toBeCloseTo(0, 3);
    expect(game.world.entity('preparation-room/door-teacher')).toBeDefined(); // still there

    // On, away from the door: it closes behind the player and the Preparation Room goes.
    game.input.press('moveForward');
    for (let i = 0; i < 120 && game.state.player.position[0] < 5.5; i++) game.update(1 / 60);
    game.input.release('moveForward');
    for (let i = 0; i < 300 && game.scenes.residentIds.length > 1; i++) game.update(1 / 60);
    expect(game.scenes.residentIds).toEqual(['teacher-room']);
    expect(game.world.entity('preparation-room/door-teacher')).toBeUndefined();
    // Door, desk, chair, computer, cabinet and bed; the washroom door, toilet and sink of its
    // bathroom (same scene).
    expect(game.interaction.count).toBe(9);
  });

  it('lets the Teacher Room and bathroom furniture be reached from the free floor', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('teacher-room'); // developer jump (setup only)
    const inspected: string[] = [];
    game.events.subscribe('ItemInspected', ({ entityId }) => inspected.push(entityId));

    // Phase F-1: the cabinet opens (E) and the bed is lain on (E): F inspects them; the basin's
    // E runs its water (F washes the hands).
    const targets: [id: string, stand: Vec3, look: Vec3, key: 'interact' | 'secondary'][] = [
      ['teacher-room/pc', [0, 0, -1.3], [0, 0.93, -2.25], 'interact'], // the screen
      ['teacher-room/cabinet', [1, 0, -1.4], [2.03, 1, -1.4], 'secondary'], // its front
      ['teacher-room/bed', [1.95, 0, -0.4], [1.95, 0.4, 0.8], 'secondary'], // its foot
      ['teacher-bathroom/wc', [-1.5, 0, 3.4], [-2.1, 0.5, 4.1], 'interact'], // its front
    ];
    for (const [id, stand, look, key] of targets) {
      placePlayer(game, stand);
      lookAt(game, look);
      game.update(0.016);
      expect(game.interaction.focused?.id).toBe(id);
      game.input.press(key);
      game.update(0.016);
      game.input.release(key);
    }
    expect(inspected).toEqual(targets.map(([id]) => id));
    placePlayer(game, [-1.5, 0, 3.9]);
    lookAt(game, [-0.85, 0.6, 3.9]); // the basin's front, east wall
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe('teacher-bathroom/sink');
    expect(game.interaction.perform('teacher-bathroom/sink', 'water-on')).toBe(true);
    untilIdle(game); // the tap turned by hand first
    expect(game.entityStates.get('teacher-bathroom/sink', 'running')).toBe(true);
  });

  it('walks from the Teacher Room through the doorway into its bathroom and back', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('teacher-room'); // developer jump (setup only)
    // One scene, two rooms joined by a 1 m doorway in the wall between them, centred on x = −1.5.
    expect(game.world.activeRooms.map((r) => r.id)).toEqual(['teacher-room', 'teacher-bathroom']);
    expect(game.world.entity('teacher-bathroom/wc')?.roomId).toBe('teacher-bathroom');
    expect(game.world.entity('teacher-bathroom/sink')?.roomId).toBe('teacher-bathroom');
    game.update(1 / 60); // a scene's first frame announces the room the player starts in
    const entered: string[] = [];
    game.events.subscribe('PlayerEnteredRoom', ({ roomId }) => entered.push(roomId));
    const walk = (yaw: number, seconds: number) => {
      game.state.player.yaw = yaw;
      game.input.press('moveForward');
      for (let t = 0; t < seconds - 1e-9; t += 1 / 60) game.update(1 / 60);
      game.input.release('moveForward');
    };

    // UX3.1: its door, closed, stops the player (the leaf's face at z 2.46, the capsule 0.3 m).
    placePlayer(game, [-1.5, 0, 1.5]);
    walk(Math.PI, 1);
    expect(game.state.player.position[2]).toBeLessThan(2.46 - 0.29);
    expect(entered).toEqual([]);
    // Opened from beside it, clear of its swing (it opens out into the Teacher Room).
    placePlayer(game, [-0.6, 0, 1.6]);
    expect(game.interaction.perform('teacher-room/door', 'open')).toBe(true);
    for (let i = 0; i < 70; i++) game.update(1 / 60); // its 1 s swing
    expect(game.hinges.fraction('teacher-room/door')).toBe(1);
    placePlayer(game, [-1.5, 0, 1.5]);
    walk(Math.PI, 1); // south at 2.2 m/s through the doorway (z 2.5 … 2.75): not stopped by it
    expect(game.state.player.position[2]).toBeGreaterThan(3.5);
    expect(entered).toEqual(['teacher-bathroom']);
    walk(0, 1); // north, back the same way
    expect(game.state.player.position[2]).toBeLessThan(2);
    expect(entered).toEqual(['teacher-bathroom', 'teacher-room']);
  });

  it('runs an experiment from its station and records progression', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    await game.scenes.load('physics-lab');
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));

    // At the free-fall desk, its RUN button under the crosshair (default h 1.5 m, g 9.81 m/s²).
    placePlayer(game, [2.017, 0, -5.35]); // at the free-fall desk (Phase T-1a)
    lookAt(game, [1.867, 0.875, -5.9]);
    game.update(0.016);
    expect(game.interaction.focused?.id).toBe('physics-lab/button-run');
    game.input.press('interact');
    for (let i = 0; i < 60; i++) game.update(1 / 60);

    expect(completed).toHaveLength(1);
    const expected = Math.sqrt((2 * 1.5) / 9.81);
    expect(completed[0]?.endReason).toBe('model');
    expect(completed[0]?.results['fall-time']).toBeCloseTo(expected, 9);
    expect(game.state.progression.completedExperiments).toEqual(['free-fall']);
  });

  it('continues a saved game where it was left', async () => {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    await first.game.newGame('researcher-female');
    await first.game.scenes.load('physics-lab');
    placePlayer(first.game, [-1.5, 0, 0], 0.5, -0.2); // the lab's open aisle
    first.game.entityStates.set('physics-lab/lamp', 'active', true);
    first.game.state.progression.completedExperiments.push('free-fall');
    expect(first.game.save()?.ok).toBe(true);
    first.game.dispose();

    const second = await bootTestGame({ storage });
    expect(second.game.hasSavedGame()).toBe(true);
    const result = await second.game.continueGame();
    expect(result.ok).toBe(true);
    const { state } = second.game;
    expect(state.session).toEqual({ phase: 'playing', sceneId: 'physics-lab', paused: false });
    expect(state.player).toMatchObject({
      characterId: 'researcher-female',
      position: [-1.5, 0, 0],
      yaw: 0.5,
      pitch: -0.2,
    });
    expect(second.game.entityStates.get('physics-lab/lamp', 'active')).toBe(true);
    expect(state.progression.completedExperiments).toEqual(['free-fall']);
  });

  it('refuses to continue when there is no save', async () => {
    const { game } = await bootTestGame();
    expect(await game.continueGame()).toEqual({ ok: false, error: 'No saved game' });
    expect(game.state.session.phase).toBe('menu');
  });

  it('systems release every subscription on dispose', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    game.systems.disposeAll();
    for (const type of [
      'EntitySpawned',
      'EntityDespawned',
      'SceneChangeRequested',
      'ExperimentCompleted',
    ] as const) {
      expect(game.events.listenerCount(type)).toBe(0);
    }
    expect(game.interaction.count).toBe(0);
  });
});

describe('Game language', () => {
  it('starts in English and restores the chosen language on the next visit, outside the save', async () => {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    const { texts } = first.game;
    const changes: GameEvents['LanguageChanged'][] = [];
    first.game.events.subscribe('LanguageChanged', (e) => changes.push(e));
    expect(first.game.language).toBe('en');
    expect(texts.ui('menu.play', 'Play')).toBe('Play');
    first.game.setLanguage('vi');
    expect(changes).toEqual([{ language: 'vi' }]);
    expect(texts.ui('menu.play', 'Play')).toBe('Chơi');
    first.game.dispose();

    const second = await bootTestGame({ storage });
    expect(second.game.language).toBe('vi');
    const male = second.game.content.characters.get('researcher-male');
    expect(second.game.texts.of(male, 'role')).toBe('Nhà vật lý'); // names are the same in both
    expect(second.game.hasSavedGame()).toBe(false);
    expect([...storage.data]).toEqual([['simlab.settings.language', 'vi']]);
  });

  it('falls back to English when the stored value is not a language it has', async () => {
    for (const stored of ['fr', 'VI', '', '"vi"']) {
      const storage = new MemorySaveStorage();
      storage.write('simlab.settings.language', stored);
      const { game, logs } = await bootTestGame({ storage });
      expect(game.language).toBe('en');
      expect(game.texts.ui('menu.continue', 'Continue')).toBe('Continue');
      expect(logs.filter((l) => l.level === 'warn').map((l) => l.message)).toEqual([
        `Stored language "${stored}" is not one of en, vi; using English`,
      ]);
    }
  });

  it('boots in English when storage throws, and keeps a choice for this visit', async () => {
    const storage = new MemorySaveStorage();
    storage.read = () => {
      throw new Error('SecurityError');
    };
    storage.write = () => {
      throw new Error('QuotaExceededError');
    };
    const { game, logs } = await bootTestGame({ storage });
    expect(game.language).toBe('en');
    game.setLanguage('vi');
    expect(game.language).toBe('vi');
    game.setFrameCap(60);
    expect(game.frameCap).toBe(60); // also for this visit only
    game.setGraphicsQuality('high');
    expect(game.graphicsQuality).toBe('high');
    expect(logs.filter((l) => l.level === 'warn').map((l) => l.message)).toEqual([
      'Could not read the language: SecurityError; using English',
      'Could not read the frame-rate cap: SecurityError; using none',
      'Could not read the graphics quality: SecurityError; using medium',
      'Could not read the master volume: SecurityError; using 80 %',
      'Could not read the music volume: SecurityError; using 70 %',
      'Could not read the effects volume: SecurityError; using 100 %',
      'Could not read the room volume: SecurityError; using 70 %',
      'Could not read the interface volume: SecurityError; using 70 %',
      'Could not read the voice volume: SecurityError; using 100 %', // Phase Y: the teacher's voice
      'Could not read the mute: SecurityError; using sound on',
      'Could not read the setting for rooms out of sight: SecurityError; using rooms out of sight not drawn',
      'Could not read the look sensitivity: SecurityError; using 1×',
      'Could not read the tilt-to-look setting: SecurityError; using off',
      'Could not read the tilt sensitivity: SecurityError; using 1×',
      'Could not read the tilt inversion: SecurityError; using not inverted',
      'Could not remember the language: QuotaExceededError',
      'Could not remember the frame-rate cap: QuotaExceededError',
      'Could not remember the graphics quality: QuotaExceededError',
    ]);
  });

  it('keeps the look settings (sensitivity, tilt) apart from every save; a bad stored one falls back', async () => {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    expect(first.game.controls).toEqual({
      lookSensitivity: 1,
      tiltLook: false,
      tiltSensitivity: 1,
      tiltInvert: false,
    });
    const changed: number[] = [];
    first.game.events.subscribe('ControlSettingsChanged', () => changed.push(1));
    first.game.setControl('lookSensitivity', 1.5);
    first.game.setControl('tiltLook', true);
    first.game.setControl('tiltSensitivity', 0.5);
    first.game.setControl('tiltInvert', true);
    expect(changed).toHaveLength(4);
    first.game.dispose();
    const again = await bootTestGame({ storage });
    expect(again.game.controls).toEqual({
      lookSensitivity: 1.5,
      tiltLook: true,
      tiltSensitivity: 0.5,
      tiltInvert: true,
    });
    again.game.dispose();
    storage.write('simlab.settings.lookSensitivity', '7');
    const bad = await bootTestGame({ storage });
    expect(bad.game.controls.lookSensitivity).toBe(1);
    expect(bad.game.hasSavedGame()).toBe(false); // not part of a save
  });

  it('is at medium graphics quality at first; each preset is kept, announced, and apart from the rest', async () => {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    expect(first.game.graphicsQuality).toBe('medium');
    first.game.setFrameCap(30);
    first.game.dispose();
    for (const quality of ['low', 'high', 'medium'] as const) {
      const { game } = await bootTestGame({ storage });
      const changes: string[] = [];
      game.events.subscribe('GraphicsQualityChanged', (e) => changes.push(e.quality));
      game.setGraphicsQuality(quality);
      expect(changes).toEqual([quality]);
      game.dispose();
      const again = await bootTestGame({ storage });
      expect(again.game.graphicsQuality).toBe(quality);
      expect(again.game.frameCap).toBe(30); // the other settings are not touched
      expect(again.game.language).toBe('en');
      again.game.dispose();
    }
    expect(storage.data.get('simlab.settings.graphicsQuality')).toBe('medium');
    expect(first.game.hasSavedGame()).toBe(false); // not part of a save
  });

  it('takes a suggested preset (a software renderer: Low) only until the player picks one, without keeping it', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await bootTestGame({ storage });
    const changes: string[] = [];
    game.events.subscribe('GraphicsQualityChanged', (e) =>
      changes.push(`${e.quality}${e.lowered ? ' lowered' : ''}`),
    );
    game.preferGraphicsQuality('low', 'a software renderer');
    expect(game.graphicsQuality).toBe('low');
    expect(changes).toEqual(['low']);
    // Frames too slow: one step lower, said to be the game's own (the HUD tells the player).
    game.preferGraphicsQuality('medium', 'test');
    game.preferGraphicsQuality('low', 'under 40 fps for 5 s', true);
    expect(changes).toEqual(['low', 'medium', 'low lowered']);
    changes.length = 1;
    expect(storage.data.has('simlab.settings.graphicsQuality')).toBe(false); // not remembered
    game.setGraphicsQuality('high');
    game.preferGraphicsQuality('low', 'a software renderer');
    expect(game.graphicsQuality).toBe('high'); // the player's own choice wins
    game.dispose();
    // A choice from an earlier visit wins too.
    const again = await bootTestGame({ storage });
    again.game.preferGraphicsQuality('low', 'a software renderer');
    expect(again.game.graphicsQuality).toBe('high');
    again.game.dispose();
  });

  it('falls back to medium when the stored graphics quality is not one it offers', async () => {
    for (const stored of ['extreme', 'High', '', '1']) {
      const storage = new MemorySaveStorage();
      storage.write('simlab.settings.graphicsQuality', stored);
      const { game, logs } = await bootTestGame({ storage });
      expect(game.graphicsQuality).toBe('medium');
      expect(logs.filter((l) => l.level === 'warn').map((l) => l.message)).toEqual([
        `Stored graphics quality "${stored}" is not one of low, medium, high, ultra; using medium`,
      ]);
    }
  });

  it('has no frame-rate cap at first; each cap is kept for the next visit, apart from the language', async () => {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    expect(first.game.frameCap).toBe(0);
    first.game.setLanguage('vi');
    first.game.dispose();
    for (const cap of [30, 60, 90, 120, 0] as const) {
      const { game } = await bootTestGame({ storage });
      game.setFrameCap(cap);
      game.dispose();
      const again = await bootTestGame({ storage });
      expect(again.game.frameCap).toBe(cap);
      expect(again.game.language).toBe('vi'); // the language is not touched
      again.game.dispose();
    }
    expect(storage.data.get('simlab.settings.language')).toBe('vi');
    expect(storage.data.get('simlab.settings.frameCap')).toBe('0');
    expect(first.game.hasSavedGame()).toBe(false); // neither is part of a save
  });

  it('keeps the sound’s volumes and the mute for the next visit, announced, outside the save', async () => {
    const storage = new MemorySaveStorage();
    const first = await bootTestGame({ storage });
    expect(first.game.volumes).toEqual({
      master: 80,
      music: 70,
      effects: 100,
      room: 70,
      interface: 70,
      voice: 100,
    });
    expect(first.game.muted).toBe(false);
    let heard = 0;
    first.game.events.subscribe('AudioSettingsChanged', () => heard++);
    first.game.setVolume('room', 35);
    first.game.setMuted(true);
    expect(heard).toBe(2);
    first.game.dispose();
    const again = await bootTestGame({ storage });
    expect(again.game.volumes.room).toBe(35);
    expect(again.game.muted).toBe(true);
    expect(again.game.hasSavedGame()).toBe(false);
    // A stored volume that is not a step of the settings: the default, with a warning.
    storage.write('simlab.settings.volume.master', '83');
    const odd = await bootTestGame({ storage });
    expect(odd.game.volumes.master).toBe(80);
    expect(odd.logs.some((l) => l.level === 'warn' && l.message.includes('master volume'))).toBe(
      true,
    );
  });

  it('falls back to no cap when the stored value is not one it offers', async () => {
    for (const stored of ['45', '60.0', '-1', 'Infinity', '', 'none']) {
      const storage = new MemorySaveStorage();
      storage.write('simlab.settings.frameCap', stored);
      const { game, logs } = await bootTestGame({ storage });
      expect(game.frameCap).toBe(0);
      expect(logs.filter((l) => l.level === 'warn').map((l) => l.message)).toEqual([
        `Stored frame-rate cap "${stored}" is not one of 30, 60, 90, 120, 0; using none`,
      ]);
    }
  });

  it('plays in Vietnamese: actions, refusals, procedure and station texts, switched at once', async () => {
    const { game } = await bootTestGame();
    game.setLanguage('vi');
    await game.newGame('researcher-male');
    const { interaction, procedures, stations } = game;
    const coat = 'preparation-room/lab-coat';
    const wear = interaction.primaryAction(coat)!;
    expect(wear.label).toBe('Trang bị áo blouse');
    expect(interaction.blockedReason(coat, wear)).toBe('Hãy mở tủ đồ trước.');
    expect(interaction.primaryAction('preparation-room/door-teacher')?.label).toBe(
      'Đến phòng giáo viên',
    );
    const entry = procedures.activeProcedure()!;
    expect(procedures.entryBlock(entry)).toBe(
      'Chưa được vào. Tiếp theo: Đọc quy định vào phòng sạch trên bảng thông báo.',
    );
    expect(procedures.view(entry.id).stageLabel).toBe('Tìm hiểu quy định');

    await game.scenes.load('physics-lab');
    expect(stations.view('physics-lab/tower')?.checklist[0]?.instruction).toBe(
      'Đọc hướng dẫn rơi tự do trên bảng.',
    );
    expect(interaction.primaryAction('physics-lab/button-run')?.label).toBe('CHẠY');
    expect(interaction.primaryAction('physics-lab/dial-resolution')?.label).toBe(
      'Tăng độ phân giải đồng hồ d',
    );

    game.setLanguage('en'); // the same objects answer in English at once: nothing reloads
    expect(interaction.primaryAction('physics-lab/button-run')?.label).toBe('RUN');
    expect(stations.view('physics-lab/tower')?.checklist[0]?.instruction).toBe(
      'Read the free-fall instructions on the board.',
    );
  });

  it('tells in Vietnamese why a game cannot be continued', async () => {
    const storage = new MemorySaveStorage();
    storage.write('simlab.settings.language', 'vi');
    const { game } = await bootTestGame({ storage });
    expect(await game.continueGame()).toEqual({ ok: false, error: 'Chưa có trò chơi đã lưu' });
    storage.write('simlab.save.slot-1', 'not json');
    expect(await game.continueGame()).toEqual({
      ok: false,
      error: 'Bản lưu không phải JSON hợp lệ',
    });
  });
});

// The main menu shows the way from this scene and the runs of this save: they must be what
// Continue would load.
describe('Game saved game', () => {
  const PRIMARY = 'simlab.save.slot-1';
  const BACKUP = `${PRIMARY}.backup`;
  const saveIn = (sceneId: string, characterId = 'researcher-male', completed: string[] = []) =>
    JSON.stringify({
      version: SAVE_VERSION,
      savedAt: '2026-10-23T00:00:00.000Z',
      player: {
        characterId,
        sceneId,
        position: [0, 0, 0],
        yaw: 0,
        pitch: 0,
        equipment: [],
        inventory: { stacks: [], selected: 0 },
      },
      world: { entityStates: {}, containers: {}, objects: {}, clockS: 300 },
      progression: {
        completedExperiments: completed,
        procedures: {},
        tasks: { active: null, done: [] },
        papers: [],
        scores: [],
      },
    } satisfies SaveData);
  const cases: [string, Record<string, string>, string | null][] = [
    ['no save', {}, null],
    ['a save in the hub', { [PRIMARY]: saveIn('simlab-hub') }, 'simlab-hub'],
    ['a save in a laboratory', { [PRIMARY]: saveIn('physics-lab') }, 'physics-lab'],
    [
      'a damaged save, good backup',
      { [PRIMARY]: 'x', [BACKUP]: saveIn('simlab-hub') },
      'simlab-hub',
    ],
    ['a damaged save and backup', { [PRIMARY]: 'x', [BACKUP]: '{"version":2}' }, null],
    ['a character that is gone', { [PRIMARY]: saveIn('physics-lab', 'nobody') }, null],
    ['a scene that is gone', { [PRIMARY]: saveIn('old-lab') }, null],
    ['a menu scene', { [PRIMARY]: saveIn('main-menu') }, null],
  ];

  for (const [name, saved, expected] of cases) {
    it(`${name}: ${expected ?? 'none'}, read only, as Continue decides`, async () => {
      const storage = new MemorySaveStorage();
      for (const [key, value] of Object.entries(saved)) storage.write(key, value);
      const { game } = await bootTestGame({ storage });
      const state = structuredClone(game.state);
      const stored = new Map(storage.data);
      const publish = vi.spyOn(game.events, 'publish');

      expect(game.savedScene()).toBe(expected);
      expect(game.state).toEqual(state);
      expect(storage.data).toEqual(stored);
      expect(publish).not.toHaveBeenCalled();

      const result = await game.continueGame();
      expect(result.ok).toBe(expected !== null);
      if (expected) expect(game.state.session.sceneId).toBe(expected);
    });
  }

  it('follows the save, not the scene being played', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await bootTestGame({ storage });
    await game.newGame('researcher-male'); // autosaved in the preparation room
    expect(game.savedScene()).toBe('preparation-room');
    storage.write(PRIMARY, saveIn('physics-lab'));
    expect(game.savedScene()).toBe('physics-lab');
    expect(game.state.session.sceneId).toBe('preparation-room');
  });

  const runs: [string, Record<string, string>, string[]][] = [
    ['no save', {}, []],
    ['a damaged save', { [PRIMARY]: 'x' }, []],
    ['a save Continue refuses', { [PRIMARY]: saveIn('old-lab', undefined, ['pendulum']) }, []],
    ['a save with no runs', { [PRIMARY]: saveIn('simlab-hub') }, []],
    [
      'runs, one repeated and one gone from the content',
      { [PRIMARY]: saveIn('simlab-hub', undefined, ['pendulum', 'free-fall', 'pendulum', 'old']) },
      ['pendulum', 'free-fall'],
    ],
  ];
  for (const [name, saved, expected] of runs) {
    it(`completed runs from ${name}: ${expected.join(', ') || 'none'}, read only`, async () => {
      const storage = new MemorySaveStorage();
      for (const [key, value] of Object.entries(saved)) storage.write(key, value);
      const { game } = await bootTestGame({ storage });
      const stored = new Map(storage.data);
      expect([...(await game.savedCompletedExperiments())]).toEqual(expected);
      expect(storage.data).toEqual(stored);
    });
  }
});

// What `completedExperiments` means: a run of the experiment ended by itself, at least once.
describe('Game progression', () => {
  const ended = (experimentId: string, endReason: 'model' | 'time-limit') =>
    ({ runId: 'run-1', experimentId, sessionId: 'test', endReason, results: {} }) as const;

  it('records an experiment once, however many of its runs end by themselves', async () => {
    const { game } = await bootTestGame();
    game.events.publish('ExperimentCompleted', ended('free-fall', 'model'));
    game.events.publish('ExperimentCompleted', ended('free-fall', 'model'));
    expect(game.state.progression.completedExperiments).toEqual(['free-fall']);
  });

  it('does not record a run the time limit cut short', async () => {
    const { game } = await bootTestGame();
    game.events.publish('ExperimentCompleted', ended('pendulum', 'time-limit'));
    expect(game.state.progression.completedExperiments).toEqual([]);
  });

  it('starts a new game with none', async () => {
    const { game } = await bootTestGame();
    game.events.publish('ExperimentCompleted', ended('free-fall', 'model'));
    await game.newGame('researcher-male');
    expect(game.state.progression.completedExperiments).toEqual([]);
  });
});
