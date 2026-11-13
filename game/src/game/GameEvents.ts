import type { ConversationStage } from './GameState';
import type { Language } from '../core/i18n';
import type { Vec3 } from '../core/math';
import type { EntityStateValue } from '../world/EntityStates';
import type { Floor } from '../world/definitions';
import type { WorldEntity } from '../world/World';
import type { ExperimentEndReason } from '../simulation/ExperimentRuntime';
import type { SessionState } from '../simulation/ExperimentSession';
import type { GraphicsQuality } from '../persistence/settings';
import type { RunRecord } from '../simulation/RunRecord';

export type ExperimentCommandName =
  'load' | 'unload' | 'run' | 'stop' | 'reset' | 'adjust' | 'set' | 'setup' | 'clear' | 'view';

/**
 * Catalogue of every game event and its payload. Adding a system usually means adding its
 * events here; publishers and subscribers then share one checked contract.
 */
/** What a container control asks for (`ContainerRequested`). */
export type ContainerAction =
  | 'fill'
  | 'deliver'
  | 'drops'
  | 'stopper'
  | 'unstopper'
  | 'clamp'
  | 'unclamp'
  | 'raise-clamp'
  | 'lower-clamp'
  | 'open-tap'
  | 'close-tap'
  | 'record';

export interface GameEvents {
  SceneLoading: { sceneId: string };
  SceneLoaded: { sceneId: string; kind: 'menu' | 'world' };
  SceneUnloaded: { sceneId: string };
  /**
   * `arrival`: entity id of the door in the new scene the player comes out of (doors set it).
   * Without it the player is put at the scene's spawn — the developer scene jump does this.
   */
  SceneChangeRequested: { sceneId: string; arrival?: string };
  /**
   * A neighbour scene's placements are about to be spawned (a few a frame, its door shut); then
   * `SceneAttached`, or `SceneDetached` if it is given up.
   */
  SceneAttaching: { sceneId: string };
  /** A neighbour scene was spawned beside the current one, at its campus place (no load). */
  SceneAttached: { sceneId: string };
  /** A neighbour scene was removed: released, torn down by a load, or a failed attach undone. */
  SceneDetached: { sceneId: string };
  /**
   * The player walked into a resident neighbour, now the current scene: nothing was loaded, torn
   * down or moved. `through`: the door of the previous scene leading to it nearest the player.
   */
  SceneEntered: { sceneId: string; previousSceneId: string; through: string | null };

  EntitySpawned: { entity: WorldEntity };
  EntityDespawned: { entityId: string };
  EntityStateChanged: { entityId: string; key: string; value: EntityStateValue };

  PlayerEnteredRoom: { roomId: string; previousRoomId: string | null };
  /** A foot of the player came down on the ground (GaitSystem), at the speed they walk (m/s). */
  Footstep: { foot: 'left' | 'right'; speed: number; floor: Floor };
  /**
   * A foot of a person of the world (Phase Y) came down, at the speed they walk (m/s), where
   * (session frame; read it during the call, it is reused).
   */
  NpcFootstep: {
    npcId: string;
    foot: 'left' | 'right';
    speed: number;
    position: Readonly<Vec3>;
  };
  /** A free dynamic body struck something (PhysicsSystem): its change of velocity (m/s), where. */
  Impact: { entityId: string; speed: number; position: Vec3 };
  /** A sliding door's leaf starts to open or to shut (SlidingSystem), the doorway's middle. */
  DoorSlid: { entityId: string; open: boolean; position: Vec3 };

  InteractionFocusChanged: { entityId: string | null };
  InteractionPerformed: { entityId: string; actionId: string };
  /** An offered action was refused, with the reason shown to the player. */
  ActionBlocked: { entityId: string; actionId: string; reason: string };
  /** What the aim is on, on a circuit board, changed (a socket, a part, the supply's panel). */
  CircuitAimChanged: { boardId: string };
  /** The circuit on a circuit board changed (CircuitSystem): saved and solved again. */
  CircuitChanged: {
    boardId: string;
    cause:
      | 'plug-in'
      | 'take-off'
      | 'lead'
      | 'unlead'
      | 'switch'
      | 'adjust'
      | 'damage'
      | 'replace'
      | 'remote';
  };
  /**
   * What heat did on a circuit board (Phase E-2): a part (`itemId`) or a lead (null) began to
   * smoke, caught fire, failed open (burnt, blown, a cell dead), burnt out (a lamp) or melted (a
   * lead); with the power heating it (W), its voltage and current, and where on the board [x, z].
   */
  CircuitIncident: {
    boardId: string;
    what: 'smoke' | 'fire' | 'failed' | 'burnt-out' | 'melted';
    itemId: string | null;
    watts: number;
    volts: number;
    amps: number;
    at: [number, number];
  };
  /** A part held is handed back at its cabinet (a broken one swapped for a sound one). */
  CircuitPartReturned: { entityId: string };
  /** A fire on an entity has grown enough to ruin it (the fire system). */
  EntityBurnt: { entityId: string };
  /** A fire started on an entity, or went out there. */
  FireChanged: { entityId: string; burning: boolean };
  /** What the player is told about fire: too close, the extinguisher empty, all out, the brigade. */
  FireNotice: { what: 'too-close' | 'empty' | 'out' | 'brigade-arrived' };
  /** The hub's laptop opened (E): its view starts it up (Phase F-2). */
  LaptopOpened: { entityId: string };
  /** The player asks to sit or lie on a piece of furniture (the RestSystem decides). */
  RestRequested: { entityId: string };
  /** Sat down, lay down, fell asleep, or got up (`kind` null; `jolted`: woken by a hit). */
  RestChanged: { kind: 'sit' | 'lie' | null; asleep: boolean; jolted: boolean };
  /** Something thrown hit the player (HitSystem): the screen flashes, a sleeper wakes. */
  PlayerHit: { entityId: string; speed: number };
  /** A person of the world said `text` to another player of the room (`with`): heard nearby. */
  NpcHeard: { npcId: string; text: string; with: string };
  /** Something this player threw hit another player of the room (`id`): their game is told. */
  PeerHit: { id: string; speed: number };
  /** The phone taken out or put away, or its call moved on (ringing, talking, ended). */
  PhoneChanged: { out: boolean; call: 'idle' | 'ringing' | 'talking' };
  /** A call made on the player's phone and how it went (Phase E-2). */
  EmergencyCall: {
    number: string;
    outcome: 'dispatched' | 'already-coming' | 'false-alarm' | 'other-service' | 'no-answer';
  };
  /** A walk-through door's travel action; DoorSystem decides. */
  DoorRequested: { entityId: string };
  DoorChanged: {
    doorIds: readonly [string, string];
    state: 'closed' | 'preparing' | 'opening' | 'open' | 'closing' | 'blocked';
  };
  /** `discarded`: taken off into a waste bin (used disposable PPE), not put back. */
  EquipmentChanged: { itemId: string; worn: boolean; discarded?: boolean };
  /**
   * What the player carries changed: put away (which may select its hotbar slot), taken out,
   * moved (split, merged, swapped), or the hotbar selection.
   */
  InventoryChanged: { cause: 'stow' | 'take-out' | 'move' | 'select' };
  ItemInspected: { entityId: string; itemId: string };
  ObjectGrabbed: { entityId: string };
  /**
   * The hold ended: dropped, set down (glassware, lowered onto the aimed spot by physics) or thrown
   * by the player, or forced (scene change, despawn, stuck).
   */
  ObjectReleased: {
    entityId: string;
    reason:
      'drop' | 'set-down' | 'throw' | 'placed' | 'scene-change' | 'despawned' | 'out-of-reach';
    velocity: Readonly<Vec3>;
  };

  /**
   * A held object was accepted for a set-down onto `surfaceId` (null: the floor), into its `seat`
   * (null: a free spot); physics lowers it there next (ObjectReleased `set-down` follows).
   */
  ObjectSetDown: { entityId: string; surfaceId: string | null; seat: string | null };
  /**
   * A container control asks (the `container` and `clamp` behaviours): fill the held pipette
   * from `entityId`, deliver it into `entityId`, let the held dropper bottle's drops fall into
   * `entityId`, put in / take out `entityId`'s stopper, clamp the held vessel in `entityId`'s
   * clamp or take `entityId` out of one, open or close `entityId`'s tap, record its reading (the
   * player ends the run). The StationSystem decides and commits; its guard already said why not.
   */
  ContainerRequested: {
    entityId: string;
    action: ContainerAction;
  };
  /** One pour ended (tipped back, moved off, let go): `volumeUl` went from `from` into `to`. */
  LiquidPoured: { from: string; to: string; volumeUl: number };

  /** A guided task was chosen (Phase A): its first step not already done is `step`. */
  TaskStarted: { taskId: string; step: number };
  /** The world did what a task step asked; the task goes on to `next` (= the count when done). */
  TaskStepCompleted: { taskId: string; stepId: string; next: number };
  /** Every step done. */
  TaskCompleted: { taskId: string };
  /** The player stopped following it. */
  TaskCancelled: { taskId: string };

  /** A timed step (e.g. rubbing hands) began; it completes unless cancelled. */
  ProcedureStepStarted: { procedureId: string; stepId: string; durationS: number };
  ProcedureStepCancelled: { procedureId: string; stepId: string; reason: string };
  ProcedureStepCompleted: { procedureId: string; stepId: string; index: number };
  /** Every step is done and the required equipment is worn: the entrance opens. */
  ProcedureReady: { procedureId: string };
  ProcedureEntered: { procedureId: string };
  /** Progress was forgotten (the player left the preparation area through an exit). */
  ProcedureReset: { procedureId: string; reason: string };

  ExperimentStarted: { runId: string; experimentId: string; sessionId: string };
  ExperimentCompleted: {
    runId: string;
    experimentId: string;
    sessionId: string;
    endReason: ExperimentEndReason;
    results: Readonly<Record<string, number>>;
  };
  ExperimentFailed: {
    runId: string | null;
    experimentId: string;
    sessionId: string | null;
    error: string;
  };
  /** A session moved between idle, configured, running, stopped and completed. */
  ExperimentStateChanged: { sessionId: string; experimentId: string; state: SessionState };
  ExperimentParameterChanged: { sessionId: string; parameterId: string; value: number };
  /**
   * A station control asks for something; the StationSystem decides, and a refused command does
   * nothing and is answered with `ActionBlocked` (`entityId` the station, `actionId` the command).
   * `set`: `parameter` to `value` (a preset or a step-grid value) · `setup`: mark workspace setup
   * `step` done · `clear`: empty the workspace bench (setup back to its first step).
   * `from`: the name of the other player in the room whose command this is (Phase M), shown on
   * this game's copy of the station, with `params`: that player's settings of it after the
   * command (followed first, so the copies agree). Absent for the player's own.
   */
  ExperimentCommand: {
    stationId: string;
    command: ExperimentCommandName;
    parameter?: string;
    direction?: 1 | -1;
    value?: number;
    step?: string;
    from?: string;
    params?: Readonly<Record<string, number>>;
  };
  /** Anything shown about a station changed (state, parameters, checklist, run progress end). */
  ExperimentStationChanged: { stationId: string };
  /** The player asked to work at a station's workspace (the `open-workspace` action). */
  WorkspaceRequested: { stationId: string };
  /** A station's workspace opened (one at a time): the player stops until it closes. */
  WorkspaceOpened: { stationId: string };
  /** The workspace closed (Exit, Esc, leaving the scene): the player is back in the 3D lab. */
  WorkspaceClosed: { stationId: string };
  /** The Explain view opened at a station (its parts named, its principle step by step). */
  ExplainOpened: { stationId: string };
  /** The Explain view shows another step of the principle. */
  ExplainStepChanged: { stationId: string; step: number };
  /** The Explain view closed (H, Esc, Close, leaving the scene). */
  ExplainClosed: { stationId: string };
  /** The player began talking with a person of the world (Phase Y): their greeting shows. */
  ConversationOpened: { npcId: string };
  /** The conversation moved on: their choices, or their farewell. */
  ConversationChanged: { npcId: string; stage: ConversationStage };
  /** The conversation ended (Goodbye, Esc, leaving the scene). */
  ConversationClosed: { npcId: string };
  /** A teacher finished writing a test (Phase Y-5): he calls the player (`text`, his words). */
  PaperReady: { npcId: string; text: string };
  /** A paper handed in: in the teacher's hand now; what he says as he takes it. */
  PaperHandedIn: { paperId: string; npcId: string; text: string };
  /** A test paper went into the bag. */
  PaperGiven: { paperId: string };
  /** A paper was held up to be done or read, or put down again. */
  PaperOpened: { paperId: string };
  PaperClosed: { paperId: string };
  /** An answer on a paper was circled (or changed). */
  PaperAnswered: { paperId: string; index: number };
  /** A paper was marked: its score out of 10. */
  PaperMarked: { paperId: string; score: number };
  /** A paper was thrown away. */
  PaperDiscarded: { paperId: string };
  /** The player asked to read a station's results (its results screen). */
  ExperimentResultsViewed: { stationId: string };

  GameSaved: { slot: string };
  /** A save could not be written (storage full or blocked…): what it was saved for stays in memory. */
  SaveFailed: { slot: string; reason: string };
  /**
   * A run that ended was frozen into its station's history (`dropped`: the oldest record it
   * pushed out, if any). The game keeps it in the run history store.
   */
  RunRecorded: { record: RunRecord; dropped: string | null };
  /**
   * The run history store could not be read or written: runs stay listed until the page closes,
   * but are not kept for the next visit. Never affects the progression save.
   */
  RunHistoryFailed: { reason: string };
  /** The graphics quality preset was changed in the settings. */
  /** `lowered`: taken by the game itself, its frames too slow on this machine (the HUD says so). */
  GraphicsQualityChanged: { quality: GraphicsQuality; lowered?: boolean };
  /** Rooms out of sight drawn again (off) or left out (on): Settings. */
  RoomSleepChanged: { on: boolean };
  /** A look setting changed (`Game.controls`): the settings and the touch controls follow. */
  ControlSettingsChanged: Record<string, never>;
  /**
   * An experiment counted as completed for the first time in this playthrough — a run of it ended
   * by itself (`endReason` 'model'). The game saves on it.
   */
  ProgressionRecorded: { experimentId: string };
  GameLoaded: { slot: string };
  /** The interface language changed: views showing text render it again. */
  LanguageChanged: { language: Language };
  /** A volume or the mute changed (`game.volumes`, `game.muted`). */
  AudioSettingsChanged: Record<string, never>;
  /** Play was paused or resumed (`Game.pause` / `Game.resume`). */
  PauseChanged: { paused: boolean };
  /** Another player came into, or left, the room this game is in (Phase M, `game.peers`). */
  PeerJoined: { name: string };
  PeerLeft: { name: string };
  /** The room, its players or its count changed (joined, left, someone came or went). */
  RoomChanged: Record<string, never>;
  /** A chat line said in the room (2026-11-12): by this player (`own`) or another. */
  ChatHeard: { name: string; text: string; own: boolean };
}
