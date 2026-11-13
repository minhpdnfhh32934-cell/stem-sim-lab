import { Disposables, type EventBus } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Logger } from '../../core/Logger';
import { directionFromYawPitch, type Vec3 } from '../../core/math';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import { heatStep, lampWear, type HeatSpec } from '../../simulation/circuitHeat';
import { solveCircuit, type Solution } from '../../simulation/circuitSolver';
import type { EntityStates } from '../../world/EntityStates';
import type { RoomDefinition } from '../../world/definitions';
import { entityFromPlacement, type World, type WorldEntity } from '../../world/World';
import { CHARRED_KEY } from '../fire/FireSystem';
import type { InteractionAction, Interactable } from '../interaction/InteractionSystem';
import type { ItemDefinition } from '../item';
import {
  type BoardSpec,
  type BoardState,
  type MountedPart,
  type Origin,
  type Spot,
  edgeNodes,
  LEAD_OHMS,
  netlist,
  type PartSpec,
  SWITCH_OHMS,
  nodeAt,
  partNodes,
  readBoard,
  spotAt,
  PART_AIM_HEIGHT,
  spotOf,
  type SpotCode,
} from './board';

/** The entity-state key a board's circuit is saved under (a JSON string: `BoardState`). */
export const CIRCUIT_KEY = 'circuit';
/** A part's entity state: damaged (burnt, blown, melted, dead) — it carries nothing on a board. */
export const BROKEN_KEY = 'broken';
/** How far round a replaced board (m) the soot is cleaned off. */
const CLEAN_RADIUS = 1.5;
/** How far a rheostat's slider moves per press: a tenth of its track. */
const RHEOSTAT_STEP = 0.1;
/**
 * A lead heating (Phase E-2): 30 cm of 0.5 mm² copper in PVC — about 1.3 g of copper and 1 g of
 * PVC (≈ 1.4 J/K), cooled by air over its 1.9 × 10⁻³ m² (≈ 15 W/m²K: 35 K/W). Its PVC fumes past
 * about 150 °C and burns past about 320 °C; the copper melts at 1085 °C. Illustrative thresholds.
 */
export const LEAD_HEAT: HeatSpec = {
  capacity: 1.4,
  resistance: 35,
  smoke: 130,
  ignite: 300,
  fail: 1060,
};

/** What the circuit bench needs from the player's hands (the interaction system). */
export interface CircuitHands {
  readonly heldEntity: WorldEntity | null;
  grab(entity: WorldEntity): boolean;
  place(): WorldEntity | null;
}

export interface CircuitSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  world: World;
  entityStates: EntityStates;
  rooms: Registry<RoomDefinition>;
  items: Registry<ItemDefinition>;
  hands: CircuitHands;
  interaction: { register(target: Interactable): () => void };
  texts: Texts;
  log: Logger;
  /** How far the player reaches (m): config.player.reach. */
  reach: number;
  /** Whether a fire burns on an entity now (the fire system), for what may be done meanwhile. */
  burning?: (entityId: string) => boolean;
}

/** One board in the world: its layout, what is on it, the circuit solved, what the aim is on. */
export interface Board {
  readonly entity: WorldEntity;
  readonly spec: BoardSpec;
  state: BoardState;
  solution: Solution | null;
  origins: Origin[];
  /** What the player aims at on it now (none past reach or off its face). */
  aim: Spot | null;
  /** The aim's spot as a code (-1: none), to tell when it moves. */
  aimCode: SpotCode;
  /** Where on its face [x, z] the aim is, while it is on it. */
  readonly aimAt: [number, number];
  /** Changes whenever what it holds or its circuit changes (views redraw then). */
  version: number;
  /** Each part's rise over the room (K) and, a lamp, the share of its life spent; by part. */
  partRise: number[];
  partWear: number[];
  /** Each lead's rise over the room (K), by lead. */
  wireRise: number[];
  /** Which solver part each mounted part and lead is (−1: none, it carries nothing). */
  partOrigin: number[];
  wireOrigin: number[];
}

/** A part's reading: the voltage across it (a to b), the current through it, the power it takes. */
export interface Reading {
  volts: number;
  amps: number;
  watts: number;
}

/**
 * The free circuit bench (Phú, Phase E-1): a board with a built-in supply, its parts taken from
 * the cabinet and plugged between neighbouring holes, joined by leads from hole to hole. This
 * system is its only rule authority: it decides what goes where, keeps the board's circuit in its
 * entity state (saved), solves it (`simulation/circuitSolver`) when it changes and gives each
 * part its reading. A part on a board is out of the world (its placement is not spawned:
 * `holds`), as a carried one is; taken off, it is the world object it was, in the hands.
 *
 * Aimed at with empty hands: a hole (or post) starts a lead, a second one ends it (F gives up);
 * a click on a hole takes its last lead off. On a part, E works it (a switch opens or closes, a
 * rheostat's slider goes up, F down; a cell or meter is turned round), a click takes it off (E
 * too for a part with nothing to work). On the supply's panel E raises its voltage, F lowers it.
 * Holding a part, E plugs it in on the edge aimed at.
 */
export class CircuitSystem implements GameSystem {
  readonly id = 'circuit';
  private readonly boards = new Map<string, Board>();
  private readonly unregister = new Map<string, () => void>();
  private readonly subscriptions = new Disposables();
  /** A lead begun at a node of a board, waiting for its other end. */
  private pending: { boardId: string; node: number } | null = null;
  private readonly eye: Vec3 = [0, 0, 0];
  private readonly dir: Vec3 = [0, 0, 0];
  private readonly scratch: Reading = { volts: 0, amps: 0, watts: 0 };
  /** Mounted ids by saved circuit string, so `holds` parses each saved board once. */
  private readonly mountedBy = new Map<string, Set<string>>();

  constructor(private readonly deps: CircuitSystemDeps) {}

  init(): void {
    const { events } = this.deps;
    this.subscriptions.add(
      events.subscribe('EntitySpawned', ({ entity }) => {
        if (entity.item.circuitBoard) this.add(entity, entity.item.circuitBoard);
      }),
    );
    this.subscriptions.add(
      events.subscribe('EntityDespawned', ({ entityId }) => this.remove(entityId)),
    );
    // A fire grown on a board burns it; on a loose part, the part is ruined (Phase E-2).
    this.subscriptions.add(events.subscribe('EntityBurnt', ({ entityId }) => this.burnt(entityId)));
    this.subscriptions.add(
      events.subscribe('CircuitPartReturned', ({ entityId }) => this.returnPart(entityId)),
    );
    for (const entity of this.deps.world.allEntities()) {
      if (entity.item.circuitBoard) this.add(entity, entity.item.circuitBoard);
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    for (const id of [...this.boards.keys()]) this.remove(id);
  }

  /** The boards in the world. */
  all(): IterableIterator<Board> {
    return this.boards.values();
  }

  /**
   * Another player of the room changed this board (Phase F-3: its `circuit` state, already set):
   * this game takes their circuit. A part they plugged in leaves this world (it is on the board,
   * out of this player's hands too); one they took off comes back to its shelf here (in their
   * hands there). Not resident here: the board reads the state when it comes.
   */
  adopt(boardId: string): void {
    const board = this.boards.get(boardId);
    if (!board) return;
    const { world, hands, items } = this.deps;
    const next = readBoard(board.spec, this.deps.entityStates.get(boardId, CIRCUIT_KEY));
    const before = new Set(board.state.parts.map((p) => p.id));
    const after = new Set(next.parts.map((p) => p.id));
    for (const id of after) {
      if (before.has(id) || !world.entity(id)) continue;
      if (hands.heldEntity?.id === id) hands.place();
      world.despawn(id);
    }
    for (const part of board.state.parts) {
      if (after.has(part.id) || world.entity(part.id)) continue;
      const item = items.tryGet(part.item);
      const home = item ? this.placementOf(part.id, item.id) : null;
      if (home && item) world.spawn(entityFromPlacement(home.room.id, home.placement, item));
    }
    if (this.pending?.boardId === boardId) this.pending = null;
    board.state = next;
    board.partRise = [];
    board.partWear = [];
    board.wireRise = [];
    this.solve(board);
    board.aimCode = -2;
    board.version++;
    this.deps.events.publish('CircuitChanged', { boardId, cause: 'remote' });
  }

  /** The lead begun and waiting for its other end, if any. */
  get pendingLead(): Readonly<{ boardId: string; node: number }> | null {
    return this.pending;
  }

  /** True while the instance (entity id) is plugged into a board, saved or in the world. */
  holds(entityId: string): boolean {
    for (const states of Object.values(this.deps.state.world.entityStates)) {
      const saved = states[CIRCUIT_KEY];
      if (typeof saved !== 'string') continue;
      let ids = this.mountedBy.get(saved);
      if (!ids) {
        ids = new Set<string>();
        try {
          const parsed = JSON.parse(saved) as { parts?: { id?: unknown }[] };
          for (const p of parsed.parts ?? []) if (typeof p.id === 'string') ids.add(p.id);
        } catch {
          // An unreadable circuit holds nothing (readBoard leaves it empty).
        }
        if (this.mountedBy.size > 64) this.mountedBy.clear();
        this.mountedBy.set(saved, ids);
      }
      if (ids.has(entityId)) return true;
    }
    return false;
  }

  /** A mounted part's reading on its board (zero before the board is solved). */
  reading(board: Board, index: number, out: Reading): Reading {
    out.volts = out.amps = out.watts = 0;
    const solution = board.solution;
    const part = board.state.parts[index];
    if (!solution || !part) return out;
    const [a, b] = partNodes(board.spec, part);
    out.volts = (solution.volts[a] ?? 0) - (solution.volts[b] ?? 0);
    const k = board.partOrigin[index] ?? -1;
    out.amps = k >= 0 ? (solution.amps[k] ?? 0) : 0;
    out.watts = out.volts * out.amps;
    return out;
  }

  /** The supply's output: its terminal voltage, the current it gives, whether it is limiting. */
  supply(board: Board): { volts: number; amps: number; limited: boolean } {
    const s = board.solution;
    if (!s) return { volts: 0, amps: 0, limited: false };
    const [plus, minus] = [
      board.spec.cols * board.spec.rows,
      board.spec.cols * board.spec.rows + 1,
    ];
    return {
      volts: (s.volts[plus] ?? 0) - (s.volts[minus] ?? 0),
      amps: -(s.amps[0] ?? 0),
      limited: s.limited[0] === 1,
    };
  }

  /** The current in lead `k` (A), 0 before the board is solved. */
  leadAmps(board: Board, k: number): number {
    const i = board.wireOrigin[k] ?? -1;
    return i >= 0 ? (board.solution?.amps[i] ?? 0) : 0;
  }

  update(dt = 0): void {
    const { state } = this.deps;
    const player = state.player;
    this.eye[0] = player.position[0];
    this.eye[1] = player.position[1] + player.eyeHeight;
    this.eye[2] = player.position[2];
    directionFromYawPitch(player.yaw, player.pitch, this.dir);
    const holding = this.deps.hands.heldEntity?.item.circuit !== undefined;
    for (const board of this.boards.values()) {
      this.aim(board, holding);
      if (dt > 0) this.heat(board, dt);
    }
  }

  // ---- heat and what it does (Phase E-2) ----------------------------------------------------

  /**
   * Heats every part and lead by the power it takes for `dt`: past its thresholds it smokes,
   * fails open (burnt, blown, melted, a cell dead) and, if it can, catches fire there; a lamp wears
   * by its life law and burns out. What fails is saved and the circuit solved again.
   */
  private heat(board: Board, dt: number): void {
    if (!board.solution) return;
    let damaged = false;
    for (let i = 0; i < board.state.parts.length; i++) {
      const part = board.state.parts[i];
      if (!part) continue;
      const spec = this.deps.items.tryGet(part.item)?.circuit;
      if (!spec) continue;
      const r = this.reading(board, i, this.scratch);
      if (spec.kind === 'lamp') {
        if (!spec.life || !spec.volts || part.broken) continue;
        const life = { volts: spec.volts, life: spec.life };
        const wear = (board.partWear[i] ?? 0) + lampWear(life, r.volts, dt);
        board.partWear[i] = wear;
        if (wear >= 1) {
          part.broken = true;
          damaged = true;
          this.incident(board, 'burnt-out', part, r, this.middle(board, part.edge));
        }
        continue;
      }
      const heat = spec.heat;
      if (!heat) continue;
      const watts = part.broken ? 0 : heatInput(spec, r);
      const was = board.partRise[i] ?? 0;
      const rise = heatStep(heat, was, watts, dt);
      board.partRise[i] = rise;
      if (part.broken) continue;
      if (heat.smoke !== undefined && was < heat.smoke && rise >= heat.smoke) {
        this.incident(board, 'smoke', part, r, this.middle(board, part.edge), watts);
      }
      const what =
        heat.ignite !== undefined && rise >= heat.ignite
          ? 'fire'
          : heat.fail !== undefined && rise >= heat.fail
            ? 'failed'
            : null;
      if (what) {
        part.broken = true;
        damaged = true;
        this.incident(board, what, part, r, this.middle(board, part.edge), watts);
      }
    }
    const smoke = LEAD_HEAT.smoke ?? Infinity;
    const ignite = LEAD_HEAT.ignite ?? Infinity;
    const fail = LEAD_HEAT.fail ?? Infinity;
    for (let k = board.state.wires.length - 1; k >= 0; k--) {
      const amps = this.leadAmps(board, k);
      const watts = amps * amps * LEAD_OHMS;
      const was = board.wireRise[k] ?? 0;
      const rise = heatStep(LEAD_HEAT, was, watts, dt);
      board.wireRise[k] = rise;
      // Nothing crossed this step: nothing to say or do (and nothing allocated).
      const smokes = was < smoke && rise >= smoke;
      const ignites = was < ignite && rise >= ignite;
      if (!smokes && !ignites && rise < fail) continue;
      const [m, n] = board.state.wires[k] ?? [0, 0];
      const [ax, az] = nodeAt(board.spec, m);
      const [bx, bz] = nodeAt(board.spec, n);
      const at: [number, number] = [(ax + bx) / 2, (az + bz) / 2];
      const r = { volts: amps * LEAD_OHMS, amps, watts };
      if (smokes) this.incident(board, 'smoke', null, r, at, watts);
      if (ignites) this.incident(board, 'fire', null, r, at, watts);
      if (rise >= fail) {
        board.state.wires.splice(k, 1);
        board.wireRise.splice(k, 1);
        damaged = true;
        this.incident(board, 'melted', null, r, at, watts);
      }
    }
    if (damaged) this.changed(board, 'damage');
  }

  /** The middle of edge `edge` on the board's face: [x, z]. */
  private middle(board: Board, edge: number): [number, number] {
    const [m, n] = edgeNodes(board.spec, edge);
    const [ax, az] = nodeAt(board.spec, m);
    const [bx, bz] = nodeAt(board.spec, n);
    return [(ax + bx) / 2, (az + bz) / 2];
  }

  private incident(
    board: Board,
    what: GameEvents['CircuitIncident']['what'],
    part: MountedPart | null,
    r: Reading,
    at: [number, number],
    watts = r.watts,
  ): void {
    this.deps.events.publish('CircuitIncident', {
      boardId: board.entity.id,
      what,
      itemId: part?.item ?? null,
      watts,
      volts: r.volts,
      amps: r.amps,
      at,
    });
  }

  /** A fire has grown on an entity: a board is ruined with all it holds, a loose part too. */
  private burnt(entityId: string): void {
    const board = this.boards.get(entityId);
    if (board) {
      if (board.state.burnt) return;
      board.state.burnt = true;
      for (const part of board.state.parts) part.broken = true;
      board.state.wires.length = 0;
      board.wireRise.length = 0;
      if (this.pending?.boardId === entityId) this.pending = null;
      this.changed(board, 'damage');
      return;
    }
    if (this.deps.world.entity(entityId)?.item.circuit) {
      this.deps.entityStates.set(entityId, BROKEN_KEY, true);
    }
  }

  /** A part handed back at the cabinet: out of the hands, a sound one on its shelf again. */
  private returnPart(entityId: string): void {
    const { hands, world, entityStates } = this.deps;
    const held = hands.heldEntity;
    if (held?.id !== entityId || !held.item.circuit) return;
    const home = this.placementOf(held.id, held.item.id);
    if (!home) return;
    hands.place();
    world.despawn(held.id);
    entityStates.set(held.id, BROKEN_KEY, false);
    entityStates.set(held.id, CHARRED_KEY, false);
    world.spawn(entityFromPlacement(home.room.id, home.placement, held.item));
  }

  /**
   * A burnt board replaced (its parts back on their shelves, sound; no leads; the supply at 0) and
   * the soot round it cleaned off. Never while something still burns there.
   */
  private replaceBoard(board: Board): void {
    const { world, entityStates, items } = this.deps;
    for (const part of board.state.parts) {
      const item = items.tryGet(part.item);
      const home = item ? this.placementOf(part.id, item.id) : null;
      entityStates.set(part.id, BROKEN_KEY, false);
      entityStates.set(part.id, CHARRED_KEY, false);
      if (home && item) world.spawn(entityFromPlacement(home.room.id, home.placement, item));
    }
    board.state = { parts: [], wires: [], volts: 0, burnt: false };
    board.partRise = [];
    board.partWear = [];
    board.wireRise = [];
    const [bx, , bz] = board.entity.pose.position;
    for (const entity of world.allEntities()) {
      const [x, , z] = entity.pose.position;
      if (Math.hypot(x - bx, z - bz) < CLEAN_RADIUS) {
        entityStates.set(entity.id, CHARRED_KEY, false);
      }
    }
    this.changed(board, 'replace');
  }

  /** The room and placement an instance was placed as, if the content has it as `itemId`. */
  private placementOf(entityId: string, itemId: string) {
    const slash = entityId.indexOf('/');
    const room = slash > 0 ? this.deps.rooms.tryGet(entityId.slice(0, slash)) : undefined;
    const placement = room?.placements.find((p) => p.id === entityId.slice(slash + 1));
    return room && placement?.item === itemId ? { room, placement } : null;
  }

  // ---- the board ----------------------------------------------------------------------------

  private add(entity: WorldEntity, spec: BoardSpec): void {
    if (this.boards.has(entity.id)) return;
    const board: Board = {
      entity,
      spec,
      state: readBoard(spec, this.deps.entityStates.get(entity.id, CIRCUIT_KEY)),
      solution: null,
      origins: [],
      aim: null,
      aimCode: -1,
      aimAt: [0, 0],
      version: 0,
      partRise: [],
      partWear: [],
      wireRise: [],
      partOrigin: [],
      wireOrigin: [],
    };
    this.boards.set(entity.id, board);
    this.solve(board);
    const [w, h, d] = entity.item.visual.size;
    const texts = this.deps.texts;
    this.unregister.set(
      entity.id,
      this.deps.interaction.register({
        id: entity.id,
        get displayName() {
          return texts.of(entity.item, 'displayName');
        },
        center: entity.pose.position,
        halfExtents: [w / 2, h / 2, d / 2],
        rotation: entity.pose.rotation,
        actions: this.actionsOf(board),
      }),
    );
  }

  private remove(entityId: string): void {
    if (!this.boards.delete(entityId)) return;
    this.unregister.get(entityId)?.();
    this.unregister.delete(entityId);
    if (this.pending?.boardId === entityId) this.pending = null;
  }

  /** Where the view meets the board's top face, within reach, and what is there. */
  private aim(board: Board, holding: boolean): void {
    const { position, rotation } = board.entity.pose;
    // A placement turns about +y only: its yaw, and the eye and view in its frame.
    const yaw = 2 * Math.atan2(rotation[1], rotation[3]);
    const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
    const ox = this.eye[0] - position[0];
    const oy = this.eye[1] - position[1];
    const oz = this.eye[2] - position[2];
    const lx = c * ox - s * oz;
    const lz = s * ox + c * oz;
    const dx = c * this.dir[0] - s * this.dir[2];
    const dz = s * this.dir[0] + c * this.dir[2];
    const top = board.entity.item.visual.size[1] / 2;
    const t = this.dir[1] < -1e-6 ? (top - oy) / this.dir[1] : -1;
    let code: SpotCode = -1;
    if (t > 0 && t <= this.deps.reach) {
      board.aimAt[0] = lx + dx * t;
      board.aimAt[1] = lz + dz * t;
      // Where the view crosses the parts' tops, a little before the face.
      const tp = (top + PART_AIM_HEIGHT - oy) / this.dir[1];
      code = spotAt(
        board.spec,
        board.state,
        board.aimAt[0],
        board.aimAt[1],
        holding,
        lx + dx * tp,
        lz + dz * tp,
      );
    }
    this.aimed(board, code);
  }

  /** Sets what the aim is on; the prompt follows when it moves to another spot. */
  private aimed(board: Board, code: SpotCode): void {
    if (code === board.aimCode) return;
    board.aimCode = code;
    board.aim = spotOf(code);
    this.deps.events.publish('CircuitAimChanged', { boardId: board.entity.id });
  }

  /** Saves the board's circuit, solves it again and tells views it changed. */
  private changed(board: Board, cause: GameEvents['CircuitChanged']['cause']): void {
    this.deps.entityStates.set(board.entity.id, CIRCUIT_KEY, JSON.stringify(board.state));
    this.solve(board);
    board.aimCode = -2; // looked at again next frame
    this.deps.events.publish('CircuitChanged', { boardId: board.entity.id, cause });
  }

  private solve(board: Board): void {
    const { parts, origins } = netlist(
      board.spec,
      board.state,
      (id) => this.deps.items.tryGet(id)?.circuit,
    );
    board.origins = origins;
    board.partOrigin = board.state.parts.map(() => -1);
    board.wireOrigin = board.state.wires.map(() => -1);
    origins.forEach((o, k) => {
      if (o.kind === 'part') board.partOrigin[o.index] = k;
      else if (o.kind === 'wire') board.wireOrigin[o.index] = k;
    });
    // Heat follows the parts and leads as they are now (a new one starts at the room's).
    board.partRise.length = board.state.parts.length;
    board.partWear.length = board.state.parts.length;
    board.wireRise.length = board.state.wires.length;
    for (let i = 0; i < board.state.parts.length; i++) {
      board.partRise[i] ??= 0;
      board.partWear[i] ??= 0;
    }
    for (let k = 0; k < board.state.wires.length; k++) board.wireRise[k] ??= 0;
    try {
      board.solution = solveCircuit(board.spec.cols * board.spec.rows + 2, parts);
    } catch (error) {
      this.deps.log.error(`Circuit on "${board.entity.id}" could not be solved`, error);
      board.solution = null;
    }
    board.version++;
  }

  // ---- what the player can do ---------------------------------------------------------------

  private actionsOf(board: Board): InteractionAction[] {
    const { texts, hands } = this.deps;
    const at = () => board.aim;
    const part = (): MountedPart | null => {
      const spot = at();
      return spot?.kind === 'part' ? (board.state.parts[spot.index] ?? null) : null;
    };
    const kind = () => {
      const p = part();
      return p ? this.deps.items.tryGet(p.item)?.circuit?.kind : undefined;
    };
    const free = () => hands.heldEntity === null;
    const onNode = () => free() && at()?.kind === 'node';
    const pendingHere = () => this.pending?.boardId === board.entity.id;
    const polar = () => ['cell', 'ammeter', 'voltmeter'].includes(kind() ?? '');
    // Nothing on a burning board is touched — but its supply can still be turned down (off).
    const onFire = () =>
      this.deps.burning?.(board.entity.id)
        ? texts.ui('circuit.onFire', 'It is on fire: do not touch it — put the fire out first.')
        : null;
    const ruined = () =>
      onFire() ??
      (board.state.burnt
        ? texts.ui('circuit.boardBurnt', 'The board has burnt: replace it before building again.')
        : null);
    const works = () => ['switch', 'rheostat'].includes(kind() ?? '') || polar();
    return [
      {
        id: 'plug-in',
        withHeld: true,
        get label() {
          return texts.ui('circuit.plugIn', 'Plug it in here');
        },
        isAvailable: () => hands.heldEntity?.item.circuit !== undefined && at()?.kind === 'edge',
        blocked: () => {
          const spot = at();
          if (spot?.kind !== 'edge') return null;
          const reason = ruined();
          if (reason) return reason;
          return board.state.parts.some((p) => p.edge === spot.edge)
            ? texts.ui('circuit.taken', 'Something is already plugged in there.')
            : null;
        },
        perform: () => this.plugIn(board),
      },
      {
        id: 'lead',
        get label() {
          return pendingHere()
            ? texts.ui('circuit.leadEnd', 'Connect the lead here')
            : texts.ui('circuit.leadStart', 'Start a lead here');
        },
        isAvailable: onNode,
        blocked: ruined,
        perform: () => this.lead(board),
      },
      {
        id: 'work',
        get label() {
          const p = part();
          switch (kind()) {
            case 'switch':
              return (p?.setting ?? 0) >= 0.5
                ? texts.ui('circuit.switchOpen', 'Open the switch')
                : texts.ui('circuit.switchClose', 'Close the switch');
            case 'rheostat':
              return texts.ui('circuit.rheostatUp', 'Slide up (more resistance)');
            default:
              return texts.ui('circuit.turnRound', 'Turn it round (swap + and −)');
          }
        },
        isAvailable: () => free() && works(),
        blocked: onFire,
        perform: () => this.work(board, 1),
      },
      {
        id: 'work-down',
        get label() {
          return texts.ui('circuit.rheostatDown', 'Slide down (less resistance)');
        },
        isAvailable: () => free() && kind() === 'rheostat',
        blocked: onFire,
        perform: () => this.work(board, -1),
      },
      {
        id: 'cancel-lead',
        get label() {
          return texts.ui('circuit.leadCancel', 'Give up this lead');
        },
        isAvailable: () => free() && pendingHere(),
        perform: () => {
          this.pending = null;
          board.version++;
          this.deps.events.publish('CircuitAimChanged', { boardId: board.entity.id });
        },
      },
      {
        id: 'raise-volts',
        get label() {
          return texts.ui('circuit.voltsUp', 'Raise the supply voltage');
        },
        isAvailable: () => free() && at()?.kind === 'panel',
        blocked: ruined,
        perform: () => this.setVolts(board, 1),
      },
      {
        id: 'lower-volts',
        get label() {
          return texts.ui('circuit.voltsDown', 'Lower the supply voltage');
        },
        isAvailable: () => free() && at()?.kind === 'panel',
        perform: () => this.setVolts(board, -1),
      },
      {
        id: 'take-off',
        click: true,
        get label() {
          return texts.ui('circuit.takeOff', 'Take it off the board');
        },
        isAvailable: () => free() && part() !== null,
        blocked: onFire,
        perform: () => this.takeOff(board),
      },
      {
        id: 'unlead',
        click: true,
        get label() {
          return texts.ui('circuit.unlead', 'Take a lead off this hole');
        },
        isAvailable: () => {
          const spot = at();
          return (
            free() &&
            !pendingHere() &&
            spot?.kind === 'node' &&
            board.state.wires.some(([m, n]) => m === spot.node || n === spot.node)
          );
        },
        blocked: onFire,
        perform: () => this.unlead(board),
      },
      {
        id: 'replace-board',
        get label() {
          return texts.ui(
            'circuit.replaceBoard',
            'Replace the burnt board (its parts back in the cabinet)',
          );
        },
        isAvailable: () => free() && board.state.burnt,
        blocked: () =>
          this.deps.burning?.(board.entity.id)
            ? texts.ui('circuit.stillBurning', 'It is still burning: put the fire out first.')
            : null,
        perform: () => this.replaceBoard(board),
      },
    ];
  }

  private plugIn(board: Board): void {
    const { hands, world } = this.deps;
    const held = hands.heldEntity;
    const spot = board.aim;
    const spec = held?.item.circuit;
    if (!held || !spec || spot?.kind !== 'edge') return;
    if (board.state.parts.some((p) => p.edge === spot.edge)) return;
    hands.place();
    world.despawn(held.id);
    // A rheostat goes in at its whole track (the safe end), a switch open.
    const setting = spec.kind === 'rheostat' ? 1 : 0;
    board.state.parts.push({
      id: held.id,
      item: held.item.id,
      edge: spot.edge,
      flip: false,
      setting,
      broken: this.deps.entityStates.get(held.id, BROKEN_KEY) === true,
    });
    this.changed(board, 'plug-in');
  }

  private takeOff(board: Board): void {
    const { hands, world, rooms, items, texts, events } = this.deps;
    const spot = board.aim;
    if (spot?.kind !== 'part' || hands.heldEntity) return;
    const part = board.state.parts[spot.index];
    if (!part) return;
    const slash = part.id.indexOf('/');
    const room = rooms.tryGet(part.id.slice(0, slash));
    const placement = room?.placements.find((p) => p.id === part.id.slice(slash + 1));
    const item = items.tryGet(part.item);
    if (!room || !placement || !item) {
      const reason = texts.ui('circuit.cannotTakeOff', 'It cannot be taken off now.');
      events.publish('ActionBlocked', { entityId: board.entity.id, actionId: 'take-off', reason });
      return;
    }
    board.state.parts.splice(spot.index, 1);
    board.partRise.splice(spot.index, 1);
    board.partWear.splice(spot.index, 1);
    this.deps.entityStates.set(part.id, BROKEN_KEY, part.broken);
    this.changed(board, 'take-off');
    // The object it was, where it was plugged in, straight into the hands.
    const entity = entityFromPlacement(room.id, placement, item);
    const [m, n] = edgeNodes(board.spec, part.edge);
    const [ax, az] = nodeAt(board.spec, m);
    const [bx, bz] = nodeAt(board.spec, n);
    this.toWorld(
      board,
      (ax + bx) / 2,
      board.entity.item.visual.size[1] / 2 + item.visual.size[1] / 2 + 0.02,
      (az + bz) / 2,
      entity.pose.position,
    );
    world.spawn(entity);
    hands.grab(entity);
  }

  private lead(board: Board): void {
    const spot = board.aim;
    if (spot?.kind !== 'node') return;
    const pending = this.pending;
    if (!pending || pending.boardId !== board.entity.id) {
      this.pending = { boardId: board.entity.id, node: spot.node };
      board.version++;
      this.deps.events.publish('CircuitAimChanged', { boardId: board.entity.id });
      return;
    }
    this.pending = null;
    if (pending.node === spot.node) {
      board.version++;
      return;
    }
    board.state.wires.push([pending.node, spot.node]);
    this.changed(board, 'lead');
  }

  private unlead(board: Board): void {
    const spot = board.aim;
    if (spot?.kind !== 'node') return;
    const wires = board.state.wires;
    for (let i = wires.length - 1; i >= 0; i--) {
      const [m, n] = wires[i] ?? [-1, -1];
      if (m !== spot.node && n !== spot.node) continue;
      wires.splice(i, 1);
      board.wireRise.splice(i, 1);
      this.changed(board, 'unlead');
      return;
    }
  }

  private work(board: Board, direction: 1 | -1): void {
    const spot = board.aim;
    if (spot?.kind !== 'part') return;
    const part = board.state.parts[spot.index];
    const kind = part ? this.deps.items.tryGet(part.item)?.circuit?.kind : undefined;
    if (!part || !kind) return;
    if (kind === 'switch') part.setting = part.setting >= 0.5 ? 0 : 1;
    else if (kind === 'rheostat') {
      const next = Math.round((part.setting + direction * RHEOSTAT_STEP) * 10) / 10;
      part.setting = Math.min(1, Math.max(0, next));
    } else part.flip = !part.flip;
    this.changed(board, kind === 'switch' ? 'switch' : 'adjust');
  }

  private setVolts(board: Board, direction: 1 | -1): void {
    const { step, maxVolts } = board.spec;
    const next = Math.round(board.state.volts / step + direction) * step;
    board.state.volts = Math.min(maxVolts, Math.max(0, +next.toFixed(6)));
    this.changed(board, 'adjust');
  }

  /** A point of the board's frame in the world, into `out`. */
  private toWorld(board: Board, x: number, y: number, z: number, out: Vec3): void {
    const { position, rotation } = board.entity.pose;
    const yaw = 2 * Math.atan2(rotation[1], rotation[3]);
    const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
    out[0] = position[0] + c * x + s * z;
    out[1] = position[1] + y;
    out[2] = position[2] - s * x + c * z;
  }
}

/** The power (W) that heats a part, from its reading: what it dissipates, a cell's in its own r. */
function heatInput(spec: PartSpec, r: Reading): number {
  switch (spec.kind) {
    case 'resistor':
    case 'fuse':
    case 'ammeter':
      return Math.max(0, r.watts);
    case 'cell':
      return r.amps * r.amps * (spec.ohms ?? 0);
    case 'switch':
      return r.amps * r.amps * SWITCH_OHMS;
    case 'rheostat':
      // Its winding at its rated current takes its heat spec's 1 W: (I / I_rated)² W.
      return (r.amps / (spec.amps ?? 1)) ** 2;
    default:
      return 0;
  }
}
