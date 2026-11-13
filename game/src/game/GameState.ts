import type { Quat, Vec3 } from '../core/math';
import type { CharacterDefinition } from '../gameplay/character';
import type { ContainerState } from '../simulation/liquid';
import type { EntityStateValue } from '../world/EntityStates';
import { NEW_GAME_S } from '../world/clock';

export type GamePhase = 'booting' | 'loading' | 'menu' | 'playing';

/** Runtime-only session data; never saved. */
export interface SessionState {
  phase: GamePhase;
  sceneId: string | null;
  /** Play paused (pause menu): every system is updated with dt 0, so nothing advances. */
  paused: boolean;
  /**
   * The station whose workspace is open (one at a time; `WorkspaceSystem` its only writer), null
   * or absent when none is: the player then stands still.
   */
  workspace?: string | null;
  /**
   * The Explain view open at a station (`ExplainSystem` its only writer), and the principle's step
   * shown; null or absent when none is: the player then stands still, as at a workspace.
   */
  explain?: { stationId: string; step: number } | null;
  /**
   * The test paper held up in front of the eyes to do or read (Phase Y-5, `PaperSystem` its only
   * writer), a paper id; null or absent when none is: the player then stands still.
   */
  paper?: string | null;
  /**
   * A conversation with a person of the world (`NpcSystem` its only writer, Phase Y): who, what
   * is shown — their greeting, their choices, their farewell — and which of their lines; null or
   * absent when none is: the player then stands still, as at a workspace.
   */
  conversation?: {
    npcId: string;
    stage: ConversationStage;
    line: number;
    /** The station being explained (Phase Y-2), when there is one. */
    stationId?: string;
  } | null;
}

/**
 * What a conversation shows: the greeting and the choices; a farewell; asking which simulation
 * to explain, talking while leading the way, giving up; a lecture at a station, the question after
 * it (the board) and thanks (Phase Y-2).
 */
export type ConversationStage =
  | 'greeting'
  | 'menu'
  | 'farewell'
  | 'ask'
  | 'waiting'
  | 'cancel'
  | 'lecture'
  | 'board'
  | 'thanks'
  | 'lesson'
  | 'lesson-end'
  | 'script';

export interface PlayerState {
  characterId: string | null;
  /** The player's own character, when the game is played as it (`CUSTOM_ID`); saved with it. */
  custom: CharacterDefinition | null;
  /** Feet position in metres. */
  position: Vec3;
  yaw: number;
  pitch: number;
  /** Derived from the character's height when a game starts. */
  eyeHeight: number;
  /**
   * How far (m) the eye has leaned in along the view (`gameplay/player/lean.ts`; 0 upright). The
   * PlayerSystem eases it; the renderer draws the eye there. Not saved.
   */
  lean: number;
  /**
   * How far (rad) the eyes look from `pitch` while an action shows the hands at work (the
   * ActionSystem's `glance`, eased by the PlayerSystem; the view and the head add it). Not saved.
   */
  glance: number;
  /** Body height (m) for the collision capsule, from the character. */
  height: number;
  roomId: string | null;
  /** Desired horizontal velocity (m/s) from input; the physics system turns it into motion. */
  moveIntent: Vec3;
  /** Standing on something, as reported by the physics character controller. */
  grounded: boolean;
  /** Item ids the player is wearing (lab coat, goggles, gloves, ...). Saved. */
  equipment: string[];
  /** What the player carries (InventorySystem is its only writer). Saved. */
  inventory: InventoryState;
  /** Sitting or lying on furniture (RestSystem), or null. Not saved. */
  rest: RestState | null;
  /** Getting up: the view eases from `from` back to the eye as `t` runs 0 → 1. Not saved. */
  rising: { from: Vec3; t: number } | null;
}

/** Sitting or lying (Phase F-1): on what, where the view is drawn from, asleep. */
export interface RestState {
  entityId: string;
  kind: 'sit' | 'lie';
  /** The seat (or the middle of the mattress at the pillow) in the world. */
  at: Vec3;
  /** Where the view is drawn from while resting. */
  eye: Vec3;
  /** The way the body faces (yaw). */
  facing: number;
  asleep: boolean;
  /** Seconds resting. */
  seconds: number;
}

/**
 * One inventory slot's content: instances of one item, each the entity id `<room>/<placement>`
 * it was placed as. Its count is `placements.length`; the last one comes out first.
 */
export interface InventoryStack {
  slot: number;
  item: string;
  placements: string[];
}

/** Stacks by slot (sorted, one per slot; slots 0–8 are the hotbar) and the selected hotbar slot. */
export interface InventoryState {
  stacks: InventoryStack[];
  selected: number;
}

/** Where an object stands in its own scene's coordinates (a moved container). */
export interface ObjectPose {
  position: Vec3;
  rotation: Quat;
}

export interface WorldState {
  /** Per-entity key/value state (open, active, ...), keyed by stable entity id. */
  entityStates: Record<string, Record<string, EntityStateValue>>;
  /**
   * What each physical-lab container holds (integer µL by material), keyed by entity id; made from
   * its placement on first attach. StationSystem is its only writer. Saved (v4).
   */
  containers: Record<string, ContainerState>;
  /**
   * Where containers moved off their placements stand (their scene's coordinates), applied when
   * they spawn; written when a save is captured or their scene goes. Saved (v4). Containers only.
   */
  objects: Record<string, ObjectPose>;
  /** The time of day, seconds into the game's 15-minute day (world/clock.ts). Saved (v9). */
  clockS: number;
}

/** Progress through one procedure: completed step ids (a prefix of its steps) and entry. */
export interface ProcedureProgress {
  completed: string[];
  entered: boolean;
}

/** Guided tasks (v5): the one being followed and its step, and those finished. Saved. */
export interface TaskProgress {
  active: { id: string; step: number } | null;
  done: string[];
}

/**
 * A test paper the hub's teacher wrote (Phase Y-5), carried in the inventory as an instance of the
 * `test-paper` item under its `id`. Its questions are fixed when it is written (bank ids, each
 * choice question's printed order); the answers are the player's: a printed option (0–3) or
 * each statement's true/false; `crossed` keeps what was circled before and crossed out (a choice
 * question: printed options; true/false: 2·statement + (true ? 1 : 0)). Marked once handed in.
 */
export interface PaperRecord {
  id: string;
  /** The teacher's numbering: Đề số n. */
  number: number;
  /** Who set it (an npc id): it is handed in to them. */
  teacher: string;
  request: {
    experiments: string[];
    count: number;
    types: ('choice' | 'true-false')[];
    levels: ('recognise' | 'understand' | 'apply' | 'analyse')[];
    seed: number;
  };
  items: { experiment: string; question: string; order: number[] }[];
  answers: (number | null | (boolean | null)[])[];
  crossed: number[][];
  /** Its mark (points of the most, out of 10), once handed in; null before. */
  marked: { points: number; max: number; score: number } | null;
  /** When it was written (`world.clockS` then). */
  writtenAtS: number;
}

/** A paper's mark, kept after the paper is thrown away (Phase Y-5). */
export interface ScoreRecord {
  paper: number;
  experiments: string[];
  points: number;
  max: number;
  score: number;
}

export interface ProgressionState {
  completedExperiments: string[];
  /** Keyed by procedure id. Saved. */
  procedures: Record<string, ProcedureProgress>;
  tasks: TaskProgress;
  /** Test papers the player has (v11), and the marks of every paper handed in. Saved. */
  papers: PaperRecord[];
  scores: ScoreRecord[];
}

/**
 * The single source of truth for mutable game data. Systems receive the root object and read
 * their section on access; sections are mutated in place, never replaced, so references held by
 * systems stay valid. New sections (time, NPCs, health, ...) are added here, then to the save
 * schema with a version bump.
 */
export interface GameState {
  session: SessionState;
  player: PlayerState;
  world: WorldState;
  progression: ProgressionState;
}

export const DEFAULT_EYE_HEIGHT = 1.6;
export const DEFAULT_HEIGHT = 1.7;

export function createGameState(): GameState {
  return {
    session: { phase: 'booting', sceneId: null, paused: false },
    player: {
      characterId: null,
      custom: null,
      position: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      eyeHeight: DEFAULT_EYE_HEIGHT,
      lean: 0,
      glance: 0,
      rest: null,
      rising: null,
      height: DEFAULT_HEIGHT,
      roomId: null,
      moveIntent: [0, 0, 0],
      grounded: false,
      equipment: [],
      inventory: { stacks: [], selected: 0 },
    },
    world: { entityStates: {}, containers: {}, objects: {}, clockS: NEW_GAME_S },
    progression: {
      completedExperiments: [],
      procedures: {},
      tasks: { active: null, done: [] },
      papers: [],
      scores: [],
    },
  };
}

/** Clears per-playthrough data in place (new game). */
export function resetPlaythrough(state: GameState): void {
  state.world.entityStates = {};
  state.world.containers = {};
  state.world.objects = {};
  state.world.clockS = NEW_GAME_S;
  state.progression.completedExperiments = [];
  state.progression.procedures = {};
  state.progression.tasks = { active: null, done: [] };
  state.progression.papers = [];
  state.progression.scores = [];
  state.player.equipment = [];
  state.player.inventory = { stacks: [], selected: 0 };
  state.player.roomId = null;
}
