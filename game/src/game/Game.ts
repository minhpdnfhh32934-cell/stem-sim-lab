import { resolveConfig, type GameConfig } from '../core/config';
import { Disposables, EventBus, type Unsubscribe } from '../core/EventBus';
import { createTexts, type Language, type Texts } from '../core/i18n';
import { Logger, type LogSink } from '../core/Logger';
import { Registry } from '../core/Registry';
import { fail, ok, type Result } from '../core/schema';
import { describeError, type GameSystem, SystemRunner } from '../core/SystemRunner';
import { ActionSystem } from '../gameplay/action/ActionSystem';
import { coreContent } from '../content/core';
import { type CharacterDefinition, CUSTOM_ID, eyeHeightOf } from '../gameplay/character';
import { DoorSystem, slidingPairs } from '../gameplay/door/DoorSystem';
import { HingeSystem } from '../gameplay/door/HingeSystem';
import { SlidingSystem } from '../gameplay/door/SlidingSystem';
import { StationSystem } from '../gameplay/experiment/StationSystem';
import { WorkspaceSystem } from '../gameplay/experiment/WorkspaceSystem';
import { ExplainSystem } from '../gameplay/experiment/ExplainSystem';
import { Peers } from '../multiplayer/Peers';
import { NpcSystem } from '../gameplay/npc/NpcSystem';
import { PaperSystem } from '../gameplay/papers/PaperSystem';
import { BUILT_IN_BEHAVIORS } from '../gameplay/interaction/behaviors';
import { InteractionSystem } from '../gameplay/interaction/InteractionSystem';
import { InventorySystem } from '../gameplay/inventory/InventorySystem';
import { CircuitSystem } from '../gameplay/circuit/CircuitSystem';
import { FireSystem } from '../gameplay/fire/FireSystem';
import { HitSystem } from '../gameplay/player/HitSystem';
import { RestSystem } from '../gameplay/player/RestSystem';
import { PHONE_ID, PHONE_ITEM, PhoneSystem } from '../gameplay/phone/PhoneSystem';
import { HeldTargets } from '../gameplay/lab/HeldTargets';
import { TaskGuide } from '../gameplay/task/TaskGuide';
import { TaskSystem } from '../gameplay/task/TaskSystem';
import { LiquidSystem } from '../gameplay/lab/LiquidSystem';
import { InputState } from '../gameplay/player/InputState';
import { Equipment } from '../gameplay/player/Equipment';
import { PlayerSystem } from '../gameplay/player/PlayerSystem';
import { GaitSystem } from '../gameplay/player/gait';
import { ClockSystem } from '../world/clock';
import { ProcedureSystem } from '../gameplay/procedure/ProcedureSystem';
import { stepItem } from '../gameplay/procedure/procedure';
import { ProgressionSystem } from '../gameplay/ProgressionSystem';
import { PhysicsSystem } from '../physics/PhysicsSystem';
import { ContainerSave } from '../persistence/containerSave';
import type { SaveData } from '../persistence/saveData';
import {
  fromStoredRun,
  MemoryRunHistoryStore,
  toStoredRun,
  type RunHistoryStore,
} from '../persistence/runHistory';
import { applySave, SaveSystem, type SaveStorage } from '../persistence/SaveSystem';
import { SaveSlots } from '../persistence/saveSlots';
import type { RunRecord } from '../simulation/RunRecord';
import {
  type AudioBus,
  type FrameCap,
  type GraphicsQuality,
  loadFrameCap,
  loadGraphicsQuality,
  graphicsQualityChosen,
  loadLanguage,
  loadMuted,
  loadLookSensitivity,
  loadRoomSleep,
  loadTiltInvert,
  loadTiltLook,
  loadTiltSensitivity,
  loadVolumes,
  type LookSensitivity,
  saveFrameCap,
  saveGraphicsQuality,
  saveLanguage,
  saveMuted,
  saveLookSensitivity,
  saveRoomSleep,
  saveTiltInvert,
  saveTiltLook,
  saveTiltSensitivity,
  saveVolume,
} from '../persistence/settings';
import { ExperimentSystem } from '../simulation/ExperimentSystem';
import type { SimulationModel } from '../simulation/SimulationModel';
import { continuePose } from '../world/arrival';
import { EntityStates } from '../world/EntityStates';
import { SceneManager } from '../world/SceneManager';
import { World } from '../world/World';
import {
  addLabContent,
  addQuestionBanks,
  buildCoreContent,
  type CodeRegistries,
  type Content,
  type LabPack,
  type RawContent,
} from './content';
import type { GameEvents } from './GameEvents';
import { createGameState, resetPlaythrough, type GameState } from './GameState';

export interface GameOptions {
  storage: SaveStorage;
  /** Where ended runs are kept between visits (IndexedDB in the browser); in memory without it. */
  history?: RunHistoryStore;
  /** Partial config overrides, validated against GameConfigSchema. */
  config?: unknown;
  logSink?: LogSink;
  /**
   * Defaults to the bundled content: the core at boot, the lab pack's when it loads. Tests pass
   * whole fixtures; their experiments and topics then stand for the pack's, checked when it loads.
   */
  content?: RawContent;
  /** Defaults to the lab pack's simulation models; tests pass fixtures. */
  models?: readonly SimulationModel[];
  /** Loads the lab pack in place of its own chunk and the fixtures above (tests). */
  labPack?: () => Promise<LabPack>;
  /** Platform systems (input, renderer) run after the game systems each frame. */
  platformSystems?: (game: Game) => GameSystem[];
  /**
   * Lets a frame go through (the browser: the next animation frame): a neighbour scene's placements are then
   * spawned a few at a time while its door stays shut. Without it (tests), all at once.
   */
  pause?: () => Promise<void>;
  /**
   * Whether the scene behind a closed door is attached as the player walks up to it (DoorSystem
   * `prepareAhead`; default true). Tests of the attach-on-request policy turn it off
   * (`bootTestGame` does unless asked).
   */
  prepareDoorsAhead?: boolean;
}

export type BootStage =
  'configuration' | 'core-services' | 'content' | 'game-state' | 'systems' | 'initial-scene';

export class BootError extends Error {
  constructor(
    readonly stage: BootStage,
    cause: unknown,
  ) {
    super(`Boot failed during ${stage}: ${describeError(cause)}`, { cause });
    this.name = 'BootError';
  }
}

interface CoreServices {
  config: GameConfig;
  code: CodeRegistries;
  log: Logger;
  events: EventBus<GameEvents>;
  content: Content;
  state: GameState;
  storage: SaveStorage;
  history: RunHistoryStore;
  labPack: () => Promise<LabPack>;
  /** The question banks, unvalidated (Phase Y-4): a chunk of their own. */
  questions: () => Promise<unknown>;
  pause?: () => Promise<void>;
  prepareDoorsAhead?: boolean;
}

/**
 * Composition root: the only place that knows every system. It builds them in a fixed order
 * with explicit dependencies (no singletons, no service locator), runs the boot pipeline and
 * exposes the few game-level commands the UI needs.
 */
/** How the player looks round: see `Game.controls`. */
export interface ControlSettings {
  lookSensitivity: LookSensitivity;
  tiltLook: boolean;
  tiltSensitivity: LookSensitivity;
  tiltInvert: boolean;
}

export class Game {
  readonly config: GameConfig;
  readonly log: Logger;
  readonly events: EventBus<GameEvents>;
  readonly content: Content;
  readonly state: GameState;
  readonly input = new InputState();
  readonly world: World;
  readonly entityStates: EntityStates;
  readonly equipment: Equipment;
  readonly systems: SystemRunner;
  readonly scenes: SceneManager;
  readonly player: PlayerSystem;
  readonly physics: PhysicsSystem;
  /** The player's walk: the legs' swing and the footsteps (Phase S). */
  readonly gait: GaitSystem;
  /** The time of day (Phase V): what the hub shows outside follows it. */
  readonly clock: ClockSystem;
  /** Walk-through doors: when leaves move and neighbour scenes come and go. */
  readonly doors: DoorSystem;
  /** Hinged leaves (a cabinet's doors, the washroom door): how far they are open. */
  readonly hinges: HingeSystem;
  readonly sliders: SlidingSystem;
  readonly interaction: InteractionSystem;
  /** Actions acted out (Phase H-3): which plays, for how long; the player waits meanwhile. */
  readonly actions: ActionSystem;
  readonly inventory: InventorySystem;
  /** The free circuit bench (Phase E): boards, their parts and leads, the circuits solved. */
  readonly circuits: CircuitSystem;
  /** Fire (Phase E-2): where it burns and spreads, the extinguisher, the brigade on 114. */
  readonly fires: FireSystem;
  /** The player's phone (Phase E-2b): out of the bag into the hand, the number dialled, its call. */
  readonly phone: PhoneSystem;
  /** Sitting and lying on furniture, asleep (Phase F-1). */
  readonly rest: RestSystem;
  /** Being hit by what is thrown (Phase F-1). */
  readonly hits: HitSystem;
  /** Pours and inversions of held glassware, detected; the stations commit them. */
  readonly liquids: LiquidSystem;
  /** What the held object can act on now, asked of the rules (outlines, task steps). */
  readonly heldTargets: HeldTargets;
  /** The guided task followed (Phase A): its step, done from what the world reports. */
  readonly tasks: TaskSystem;
  /** Where the followed task leads: the floor path and the step's objects (Phase A). */
  readonly taskGuide: TaskGuide;
  readonly procedures: ProcedureSystem;
  readonly experiments: ExperimentSystem;
  readonly stations: StationSystem;
  /** Which station's workspace is open (one at a time). */
  readonly workspace: WorkspaceSystem;
  /** The Explain view at a station (its parts, its principle; the hub teacher's door). */
  readonly explain: ExplainSystem;
  readonly npcs: NpcSystem;
  /** The LAN room this game is in and the other players in it (Phase M), never saved. */
  readonly peers: Peers;
  /** The hub teacher's tests (Phase Y-5). */
  readonly papers: PaperSystem;
  readonly progression: ProgressionSystem;
  readonly saves: SaveSystem;
  /** The games kept in this browser: single-player games and LAN rooms, each its own save. */
  readonly slots: SaveSlots;
  /** The save played, continued and saved to (the last played at start). */
  private slot: string;
  /** Where moved glassware stands, kept in saves and applied as it spawns (save v4). */
  readonly containerSaves: ContainerSave;
  /** Player-facing text in the current language; systems and views share this one. */
  readonly texts: Texts;
  private readonly subscriptions = new Disposables();
  /** Steps awaited with physics before each world scene is built (addWorldPreparation). */
  private readonly worldPreparations = new Set<() => Promise<void>>();
  /** Steps awaited after a neighbour scene is attached, before a door opens to it. */
  private readonly attachSettles = new Set<(sceneId: string) => Promise<void>>();
  private readonly storage: SaveStorage;
  private readonly history: RunHistoryStore;
  private readonly code: CodeRegistries;
  private readonly importLab: () => Promise<LabPack>;
  private readonly importQuestions: () => Promise<unknown>;
  /** The question banks' load (shared like the lab pack's); null after a failure. */
  private questions: Promise<void> | null = null;
  private questionsAdded = false;
  /** The lab pack's load, shared by every caller while it runs and once done; null after a failure. */
  private lab: Promise<void> | null = null;
  /** The pack is added once: a retry after a later failure must not add its models again. */
  private labAdded = false;
  private currentLanguage: Language;
  private currentFrameCap: FrameCap;
  private currentGraphicsQuality: GraphicsQuality;
  private readonly currentVolumes: Record<AudioBus, number>;
  private currentlyMuted: boolean;
  private currentRoomSleep: boolean;
  private readonly currentControls: ControlSettings;
  /** The player picked a preset (now or on an earlier visit): no default is suggested over it. */
  private qualityChosen: boolean;

  private constructor(core: CoreServices) {
    const { config, log, events, content, state } = core;
    this.config = config;
    this.log = log;
    this.events = events;
    this.content = content;
    this.state = state;
    this.storage = core.storage;
    this.history = core.history;
    this.code = core.code;
    this.importLab = core.labPack;
    this.importQuestions = core.questions;
    this.currentLanguage = loadLanguage(core.storage, log.child('Settings'));
    this.currentFrameCap = loadFrameCap(core.storage, log.child('Settings'));
    this.currentGraphicsQuality = loadGraphicsQuality(core.storage, log.child('Settings'));
    this.currentVolumes = loadVolumes(core.storage, log.child('Settings'));
    this.currentlyMuted = loadMuted(core.storage, log.child('Settings'));
    this.currentRoomSleep = loadRoomSleep(core.storage, log.child('Settings'));
    const settingsLog = log.child('Settings');
    this.currentControls = {
      lookSensitivity: loadLookSensitivity(core.storage, settingsLog),
      tiltLook: loadTiltLook(core.storage, settingsLog),
      tiltSensitivity: loadTiltSensitivity(core.storage, settingsLog),
      tiltInvert: loadTiltInvert(core.storage, settingsLog),
    };
    this.qualityChosen = graphicsQualityChosen(core.storage);
    this.texts = createTexts(content.strings, () => this.currentLanguage);
    this.world = new World(events);
    this.entityStates = new EntityStates(state, events);
    this.equipment = new Equipment(state, events);
    this.systems = new SystemRunner(log.child('Systems'));
    const firstCharacter = content.characters.all()[0];
    if (!firstCharacter) throw new Error('The content has no character.');
    this.peers = new Peers({
      events,
      texts: this.texts,
      fallback: firstCharacter,
      offsetOf: (sceneId) => this.scenes.offsetOf(sceneId),
      // The others stand in physics as the world's people do: no one walks through anyone.
      agents: {
        placeAgent: (id, x, z, height) => this.physics.placeAgent(id, x, z, height),
        removeAgent: (id) => this.physics.removeAgent(id),
      },
    });
    this.containerSaves = new ContainerSave({
      state,
      events,
      rooms: content.rooms,
      items: content.items,
      experiments: content.experiments,
      log: log.child('Containers'),
      held: () => this.interaction.heldId,
    });

    this.scenes = new SceneManager({
      ...content,
      world: this.world,
      state,
      events,
      log: log.child('Scenes'),
      // Rapier is downloaded the first time a world scene is needed, never for the menu; registered
      // preparations (addWorldPreparation) run alongside it. Attaching a neighbour awaits them too.
      prepareWorld: () => this.prepareWorld(),
      ...(core.pause ? { pause: core.pause } : {}),
      settleAttach: async (sceneId) => {
        await Promise.all(Array.from(this.attachSettles, (step) => step(sceneId)));
      },
      // What the player carries is not also in the world: its placement is not spawned.
      away: (entityId) => this.inventory.holds(entityId) || this.circuits.holds(entityId),
      texts: this.texts,
    });
    this.player = new PlayerSystem({
      state,
      input: this.input,
      world: this.world,
      events,
      config,
      holding: () => this.interaction.heldId !== null,
      pourGoal: () => this.interaction.pourGoal,
      action: () => this.actions,
      lineOfSight: { castRay: (o, d, max) => this.physics.castRay(o, d, max) },
      sensitivity: () => this.currentControls.lookSensitivity,
    });
    this.gait = new GaitSystem({ state, world: this.world, events });
    this.clock = new ClockSystem(state);
    this.physics = new PhysicsSystem({
      state,
      world: this.world,
      entityStates: this.entityStates,
      events,
      config,
      log: log.child('Physics'),
      texts: this.texts,
    });
    const procedural = (id: string) =>
      content.procedures.all().some((p) => p.entrance === id || p.exits.includes(id));
    // Read live: a load or Continue replaces the position array, a character its height.
    const capsule = {
      get position() {
        return state.player.position;
      },
      get yaw() {
        return state.player.yaw;
      },
      radius: config.player.radius,
      get halfHeight() {
        return Math.max(state.player.height / 2, config.player.radius + 0.05); // as the capsule
      },
    };
    this.doors = new DoorSystem({
      pairs: slidingPairs(this.scenes.doorPairs, (id) => content.items.tryGet(id), procedural),
      scenes: this.scenes,
      driver: this.physics,
      player: capsule,
      events,
      texts: this.texts,
      log: log.child('Doors'),
      prepareAhead: core.prepareDoorsAhead ?? true,
    });
    this.hinges = new HingeSystem({
      events,
      entityStates: this.entityStates,
      driver: this.physics,
      player: capsule,
      entities: () => this.world.allEntities(),
      bodies: this.physics,
    });
    this.sliders = new SlidingSystem({
      events,
      driver: this.physics,
      player: capsule,
      entities: () => this.world.allEntities(),
    });
    this.interaction = new InteractionSystem({
      busy: () => this.actions.busy || this.phone.out || this.state.player.rest !== null,
      defer: (entityId, actionId, perform) => this.actions.defer(entityId, actionId, perform),
      state,
      input: this.input,
      events,
      behaviors: core.code.behaviors,
      texts: this.texts,
      entityStates: this.entityStates,
      equipment: this.equipment,
      config,
      log: log.child('Interaction'),
      // Physics moves held bodies and answers line-of-sight rays; interaction only decides.
      holder: this.physics,
      lineOfSight: this.physics,
      doors: this.doors,
      hinges: this.hinges,
      items: content.items,
    });
    this.actions = new ActionSystem({
      state,
      events,
      world: this.world,
      actions: content.actions,
      procedures: content.procedures,
    });
    // People of the world (Phase Y): their capsules in physics, their targets in interaction.
    this.inventory = new InventorySystem({
      state,
      input: this.input,
      events,
      world: this.world,
      rooms: content.rooms,
      items: content.items,
      hands: this.interaction,
      texts: this.texts,
      log: log.child('Inventory'),
      // A test paper (Phase Y-5): an item carried only in the bag, an instance by its paper id.
      virtual: (itemId, id) =>
        content.items.tryGet(itemId)?.inventory?.virtual === true &&
        ((itemId === PHONE_ITEM && id === PHONE_ID) ||
          state.progression.papers.some((p) => p.id === id)),
      use: (itemId, id) => itemId === PHONE_ITEM && id === PHONE_ID && this.phone.takeOut(),
      busy: () => this.phone.out,
    });
    this.circuits = new CircuitSystem({
      state,
      events,
      world: this.world,
      entityStates: this.entityStates,
      rooms: content.rooms,
      items: content.items,
      hands: this.interaction,
      interaction: this.interaction,
      texts: this.texts,
      log: log.child('Circuits'),
      reach: config.player.reach,
      burning: (entityId) => this.fires.burning(entityId),
    });
    this.rest = new RestSystem({ state, input: this.input, events, world: this.world });
    this.hits = new HitSystem({
      state,
      events,
      world: this.world,
      others: () => this.peers.players,
    });
    this.phone = new PhoneSystem({
      state,
      input: this.input,
      events,
      selected: () => this.inventory.at(this.inventory.selected)?.placements.at(-1) ?? null,
      handsFull: () => this.interaction.heldId !== null,
      call: (number) => this.fires.call(number),
    });
    this.fires = new FireSystem({
      state,
      events,
      world: this.world,
      entityStates: this.entityStates,
      input: this.input,
      hands: this.interaction,
      log: log.child('Fire'),
    });
    this.procedures = new ProcedureSystem({
      state,
      events,
      world: this.world,
      entityStates: this.entityStates,
      equipment: this.equipment,
      procedures: content.procedures,
      items: content.items,
      texts: this.texts,
      guards: this.interaction,
      doors: this.doors,
      log: log.child('Procedures'),
    });
    this.experiments = new ExperimentSystem({
      experiments: content.experiments,
      models: core.code.models,
      events,
      log: log.child('Experiments'),
    });
    this.stations = new StationSystem({
      state,
      events,
      world: this.world,
      entityStates: this.entityStates,
      experiments: this.experiments,
      hands: this.interaction,
      driver: this.physics,
      guards: this.interaction,
      texts: this.texts,
      log: log.child('Stations'),
      homes: this.containerSaves,
      bodies: this.physics,
      lockedBy: (stationId) => this.peers.holder(stationId),
    });
    this.liquids = new LiquidSystem({
      state,
      input: this.input,
      events,
      world: this.world,
      lineOfSight: this.physics,
      rules: this.stations,
      hands: this.interaction,
      steps: () => this.physics.stepsThisFrame,
      fixedStep: config.physics.fixedStep,
    });
    this.heldTargets = new HeldTargets({
      hands: this.interaction,
      rules: this.stations,
      world: this.world,
      events,
    });
    this.tasks = new TaskSystem({
      state,
      events,
      tasks: content.tasks,
      world: this.world,
      entityStates: this.entityStates,
      held: () => this.interaction.heldId,
      stationCompleted: (id) => this.stations.view(id)?.session.state === 'completed',
      log: log.child('Tasks'),
    });
    this.taskGuide = new TaskGuide({
      state,
      events,
      world: this.world,
      itemOf: (id) => content.items.tryGet(id),
      active: () => this.tasks.active,
      procedureItem: () => {
        const procedure = this.procedures.activeProcedure();
        const step = procedure ? this.procedures.view(procedure.id).step : null;
        return step ? stepItem(step) : null;
      },
    });
    this.workspace = new WorkspaceSystem({ state, events, stations: this.stations });
    this.explain = new ExplainSystem({
      state,
      events,
      input: this.input,
      texts: this.texts,
      world: this.world,
      stations: this.stations,
      interaction: this.interaction,
      lineOfSight: this.physics,
      suspended: () => this.npcs.following,
    });
    this.npcs = new NpcSystem({
      state,
      events,
      texts: this.texts,
      npcs: content.npcs,
      scenes: content.scenes,
      rooms: content.rooms,
      itemOf: (id) => content.items.tryGet(id),
      interaction: this.interaction,
      agents: this.physics,
      drivenBy: (npcId) => this.peers.holder(`npc:${npcId}`),
      offsetOf: (id) => this.scenes.offsetOf(id),
      doorPairs: this.scenes.doorPairs,
      doors: this.doors,
      stations: this.stations,
      explain: this.explain,
      world: this.world,
      // The clean area's entrance is the player's own way in, by its steps: people do not take it.
      barred: new Set(content.procedures.all().map((p) => p.entrance)),
      models: (id) => core.code.models.tryGet(id),
    });
    this.papers = new PaperSystem({
      actions: this.actions,
      items: content.items,
      state,
      events,
      texts: this.texts,
      input: this.input,
      log: log.child('Papers'),
      npcDefinitions: content.npcs,
      npcs: this.npcs,
      inventory: this.inventory,
      interaction: this.interaction,
      world: this.world,
      experiments: content.experiments,
      modelOf: (id) => core.code.models.tryGet(id),
      banks: content.questions,
      loadQuestions: () => this.loadQuestions(),
    });
    this.progression = new ProgressionSystem(state, events);
    this.slots = new SaveSlots(core.storage, this.config.game.saveSlot);
    this.slot = this.slots.latest()?.id ?? this.config.game.saveSlot;
    this.saves = new SaveSystem({
      storage: core.storage,
      state,
      events,
      log: log.child('Save'),
      texts: this.texts,
      // Saves keep the player's place in the current scene's own coordinates.
      origin: () => this.scenes.origin,
      beforeCapture: () => this.containerSaves.capture(),
    });

    // Update order: world → player intent → physics (moves the player, settles objects) → what
    // the player looks at → pours from the held pose physics wrote (fed to a run the same frame)
    // → walk-through doors and hinged leaves (an E press seen the same frame) → what the player
    // carries → procedure rules (timed steps) → experiment simulations → station apparatus
    // (projectiles follow the runs) → what the held object can act on → progress.
    for (const system of [
      // First to hear of a spawn, so physics makes a moved container's body where it was left.
      this.containerSaves,
      this.clock,
      this.scenes,
      this.player,
      // People walk before the step that moves their capsules, and turn the talking player's view.
      this.npcs,
      this.papers,
      // The other players eased towards their last poses before anything reads where they are.
      this.peers,
      this.physics,
      this.gait,
      this.interaction,
      this.actions,
      this.liquids,
      this.doors,
      this.hinges,
      this.sliders,
      this.inventory,
      // After the inventory: its Q takes the phone out; the phone's Q then puts it away.
      this.phone,
      this.rest,
      this.hits,
      this.circuits,
      this.fires,
      this.procedures,
      this.experiments,
      this.stations,
      this.heldTargets,
      this.tasks,
      this.taskGuide,
      this.workspace,
      this.explain,
      this.progression,
    ]) {
      this.systems.add(system);
    }
  }

  /**
   * Boot pipeline: configuration → core services → content → game state → systems →
   * initial scene. Any failure is reported as a BootError naming the stage.
   */
  static async boot(options: GameOptions): Promise<Game> {
    let stage: BootStage = 'configuration';
    let game: Game | null = null;
    try {
      const config = resolveConfig(options.config);

      stage = 'core-services';
      const log = Logger.create(config.debug.logLevel, options.logSink);
      const events = new EventBus<GameEvents>(log.child('Events'));
      log.info('Booting SIMLAB');

      stage = 'content';
      const code: CodeRegistries = {
        behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
        models: new Registry('simulation model'), // the lab pack's, when it loads
      };
      const content = buildCoreContent(options.content ?? coreContent, code);
      content.scenes.get(config.game.initialScene);
      if (content.scenes.get(config.game.newGameScene).kind !== 'world') {
        throw new Error(`New-game scene "${config.game.newGameScene}" must be a world scene`);
      }

      stage = 'game-state';
      const state = createGameState();

      stage = 'systems';
      game = new Game({
        config,
        code,
        log,
        events,
        content,
        state,
        storage: options.storage,
        history: options.history ?? new MemoryRunHistoryStore(),
        labPack: options.labPack ?? (() => importLabPack(options)),
        questions: () => importQuestions(options),
        ...(options.pause ? { pause: options.pause } : {}),
        ...(options.prepareDoorsAhead === undefined
          ? {}
          : { prepareDoorsAhead: options.prepareDoorsAhead }),
      });
      for (const system of options.platformSystems?.(game) ?? []) game.systems.add(system);
      await game.systems.initAll();
      game.subscriptions.add(
        events.subscribe('SceneLoaded', ({ kind }) => {
          if (kind === 'world') game?.save(); // autosave on every room change
        }),
      );
      // Walking into a neighbour scene is a room change too.
      game.subscriptions.add(events.subscribe('SceneEntered', () => game?.save()));
      // And once the door behind the player has closed (the scene left is then released).
      game.subscriptions.add(
        events.subscribe('DoorChanged', ({ state }) => {
          if (state === 'closed') game?.save();
        }),
      );
      // A completion is saved when it is recorded, not later at a door: progress a player made is
      // not lost to a closed tab or a crash. A failed save is reported (SaveFailed) and the
      // completion, kept in memory, goes into the next save.
      game.subscriptions.add(events.subscribe('ProgressionRecorded', () => game?.save()));
      // A scene change (a door, Back to the main menu, the developer jump) ends a pause.
      game.subscriptions.add(events.subscribe('SceneLoading', () => game?.resume()));
      // Ended runs go to the run history store, apart from the save: its failures are reported
      // (RunHistoryFailed) and never reach the progression save. The store is read with the lab
      // pack (loadLab), whose experiments the runs belong to.
      game.subscriptions.add(
        events.subscribe('RunRecorded', ({ record, dropped }) => game?.keepRun(record, dropped)),
      );

      stage = 'initial-scene';
      await game.scenes.load(config.game.initialScene);
      log.info('SIMLAB ready');
      return game;
    } catch (error) {
      game?.dispose();
      throw new BootError(stage, error);
    }
  }

  /**
   * Registers a step awaited before every world scene is built, alongside physics (e.g. a part of
   * the platform loaded on demand). They all start at once and must all succeed: a rejection aborts
   * the load before anything is torn down, and the next world load calls the step again, so a step
   * shares its own work between calls, as physics does. Never run for the menu.
   */
  addWorldPreparation(step: () => Promise<void>): Unsubscribe {
    this.worldPreparations.add(step);
    return () => {
      this.worldPreparations.delete(step);
    };
  }

  /**
   * Registers a step awaited after a neighbour scene is attached and before `attach` resolves, so
   * the door that asked for it opens only once it is done (the renderer compiles the new scene's
   * shaders here, off the frame). A rejection is logged; the scene stays attached.
   */
  addAttachSettle(step: (sceneId: string) => Promise<void>): Unsubscribe {
    this.attachSettles.add(step);
    return () => {
      this.attachSettles.delete(step);
    };
  }

  private async prepareWorld(): Promise<void> {
    await Promise.all([
      this.physics.load(),
      this.loadLab(),
      ...Array.from(this.worldPreparations, (step) => step()),
    ]);
  }

  /**
   * Loads the lab pack — the experiment definitions, their topics, the simulation models, the items
   * only the labs place and those placements, a chunk of its own never downloaded for the menu —
   * validates it against the core content and adds it to the registries and rooms, then gives the
   * stations the runs kept from earlier visits. Every world scene and Continue wait for it; the
   * catalog starts it. Concurrent and repeated calls share one load; after a failure (nothing
   * added) the next call tries again.
   */
  loadLab(): Promise<void> {
    this.lab ??= this.addLab().catch((error: unknown) => {
      this.lab = null;
      this.log.error('Experiments could not be loaded', error);
      const reason = describeError(error);
      throw new Error(
        this.texts.ui('lab.loadFailed', 'Experiments could not be loaded: {reason}', { reason }),
        { cause: error },
      );
    });
    return this.lab;
  }

  /**
   * Loads the question banks (Phase Y-4) — a chunk of their own, downloaded the first time a test
   * is set, never with the lab pack — after the lab pack, and validates them against it before
   * anything uses them (`addQuestionBanks`). Shared like `loadLab`; after a failure (nothing
   * added) the next call tries again.
   */
  loadQuestions(): Promise<void> {
    this.questions ??= (async () => {
      await this.loadLab();
      if (this.questionsAdded) return;
      addQuestionBanks(this.content, this.code, await this.importQuestions());
      this.questionsAdded = true;
    })().catch((error: unknown) => {
      this.questions = null;
      this.log.error('Question banks could not be loaded', error);
      throw error;
    });
    return this.questions;
  }

  private async addLab(): Promise<void> {
    if (!this.labAdded) {
      addLabContent(this.content, this.code, await this.importLab());
      this.labAdded = true;
    }
    await this.loadRunHistory();
  }

  /**
   * The player's own character as the game knows it (made on the character page): among the
   * characters under `CUSTOM_ID`, replacing any before.
   */
  setCustomCharacter(character: CharacterDefinition): void {
    this.content.characters.put({ ...character, id: CUSTOM_ID });
  }

  async newGame(characterId: string): Promise<void> {
    const character = this.content.characters.get(characterId);
    resetPlaythrough(this.state);
    this.forgetExperiments();
    this.state.player.characterId = character.id;
    this.state.player.custom = character.id === CUSTOM_ID ? structuredClone(character) : null;
    this.state.player.eyeHeight = eyeHeightOf(character);
    this.state.player.height = character.appearance.heightM;
    this.log.info(`New game as "${character.id}"`);
    this.inventory.carry(PHONE_ITEM, PHONE_ID); // the player's own phone, from the start
    await this.scenes.load(this.config.game.newGameScene);
  }

  hasSavedGame(): boolean {
    return this.saves.hasSave(this.slot);
  }

  /** The world scene Continue would load, or null when it would refuse the save. Reads only. */
  savedScene(): string | null {
    const save = this.readSave();
    return save.ok ? save.value.scene.id : null;
  }

  /**
   * What a kept game's card on the menu shows (any slot, not only the one in use): where the
   * player was left, as whom, and how many experiments its save has run to an end (unique ids,
   * as saved: the lab pack may not be loaded on the menu). Reads only; null without a readable save.
   */
  slotSummary(
    slotId: string,
  ): { scene: string | null; character: string | null; completed: number } | null {
    const loaded = this.saves.load(slotId);
    if (!loaded.ok) return null;
    const { player, progression } = loaded.value;
    const scene = this.content.scenes.tryGet(player.sceneId);
    const character =
      player.custom && player.characterId === CUSTOM_ID
        ? player.custom
        : this.content.characters.tryGet(player.characterId);
    return {
      scene: scene ? this.texts.of(scene, 'displayName') : null,
      character: character ? this.texts.of(character, 'displayName') : null,
      completed: new Set(progression.completedExperiments).size,
    };
  }

  /**
   * The experiments the save Continue would load has run to a natural end at least once — only
   * those the content still has (a save may keep gone or repeated ids), so once the lab pack has
   * loaded (this loads it). Reads only.
   */
  async savedCompletedExperiments(): Promise<ReadonlySet<string>> {
    await this.loadLab();
    const save = this.readSave();
    const ids = save.ok ? save.value.data.progression.completedExperiments : [];
    return new Set(ids.filter((id) => this.content.experiments.tryGet(id) !== undefined));
  }

  async continueGame(): Promise<Result<SaveData>> {
    const save = this.readSave();
    if (!save.ok) return save;
    // The labs' placements are the pack's: where a carried item came from, what the saved spot
    // must be clear of. Physics and the renderer load beside it (the scene reuses those loads);
    // a failure changes nothing here.
    await this.prepareWorld();
    const { data, character, scene } = save.value;
    // A game played as the player's own character brings it back as it was then.
    if (data.player.custom) this.setCustomCharacter(data.player.custom);
    applySave(this.state, data);
    this.inventory.sanitize(); // before the scene spawns: what is carried is not placed again
    this.inventory.carry(PHONE_ITEM, PHONE_ID); // a save from before the phone gets it too
    this.containerSaves.sanitize(); // glassware: poses in their rooms, contents of their experiment
    this.forgetExperiments();
    this.state.player.eyeHeight = eyeHeightOf(character);
    this.state.player.height = character.appearance.heightM;
    // Never in a solid, off the floor or in a doorway (a save older than the content, a crossing).
    const player = this.state.player;
    const stand = continuePose(
      scene.rooms.map((id) => this.content.rooms.get(id)),
      scene.spawn,
      (id) => this.content.items.tryGet(id),
      { radius: this.config.player.radius, height: player.height },
      player.position,
    );
    if (stand) {
      this.log.warn(
        `Saved position ${player.position.join(', ')} in "${scene.id}" is not free; ` +
          `Continue places the player at ${stand.position.join(', ')}`,
      );
      player.position = [...stand.position];
      player.yaw = stand.yaw;
      player.pitch = 0;
    }
    await this.scenes.load(scene.id, { placePlayer: false });
    this.events.publish('GameLoaded', { slot: this.slot });
    return ok(data);
  }

  /** The save Continue loads (its backup if it is damaged), if its character and scene exist. */
  private readSave() {
    const loaded = this.saves.load(this.slot);
    if (!loaded.ok) return loaded;
    const data = loaded.value;
    const character =
      data.player.custom && data.player.characterId === CUSTOM_ID
        ? { ...data.player.custom, id: CUSTOM_ID }
        : this.content.characters.tryGet(data.player.characterId);
    const scene = this.content.scenes.tryGet(data.player.sceneId);
    if (!character || scene?.kind !== 'world') {
      return fail(
        this.texts.ui(
          'save.missingContent',
          'The saved game refers to a character or scene that no longer exists',
        ),
      );
    }
    return ok({ data, character, scene });
  }

  /**
   * Gives the stations the runs kept from earlier visits (with the lab pack: before any station
   * exists). If the store cannot be read, the game goes on with an empty history (reported);
   * invalid or orphaned records are skipped (logged).
   */
  private async loadRunHistory(): Promise<void> {
    let stored: unknown[];
    try {
      stored = await this.history.load();
    } catch (error) {
      this.historyFailed('Could not read the run history', error);
      return;
    }
    const records: RunRecord[] = [];
    for (const value of stored) {
      const record = fromStoredRun(value, this.content.experiments);
      if (record.ok) records.push(record.value);
      else this.log.warn(record.error);
    }
    this.experiments.restore(records);
    this.log.info(`Run history: ${records.length} run(s) kept from before`);
  }

  /** Writes an ended run to the store (and removes the one it pushed out); never throws. */
  private keepRun(record: RunRecord, dropped: string | null): void {
    Promise.resolve()
      .then(() => this.history.put(toStoredRun(record)))
      .then(() => (dropped ? this.history.delete(dropped) : undefined))
      .catch((error: unknown) =>
        this.historyFailed(`Could not keep ${record.runId} in the run history`, error),
      );
  }

  private historyFailed(what: string, error: unknown): void {
    this.log.warn(what, error);
    this.events.publish('RunHistoryFailed', { reason: describeError(error) });
  }

  /**
   * Runs and checklists belong to a playthrough (the configuration lives in entity states); the
   * ended runs stay, for the run history belongs to the browser (see ExperimentSystem.clear).
   */
  private forgetExperiments(): void {
    this.experiments.clear();
    this.stations.clear();
  }

  /** Saves the current playthrough; does nothing outside of play. */
  save(): Result<SaveData> | null {
    if (this.state.session.phase !== 'playing') return null;
    const saved = this.saves.save(this.slot);
    if (saved.ok) this.slots.touch(this.slot);
    return saved;
  }

  /** The save played now (`slots`' id). */
  get currentSlot(): string {
    return this.slot;
  }

  /**
   * Plays in another save from now on: New game starts in it, Continue loads it, saving writes to
   * it. Only from the menu (a game in play keeps its own).
   */
  useSlot(id: string): void {
    if (this.state.session.phase === 'playing')
      throw new Error('Cannot change saves while playing');
    this.slot = id;
  }

  /** The interface language: English until the player picks another, then restored each visit. */
  get language(): Language {
    return this.currentLanguage;
  }

  /** Switches every text at once (`texts` follows), remembers the choice and tells the views. */
  setLanguage(language: Language): void {
    this.currentLanguage = language;
    saveLanguage(this.storage, language, this.log.child('Settings'));
    this.events.publish('LanguageChanged', { language });
  }

  /**
   * The frame-rate cap (frames per second, 0 for none): how often the frame loop (main.ts) runs
   * the game and draws it. Only the pace of frames — every system still advances by real time, so
   * physics, movement and experiment runs are the same under any cap.
   */
  get frameCap(): FrameCap {
    return this.currentFrameCap;
  }

  /** Applies a cap from the next frame and remembers it, apart from the language. */
  setFrameCap(cap: FrameCap): void {
    this.currentFrameCap = cap;
    saveFrameCap(this.storage, cap, this.log.child('Settings'));
  }

  /**
   * Whether the page draws without a graphics card (SwiftShader and the like), as the renderer
   * found when it started: the Ultra dialog warns of it.
   */
  softwareRenderer = false;
  /** The GPU drawing the world (WEBGL_debug_renderer_info), for the F3 overlay; '' until known. */
  gpuName = '';

  /** The graphics quality preset; only the renderer reads what it means (render/quality.ts). */
  get graphicsQuality(): GraphicsQuality {
    return this.currentGraphicsQuality;
  }

  /** Switches the preset at once (the renderer follows) and remembers it, apart from the rest. */
  setGraphicsQuality(quality: GraphicsQuality): void {
    this.qualityChosen = true;
    this.currentGraphicsQuality = quality;
    saveGraphicsQuality(this.storage, quality, this.log.child('Settings'));
    this.events.publish('GraphicsQualityChanged', { quality });
  }

  /**
   * Whether rooms out of sight are neither drawn nor kept on the GPU (world/dormancy.ts; the
   * renderer follows). Only what is drawn: physics, runs and everything else go on in every room.
   */
  get roomSleep(): boolean {
    return this.currentRoomSleep;
  }

  /** Turns it on or off at once (the renderer follows) and remembers it, apart from the rest. */
  setRoomSleep(on: boolean): void {
    this.currentRoomSleep = on;
    saveRoomSleep(this.storage, on, this.log.child('Settings'));
    this.events.publish('RoomSleepChanged', { on });
  }

  /**
   * How the player looks round (browser preferences, apart from every save): the look sensitivity
   * (× the configured one: the mouse, a finger's drag, a gamepad's stick), and on a phone or tablet
   * looking by tilting it (its gyroscope), how far, and its directions reversed.
   */
  get controls(): Readonly<ControlSettings> {
    return this.currentControls;
  }

  /** Changes one at once and remembers it, apart from the rest. */
  setControl<K extends keyof ControlSettings>(key: K, value: ControlSettings[K]): void {
    this.currentControls[key] = value;
    const log = this.log.child('Settings');
    const c = this.currentControls;
    if (key === 'lookSensitivity') saveLookSensitivity(this.storage, c.lookSensitivity, log);
    else if (key === 'tiltLook') saveTiltLook(this.storage, c.tiltLook, log);
    else if (key === 'tiltSensitivity') saveTiltSensitivity(this.storage, c.tiltSensitivity, log);
    else saveTiltInvert(this.storage, c.tiltInvert, log);
    this.events.publish('ControlSettingsChanged', {});
  }

  /** The sound's volumes (%, the settings' steps): the overall one and one per kind of sound. */
  get volumes(): Readonly<Record<AudioBus, number>> {
    return this.currentVolumes;
  }

  /** Whether the sound is muted (the volumes kept for when it is not). */
  get muted(): boolean {
    return this.currentlyMuted;
  }

  /** Sets a volume at once (the sound follows) and remembers it, apart from the rest. */
  setVolume(bus: AudioBus, volume: number): void {
    this.currentVolumes[bus] = volume;
    saveVolume(this.storage, bus, volume, this.log.child('Settings'));
    this.events.publish('AudioSettingsChanged', {});
  }

  setMuted(muted: boolean): void {
    this.currentlyMuted = muted;
    saveMuted(this.storage, muted, this.log.child('Settings'));
    this.events.publish('AudioSettingsChanged', {});
  }

  /**
   * A preset for this machine (the renderer suggests Low on a software renderer or graphics built
   * into the processor, and one step lower when frames stay slow: `lowered`), taken only while the
   * player has never picked one, and not remembered: their own choice always wins.
   */
  preferGraphicsQuality(quality: GraphicsQuality, reason: string, lowered = false): void {
    if (this.qualityChosen || quality === this.currentGraphicsQuality) return;
    this.log.info(`Graphics quality ${quality} by default: ${reason}`);
    this.currentGraphicsQuality = quality;
    this.events.publish('GraphicsQualityChanged', lowered ? { quality, lowered } : { quality });
  }

  /**
   * Pauses play: from the next frame every system gets dt 0 — no physics step, no experiment
   * step, no timer, no movement — and held keys are dropped. Only while playing.
   */
  pause(): void {
    if (this.state.session.phase !== 'playing' || this.state.session.paused) return;
    this.state.session.paused = true;
    this.input.reset();
    this.events.publish('PauseChanged', { paused: true });
  }

  /** Resumes play where it stopped: frames go on with their own dt, nothing is made up. */
  resume(): void {
    if (!this.state.session.paused) return;
    this.state.session.paused = false;
    this.events.publish('PauseChanged', { paused: false });
  }

  /**
   * Back to the main menu from play: saves first (what a save keeps — the player's place, station
   * settings, completed experiments, procedures), then ends any run still running, unrecorded
   * (ended runs stay in the run history), and loads the menu. If saving fails, nothing is left: the caller decides (`force` leaves anyway).
   */
  async backToMenu(force = false): Promise<Result<null>> {
    if (this.state.session.phase !== 'playing') return fail('Not playing');
    const saved = this.save();
    if (saved && !saved.ok && !force) return fail(saved.error);
    this.forgetExperiments();
    await this.scenes.load(this.config.game.initialScene);
    return ok(null);
  }

  /** One frame: all systems in order (with dt 0 while paused), then input edges are cleared. */
  update(dt: number): void {
    this.systems.update(this.state.session.paused ? 0 : dt);
    this.input.endFrame();
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.systems.disposeAll();
    this.events.clear();
  }
}

/**
 * The lab pack from its own chunk (`labPack.ts`); tests' fixtures stand for its parts. A fixture is
 * whole: its items and placements are in the core already, so the pack adds none.
 */
/** The question banks from their own chunk (`content/questions.ts`); a fixture's own, if it has any. */
async function importQuestions({ content }: GameOptions): Promise<unknown> {
  if (content) return content.questions ?? [];
  const { questionBanks } = await import('../content/questions');
  return questionBanks;
}

async function importLabPack({ content, models }: GameOptions): Promise<LabPack> {
  const { labPack } = await import('./labPack');
  const { experiments, topics, tasks, items, placements } = content
    ? { ...content, items: [], placements: [] }
    : labPack;
  // A fixture without actions of its own plays the bundled ones.
  const actions = content?.actions ?? labPack.actions;
  return {
    experiments,
    topics,
    tasks,
    items,
    placements,
    actions,
    models: models ?? labPack.models,
  };
}
