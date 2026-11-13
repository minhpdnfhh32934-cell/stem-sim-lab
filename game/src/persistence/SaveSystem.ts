import type { EventBus } from '../core/EventBus';
import { ENGLISH, type Texts } from '../core/i18n';
import type { Logger } from '../core/Logger';
import type { Vec3 } from '../core/math';
import { fail, ok, type Result } from '../core/schema';
import { describeError } from '../core/SystemRunner';
import type { GameEvents } from '../game/GameEvents';
import type { GameState } from '../game/GameState';
import { parseSave, SAVE_VERSION, type SaveData } from './saveData';

/** Where save text lives: localStorage in the browser, files in a future desktop shell. */
export interface SaveStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class MemorySaveStorage implements SaveStorage {
  readonly data = new Map<string, string>();
  read(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.data.set(key, value);
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}

const keyOf = (slot: string) => `simlab.save.${slot}`;
const backupKeyOf = (slot: string) => `${keyOf(slot)}.backup`;

/** A slot's save and its backup, where they are kept. */
export const saveKeys = (slot: string): readonly [string, string] => [
  keyOf(slot),
  backupKeyOf(slot),
];

export interface SaveSystemDeps {
  storage: SaveStorage;
  state: GameState;
  events: EventBus<GameEvents>;
  log: Logger;
  now?: () => Date;
  /** The language of the reasons it gives (English without it). */
  texts?: Texts;
  /**
   * Where the current scene's own coordinates start in the session frame (SceneManager.origin):
   * saves keep the player's place in the scene's coordinates. Zero without it.
   */
  origin?: () => Readonly<Vec3>;
  /** Called first when a save is captured: brings live state into the game state (container poses). */
  beforeCapture?: () => void;
}

/**
 * Converts game state to versioned save data and back. Before overwriting a slot, the previous
 * readable save is kept as a backup, and loading falls back to it if the primary is damaged.
 */
export class SaveSystem {
  constructor(private readonly deps: SaveSystemDeps) {}

  capture(): SaveData {
    this.deps.beforeCapture?.();
    const { player, session, world, progression } = this.deps.state;
    if (player.characterId === null || session.sceneId === null) {
      throw new Error('Nothing to save: no game in progress');
    }
    const [x, y, z] = player.position;
    const [ox, oy, oz] = this.deps.origin?.() ?? [0, 0, 0];
    return {
      version: SAVE_VERSION,
      savedAt: (this.deps.now?.() ?? new Date()).toISOString(),
      player: {
        characterId: player.characterId,
        ...(player.custom ? { custom: structuredClone(player.custom) } : {}),
        sceneId: session.sceneId,
        position: [x - ox, y - oy, z - oz],
        yaw: player.yaw,
        pitch: player.pitch,
        equipment: [...player.equipment],
        inventory: structuredClone(player.inventory),
      },
      world: {
        entityStates: structuredClone(world.entityStates),
        containers: structuredClone(world.containers),
        objects: structuredClone(world.objects),
        clockS: world.clockS,
      },
      progression: {
        completedExperiments: [...progression.completedExperiments],
        procedures: structuredClone(progression.procedures),
        tasks: structuredClone(progression.tasks),
        papers: structuredClone(progression.papers),
        scores: structuredClone(progression.scores),
      },
    };
  }

  save(slot: string): Result<SaveData> {
    const { storage, events, log } = this.deps;
    try {
      const data = this.capture();
      const previous = storage.read(keyOf(slot));
      if (previous !== null && parseSave(previous).ok) storage.write(backupKeyOf(slot), previous);
      storage.write(keyOf(slot), JSON.stringify(data));
      log.debug(`Saved slot "${slot}"`);
      events.publish('GameSaved', { slot });
      return ok(data);
    } catch (error) {
      log.error(`Saving slot "${slot}" failed`, error);
      events.publish('SaveFailed', { slot, reason: describeError(error) });
      return fail(`Saving failed: ${describeError(error)}`);
    }
  }

  load(slot: string): Result<SaveData> {
    const { storage, log } = this.deps;
    const texts = this.deps.texts ?? ENGLISH;
    let primary: string | null;
    let backup: string | null;
    try {
      primary = storage.read(keyOf(slot));
      backup = storage.read(backupKeyOf(slot));
    } catch (error) {
      return fail(
        texts.ui('save.unreadable', 'Save storage is not readable: {reason}', {
          reason: describeError(error),
        }),
      );
    }
    if (primary === null) return fail(texts.ui('save.none', 'No saved game'));
    const result = parseSave(primary);
    if (result.ok) return result;
    const fallback = backup === null ? result : parseSave(backup);
    if (fallback.ok) {
      log.warn(`Save slot "${slot}" is unreadable; using its backup. Reason: ${result.error}`);
      return fallback;
    }
    return parseSave(primary, undefined, texts); // the same failure, as the player reads it
  }

  hasSave(slot: string): boolean {
    try {
      return this.deps.storage.read(keyOf(slot)) !== null;
    } catch {
      return false;
    }
  }
}

/** Writes save data into the live state in place (sections are never replaced). */
export function applySave(state: GameState, data: SaveData): void {
  state.player.characterId = data.player.characterId;
  state.player.custom = data.player.custom ?? null;
  state.player.position = [...data.player.position];
  state.player.yaw = data.player.yaw;
  state.player.pitch = data.player.pitch;
  state.player.roomId = null;
  state.world.entityStates = structuredClone(data.world.entityStates);
  state.world.containers = structuredClone(data.world.containers);
  state.world.objects = structuredClone(data.world.objects);
  state.world.clockS = data.world.clockS;
  state.progression.completedExperiments = [...data.progression.completedExperiments];
  state.player.equipment = [...data.player.equipment];
  state.player.inventory = structuredClone(data.player.inventory);
  state.progression.procedures = structuredClone(data.progression.procedures);
  state.progression.tasks = structuredClone(data.progression.tasks);
  state.progression.papers = structuredClone(data.progression.papers);
  state.progression.scores = structuredClone(data.progression.scores);
}
