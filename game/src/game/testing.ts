// Test helpers (imported only by *.test.ts files).
import type { Vec3 } from '../core/math';
import { Logger, type LogLevel } from '../core/Logger';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { Game, type GameOptions } from './Game';

export interface CapturedLog {
  level: LogLevel;
  channel: string;
  message: string;
}

export function captureLogger(level: LogLevel = 'debug'): { log: Logger; entries: CapturedLog[] } {
  const entries: CapturedLog[] = [];
  const log = Logger.create(level, (lvl, channel, message) =>
    entries.push({ level: lvl, channel, message }),
  );
  return { log, entries };
}

/** Boots the real game headless (no renderer, no DOM) with in-memory saves. */
export async function bootTestGame(options: Partial<GameOptions> = {}) {
  const entries: CapturedLog[] = [];
  const storage = options.storage ?? new MemorySaveStorage();
  const game = await Game.boot({
    // The attach-on-request policy the older tests assume; a test of attaching ahead asks for it.
    prepareDoorsAhead: false,
    storage,
    logSink: (level, channel, message) => entries.push({ level, channel, message }),
    ...options,
  });
  return { game, storage, logs: entries };
}

/** Lets pending promise continuations (async scene loads) run. */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Turns the player so the view ray passes through `target`. */
/**
 * Plays frames until no action acted out is playing (Phase H-3): the player's moves and presses
 * wait for one, as they do in play (at most 10 s: a step up to its target and a sequence).
 */
export function untilIdle(game: Game): void {
  for (let i = 0; i < 600 && game.actions.busy; i++) game.update(1 / 60);
}

export function lookAt(game: Game, target: Readonly<Vec3>): void {
  const p = game.state.player;
  const dx = target[0] - p.position[0];
  const dy = target[1] - (p.position[1] + p.eyeHeight);
  const dz = target[2] - p.position[2];
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

export function placePlayer(game: Game, position: Vec3, yaw = 0, pitch = 0): void {
  const p = game.state.player;
  p.position = [...position];
  p.yaw = yaw;
  p.pitch = pitch;
}

/**
 * The bundled content with the Chemistry Lab's titration bench as the 2D-workspace tests knew it
 * (the shipped one is physical since Phase B): the `titration-stand` rig at the station, none of
 * the physical bench's glassware. For tests that use the titration as a workspace fixture.
 */
export function withTitrationRig<T>(raw: T): T {
  const rooms = (raw as unknown as { rooms: { id: string; placements: Placement[] }[] }).rooms;
  const lab = rooms.find((r) => r.id === 'chemistry-lab');
  if (!lab) return raw;
  lab.placements = lab.placements
    .filter((p) => p.params?.station !== 'titration')
    .map((p) =>
      p.id === 'titration'
        ? { ...p, item: 'titration-stand', params: { experimentId: 'acid-base-titration' } }
        : p,
    );
  // The physical bench's guided task names its glassware: it goes with it.
  const withTasks = raw as unknown as { tasks?: { id: string }[] };
  if (withTasks.tasks)
    withTasks.tasks = withTasks.tasks.filter((t) => t.id !== 'titration-by-hand');
  return raw;
}
interface Placement {
  id: string;
  item: string;
  params?: Record<string, unknown>;
}

/**
 * The bundled content with the titration as the 2D workspace it was before Phase B (its rig at the
 * station, its four pieces, no tap drive, the flask set on the stand): for the tests of the 2D
 * titration workspace, which stays in the code as the content's way back (contract §10).
 */
export function withTitrationWorkspace<T>(raw: T): T {
  withTitrationRig(raw);
  type Step = { id: string; onto: string; by?: string; after?: string[] };
  type Def = {
    id: string;
    presentation: string;
    workspace: {
      pieces: { id: string }[];
      materials: { id: string }[];
      setup: Step[];
      drive?: unknown;
    };
  };
  const def = (raw as unknown as { experiments: Def[] }).experiments.find(
    (e) => e.id === 'acid-base-titration',
  );
  if (!def) return raw;
  def.presentation = '2d-workspace';
  const w = def.workspace;
  delete w.drive;
  w.pieces = w.pieces.filter((p) => ['stand', 'burette', 'flask', 'pipette'].includes(p.id));
  w.materials = w.materials.filter((m) => !m.id.startsWith('pipette-'));
  for (const step of w.setup) {
    delete step.by;
    if (step.id === 'tile') step.onto = 'stand';
  }
  return raw;
}
