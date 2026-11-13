import { Disposables, type EventBus } from '../../core/EventBus';
import { fill, type Texts } from '../../core/i18n';
import type { Quat, Vec3 } from '../../core/math';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { ConversationStage, GameState } from '../../game/GameState';
import type { Explain } from '../../simulation/experiment';
import type { SimulationModel } from '../../simulation/SimulationModel';
import { workExample } from '../../simulation/workedExample';
import type { DoorPair } from '../../world/campus';
import type { RoomDefinition, SceneDefinition } from '../../world/definitions';
import { buildNavGrid, type NavGrid, nearestFree } from '../../world/navGrid';
import type { WorldEntity } from '../../world/World';
import type { DoorState } from '../door/DoorSystem';
import type { StationView } from '../experiment/StationSystem';
import type { InteractionAction, Interactable } from '../interaction/InteractionSystem';
import type { ItemDefinition } from '../item';
import { type BoardArea, layoutBoard, penAt } from './board';
import type { NpcDefinition, NpcDesk, NpcGesture, NpcLine, NpcOption } from './npc';
import { type DayPlan, type NpcPose, planDay, poseAt } from './schedule';
import { ARRIVED_M, type WalkWorld, Walker } from './walker';

/** The physics side: a capsule per person, so the player cannot walk through them. */
export interface AgentBodies {
  placeAgent(id: string, x: number, z: number, height: number): void;
  removeAgent(id: string): void;
}

export interface NpcSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  texts: Texts;
  npcs: Registry<NpcDefinition>;
  scenes: Registry<SceneDefinition>;
  rooms: Registry<RoomDefinition>;
  itemOf: (id: string) => ItemDefinition | undefined;
  interaction: {
    register(interactable: Interactable): () => void;
    addOffer(offer: (targetId: string) => InteractionAction | null): () => void;
  };
  /** Without it people have no body (tests, a world without physics). */
  agents?: AgentBodies;
  /**
   * The name of another player of the room whose game drives this person now (Phase F-3), or
   * null: drawn as that game says (`mirror`), not to be talked to until they are done.
   */
  drivenBy?: (npcId: string) => string | null;
  /** Where a resident scene's own coordinates start in the session frame (SceneManager). */
  offsetOf: (sceneId: string) => Readonly<Vec3> | null;
  /** The walk-through door pairs joining scenes (SceneManager), for walking between them. */
  doorPairs?: readonly DoorPair[];
  /** The doors' state (DoorSystem): a person waits for a door to open. */
  doors?: DoorState;
  /** Stations and their Explain view (Phase Y-2: a teacher explains one). */
  stations?: { view(stationId: string): StationView | null };
  explain?: {
    open(stationId: string): string | null;
    show(step: number): void;
    close(): boolean;
    readonly current: { readonly stationId: string; readonly step: number } | null;
  };
  /** The world's entities, and its rooms (a door's reader is on its room's side). */
  world?: {
    entity(id: string): WorldEntity | undefined;
    allEntities(): Iterable<WorldEntity>;
    roomAt(x: number, z: number): RoomDefinition | null;
  };
  /** The simulation model an experiment names (worked examples' answers are its predictions). */
  models?: (modelId: string) => SimulationModel | undefined;
  /** Doors people never take: a procedure's entrance (the player's own way in, by its steps). */
  barred?: ReadonlySet<string>;
}

/** A person as drawn this frame (written in place each frame). */
export interface NpcView {
  readonly npc: NpcDefinition;
  /** The scene they are in now, and where in its own coordinates (m). */
  sceneId: string;
  x: number;
  z: number;
  /** Where the body faces (rad): 0 −z, π/2 −x, π +z. */
  heading: number;
  speed: number;
  /** How far down onto a seat (0–1). */
  sit: number;
  gesture: NpcGesture;
  /** Looking at the player (their feet, in the person's scene's coordinates), or at nothing. */
  looking: boolean;
  lookX: number;
  lookZ: number;
  /** Talking with the player now. */
  talking: boolean;
  /** The part of the open Explain view's apparatus they point at (an explain part id), or null. */
  point: string | null;
  /** A key card in the hand (tapping a door's reader). */
  card: boolean;
  /** The hand out to (reachX, reachY, reachZ): the reader, in their scene's coordinates (m). */
  reaching: boolean;
  reachX: number;
  reachY: number;
  reachZ: number;
  /** The walk's swing (rad, a stride per half turn): the feet come down as they are heard. */
  stride: number;
  /** How far through a job they are (0–1: writing a test, marking it), shown over their head; null. */
  progress: number | null;
  /** A paper (Phase Y-5): in the right hand, or on the desk at (paperX, paperY, paperZ), facing as they do. */
  paper: 'none' | 'hand' | 'desk';
  paperX: number;
  paperY: number;
  paperZ: number;
  /** A pen in the right hand, and its ink. */
  pen: 'none' | 'blue' | 'red';
}

/** One line of a conversation as shown: its text, and the apparatus parts it is about. */
export interface NpcSay {
  readonly title: string;
  readonly text: string;
  readonly parts: readonly string[];
}

/** One answer the player can give now. */
export interface NpcChoice {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

/**
 * What is written on the board a teacher works examples on (Phase Y-3): one board at a time, its
 * lines and how many letters of each are written; kept after the lesson, as a real board keeps it.
 * The renderer draws it; its version changes whenever it does.
 */
export interface BoardView {
  boardId: string | null;
  lines: string[];
  shown: number[];
  /** The board lines of the title (underlined), and the first of the answer (in red). */
  title: number;
  answer: number;
  version: number;
}

/**
 * A line another system has a person say in a conversation (Phase Y-5, the tests): its text, the
 * answers offered, a form the interface shows under it (`form`), or a job done while it holds
 * (`seconds`: marking a paper, its progress shown); `then` follows it (E, or the seconds run out),
 * none closes the conversation; `pick` takes an answer (why not, or null).
 */
export interface NpcScript {
  readonly text: string;
  readonly choices?: readonly NpcChoice[];
  readonly form?: 'test-setup';
  readonly seconds?: number;
  readonly then?: () => void;
  readonly pick?: (choiceId: string) => string | null;
}

/**
 * A job a person goes and does (Phase Y-5: writing a test, marking one): at the first stop of
 * their day, doing `gesture` for `seconds` (its progress shown over their head), then `done`, and
 * their day goes on. Talked to meanwhile, they say `busy` and carry on. With a `paper`, it lies on
 * their desk while they work, a pen of its ink in their hand. `receive`: first they take the paper
 * from the player's hand where they stand (`takePaper`), facing them, their arm out. `offer`: done,
 * they hold the paper out until the player takes it (E or a click on it), then their day goes on.
 */
export interface NpcErrand {
  readonly gesture: NpcGesture;
  readonly seconds: number;
  readonly busy: string;
  readonly done: () => void;
  /** Their hand on this desk while at it (writing), not where the gesture alone puts it. */
  readonly desk?: NpcDesk;
  readonly paper?: { readonly ink: 'blue' | 'red' };
  readonly receive?: boolean;
  readonly offer?: NpcOffer;
}

/** A paper held out to the player (Phase Y-5): what taking it is called and does, what they say meanwhile. */
export interface NpcOffer {
  readonly label: () => string;
  readonly take: () => void;
  readonly waiting: string;
}

/** Where a paper is held out or taken (m): ahead of the body, to the right, up (Phase Y-5). */
const HAND_AHEAD_M = 0.52;
const HAND_SIDE_M = 0.12;
const HAND_UP_M = 1.22;
/** A paper not taken from the player's hand by then (s, their give acted out) is taken anyway. */
const RECEIVE_MAX_S = 4;

/** How far (m) a walking person keeps from the player: nearer, they wait. */
const GIVE_WAY_M = 0.8;
/** Within this (m) of the player a person glances at them. */
const NOTICE_M = 3.5;
/** How quickly (1/s) a person turns to face the player they talk with, and the view turns too. */
const TURN_RATE = 5;
/** The view turned this far (rad) right of the person talked to: they stand left of their choices. */
const VIEW_ASIDE = 0.15;
/** Following: how near (m) they come to the player, and beyond what (m) they hurry. */
const FOLLOW_M = 1.6;
const HURRY_M = 4;
const FOLLOW_SPEED = 1.5;
const HURRY_SPEED = 2.8;
/**
 * Beside a station: this far (m) to the apparatus' right — beside it, not between it and the
 * Explain view's camera — and a little towards its front.
 */
const BESIDE_M = 1.35;
const FRONT_M = 0.15;
/** Writing on a board: letters a second; how far out from it he stands to write, and beside it. */
const WRITE_CPS = 16;
const WRITE_OUT_M = 0.5;
const BOARD_SIDE_M = 0.55;
/** Beside the board he faces out, turned this far (rad) towards it. */
const BOARD_TURN = 0.5;

/** The lecture: its lines, and what each is about (parts lit, the principle's step shown). */
interface LectureLine {
  readonly text: string;
  readonly parts: readonly string[];
  readonly step: number | null;
}

type Mode = 'day' | 'follow' | 'lecture' | 'board' | 'errand' | 'return';

/** A lesson at a board: the example worked, the board, what is said and written. */
interface BoardLesson {
  readonly stationId: string;
  readonly sceneId: string;
  /** The example (its index) and how many the experiment has. */
  readonly index: number;
  readonly count: number;
  /** Each line said, and the board lines written as it is said. */
  readonly lines: readonly { readonly text: string; readonly writes: readonly number[] }[];
  /** The board in its scene's coordinates (its centre, its turn) and its writing area. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly area: BoardArea;
  /** Where he stands to write each board line, and beside the board to talk, facing out. */
  readonly writeX: readonly number[];
  readonly writeZ: readonly number[];
  readonly sideX: number;
  readonly sideZ: number;
  readonly face: number;
  /** Ink not yet a whole letter. */
  ink: number;
}

/** A person's own runtime (never saved: a load starts their day again). */
interface Person {
  readonly npc: NpcDefinition;
  readonly view: NpcView;
  readonly pose: NpcPose;
  readonly center: Vec3;
  plan: DayPlan | null;
  /** Seconds into their day. */
  t: number;
  visits: number;
  farewells: number;
  release: (() => void) | null;
  bodied: boolean;
  /** Where their scene's own coordinates start in the session frame (m), null out of residence. */
  ox: number;
  oz: number;
  resident: boolean;
  mode: Mode;
  /** The station explained, where they stand by it, and the lecture's lines. */
  lecture: {
    stationId: string;
    sceneId: string;
    x: number;
    z: number;
    face: number;
    lines: LectureLine[];
  } | null;
  /** A lesson at a board (Y-3). */
  board: BoardLesson | null;
  /** The line another system has them say, and how long it has held (s). */
  script: NpcScript | null;
  scriptT: number;
  /** A job under way (Y-5), and how long they have worked at it (s). */
  errand: NpcErrand | null;
  errandT: number;
  errandStage: 'receive' | 'work' | 'offer';
  /** Where their hand meets the player's (receiving, offering), in their scene's coordinates (m). */
  readonly meet: Vec3;
  /** The held-out paper as a target for E, in the session frame, and its removal. */
  readonly offerCenter: Vec3;
  offerRelease: (() => void) | null;
  /** Their walk: paths, doors, the card on a reader, their feet. */
  readonly walker: Walker;
  /** Drawn as another player's game says (Phase F-3); back to their own day when it ends. */
  mirrored: boolean;
}

/** A person as another game draws them: the NpcView's fields that travel (Phase F-3). */
export type NpcMirror = Record<string, boolean | number | string | null>;
const MIRROR_NUMBERS = [
  'x',
  'z',
  'heading',
  'speed',
  'sit',
  'lookX',
  'lookZ',
  'reachX',
  'reachY',
  'reachZ',
  'stride',
  'paperX',
  'paperY',
  'paperZ',
] as const;
const MIRROR_FLAGS = ['looking', 'talking', 'card', 'reaching'] as const;
const GESTURES = new Set<string>([
  'idle',
  'talk',
  'listen',
  'type',
  'write',
  'drink',
  'read',
  'phone',
  'pose',
  'wait',
]);

const UPRIGHT: Quat = [0, 0, 0, 1];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * People of the world who are not the player (Phase Y, Phú 2026-11-09: the hub's teacher). Each
 * goes through their day in their scene — stands at the counter, sits on a bench, looks into a
 * lab — walking the scene's free floor between stops, waiting when the player is in the way.
 * Wherever they are resident they have a body (the player cannot walk through them) and can be
 * talked to (E): they stop, turn to the player, greet them, then offer their choices (`options`);
 * a choice a later phase has not built yet is shown disabled. One conversation at a time
 * (`state.session.conversation`, never saved); while it lasts the player stands still.
 *
 * Explaining a simulation (Y-2, the `explain-simulation` behaviour): the teacher asks which, then
 * follows the player — through doors into other scenes — until the player presses E on a station
 * ("Ask … to explain"). He walks to stand beside it, the Explain view opens, and he lectures from
 * its data: the experiment in one sentence, each part (pointing at it), the principle step by step.
 * Then he offers the board (Y-3: not built yet) or thanks; done, he walks back to his day. Esc or
 * leaving ends it; he walks back. The only writer of where people are and of conversations.
 */
export class NpcSystem implements GameSystem {
  readonly id = 'npcs';
  private readonly people: Person[] = [];
  /** Where a person's hand meets the player's (`handPoint`, reused). */
  private readonly point: Vec3 = [0, 0, 0];
  private readonly viewList: NpcView[] = [];
  private readonly behaviors = new Map<string, (npcId: string) => void>();
  private readonly grids = new Map<string, NavGrid | null>();
  private readonly subscriptions = new Disposables();
  /** The station E on the focused target would have the follower explain, and the action. */
  private askedNpc = '';
  private askedStation: string | null = null;
  private readonly askAction: InteractionAction = this.makeAskAction();
  /** The station each target looked at belongs to (null: none with an Explain view). */
  private readonly stationIds = new Map<string, string | null>();
  /** What is written on the board (Y-3). */
  readonly board: BoardView = {
    boardId: null,
    lines: [],
    shown: [],
    title: 0,
    answer: 0,
    version: 0,
  };
  /** Scratch, reused. */
  private readonly local: Vec3 = [0, 0, 0];
  private readonly pen: Vec3 = [0, 0, 0];
  private readonly free: [number, number] = [0, 0];

  constructor(private readonly deps: NpcSystemDeps) {
    const walk: WalkWorld = {
      events: deps.events,
      offsetOf: (sceneId) => deps.offsetOf(sceneId),
      grid: (sceneId) => this.grid(sceneId),
      doorPairs: deps.doorPairs ?? [],
      doors: deps.doors,
      world: deps.world,
      barred: deps.barred ?? new Set(),
    };
    for (const npc of deps.npcs.all()) {
      const first = npc.schedule[0];
      const view: NpcView = {
        npc,
        sceneId: npc.scene,
        x: first?.at[0] ?? 0,
        z: first?.at[1] ?? 0,
        heading: first?.heading ?? 0,
        speed: 0,
        sit: 0,
        gesture: 'idle',
        looking: false,
        lookX: 0,
        lookZ: 0,
        talking: false,
        point: null,
        card: false,
        reaching: false,
        reachX: 0,
        reachY: 0,
        reachZ: 0,
        stride: 0,
        progress: null,
        paper: 'none',
        paperX: 0,
        paperY: 0,
        paperZ: 0,
        pen: 'none',
      };
      const base: Omit<Person, 'walker'> = {
        npc,
        view,
        pose: {
          x: view.x,
          z: view.z,
          heading: view.heading,
          speed: 0,
          sit: 0,
          gesture: 'idle',
          stop: 0,
          walking: false,
        },
        center: [view.x, npc.character.appearance.heightM / 2, view.z],
        plan: null,
        t: 0,
        visits: 0,
        farewells: 0,
        release: null,
        bodied: false,
        ox: 0,
        oz: 0,
        resident: false,
        mode: 'day',
        lecture: null,
        board: null,
        script: null,
        scriptT: 0,
        errand: null,
        errandT: 0,
        errandStage: 'work',
        mirrored: false,
        meet: [0, 0, 0],
        offerCenter: [0, 0, 0],
        offerRelease: null,
      };
      this.people.push(Object.assign(base, { walker: new Walker(npc.id, view, base, walk) }));
      this.viewList.push(view);
    }
    this.provide('explain-simulation', (npcId) => this.askWhich(npcId));
  }

  init(): void {
    const s = this.subscriptions;
    s.add(this.deps.events.subscribe('SceneLoading', () => this.close()));
    // A scene gone takes its people's bodies and targets with it at once (not a frame later).
    s.add(
      this.deps.events.subscribe('SceneDetached', () => {
        for (const person of this.people) this.settle(person);
      }),
    );
    // The Explain view closed by the player (H, Esc, Close) ends a lecture.
    s.add(
      this.deps.events.subscribe('ExplainClosed', () => {
        if (this.conversation?.stationId) this.close();
      }),
    );
    s.add(this.deps.interaction.addOffer((targetId) => this.offer(targetId)));
  }

  /** Every person, as drawn this frame (one list, kept: read it every frame). */
  get views(): readonly NpcView[] {
    return this.viewList;
  }

  view(npcId: string): NpcView | null {
    return this.person(npcId)?.view ?? null;
  }

  /** The conversation going on, or null. */
  get conversation(): GameStateConversation | null {
    return this.deps.state.session.conversation ?? null;
  }

  /** The person talked with now, or null. */
  get talkingWith(): NpcDefinition | null {
    const open = this.conversation;
    return open ? (this.deps.npcs.tryGet(open.npcId) ?? null) : null;
  }

  /**
   * What `npcId` is about: their day, following the player (asked to explain a simulation, none
   * chosen yet), lecturing at a station, or walking back to their day; null if unknown.
   */
  mode(npcId: string): Mode | null {
    return this.person(npcId)?.mode ?? null;
  }

  /** The greeting or farewell shown now as a content line, or null (other stages: `say`). */
  get line(): NpcLine | null {
    const open = this.conversation;
    const npc = this.talkingWith;
    if (!open || !npc) return null;
    if (open.stage === 'farewell') return npc.farewells[open.line] ?? npc.farewells[0] ?? null;
    if (open.stage === 'greeting' || open.stage === 'menu') {
      return npc.greetings[open.line] ?? npc.greetings[0] ?? null;
    }
    const lesson = npc.lesson;
    if (!lesson) return null;
    if (open.stage === 'ask') return lesson.ask;
    if (open.stage === 'waiting') return lesson.waiting;
    if (open.stage === 'cancel') return lesson.cancel;
    if (open.stage === 'board') return lesson.outro;
    if (open.stage === 'thanks') return lesson.thanks;
    if (open.stage === 'lesson-end') {
      const b = this.person(npc.id)?.board;
      return b && b.index + 1 < b.count ? lesson.more : lesson.last;
    }
    return null;
  }

  /** What is said now (in the current language), with the parts it is about; null if nothing. */
  get say(): NpcSay | null {
    const open = this.conversation;
    const npc = this.talkingWith;
    if (!open || !npc) return null;
    const t = this.deps.texts;
    const title = t.of(npc, 'title');
    if (open.stage === 'lecture') {
      const line = this.person(npc.id)?.lecture?.lines[open.line];
      return line ? { title, text: line.text, parts: line.parts } : null;
    }
    if (open.stage === 'lesson') {
      const line = this.person(npc.id)?.board?.lines[open.line];
      return line ? { title, text: line.text, parts: [] } : null;
    }
    if (open.stage === 'script') {
      const script = this.person(npc.id)?.script;
      return script ? { title, text: script.text, parts: [] } : null;
    }
    const line = this.line;
    return line ? { title, text: t.of(line, 'text'), parts: [] } : null;
  }

  /** The answers the player can give now (none while a line is being said). */
  get choices(): readonly NpcChoice[] {
    const open = this.conversation;
    const npc = this.talkingWith;
    if (!open || !npc) return [];
    const t = this.deps.texts;
    const lesson = npc.lesson;
    if (open.stage === 'script') return this.person(npc.id)?.script?.choices ?? [];
    if (open.stage === 'menu') {
      return [
        ...npc.options.map((o) => ({
          id: o.id,
          label: t.of(o, 'label'),
          enabled: this.available(o),
        })),
        { id: 'goodbye', label: t.ui('npc.goodbye', 'Goodbye'), enabled: true },
      ];
    }
    if (open.stage === 'waiting' && lesson) {
      return [
        { id: 'keep-going', label: t.of(lesson.choices.keepGoing, 'label'), enabled: true },
        { id: 'never', label: t.of(lesson.choices.never, 'label'), enabled: true },
      ];
    }
    if (open.stage === 'board' && lesson) {
      // The board: when the experiment has worked examples and its lab a board.
      const stationId = open.stationId ?? '';
      const ready = this.examplesOf(stationId) > 0 && this.boardNear(stationId) !== null;
      return [
        { id: 'board', label: t.of(lesson.choices.board, 'label'), enabled: ready },
        { id: 'no-board', label: t.of(lesson.choices.noBoard, 'label'), enabled: true },
      ];
    }
    if (open.stage === 'lesson-end' && lesson) {
      const b = this.person(npc.id)?.board;
      const more = b !== null && b !== undefined && b.index + 1 < b.count;
      return [
        ...(more
          ? [{ id: 'another', label: t.of(lesson.choices.another, 'label'), enabled: true }]
          : []),
        { id: 'enough', label: t.of(lesson.choices.enough, 'label'), enabled: true },
      ];
    }
    return [];
  }

  /** Whether an option can be chosen now (not planned, its behaviour built). */
  available(option: NpcOption): boolean {
    return !option.planned && this.behaviors.has(option.behavior);
  }

  /** The line said now by another system, or null (the interface shows its form). */
  get script(): NpcScript | null {
    const open = this.conversation;
    return open?.stage === 'script' ? (this.person(open.npcId)?.script ?? null) : null;
  }

  /** What E on `npcId` targets: their box for the interaction (and offers made on it). */
  targetOf(npcId: string): string | null {
    const npc = this.deps.npcs.tryGet(npcId);
    return npc ? `${npc.scene}/${npc.id}` : null;
  }

  /**
   * Has `npcId` say `script` (Phase Y-5): in the conversation with them, or opening one; false if
   * they are not there or someone else is being talked to.
   */
  speak(npcId: string, script: NpcScript): boolean {
    const person = this.person(npcId);
    const open = this.conversation;
    if (!person || (open && open.npcId !== npcId) || (!open && !person.resident)) return false;
    person.script = script;
    person.scriptT = 0;
    person.view.progress = null;
    this.deps.state.session.conversation = { npcId, stage: 'script', line: 0 };
    if (open) this.deps.events.publish('ConversationChanged', { npcId, stage: 'script' });
    else this.deps.events.publish('ConversationOpened', { npcId });
    return true;
  }

  /**
   * Sends `npcId` on `errand` (Phase Y-5): to the first stop of their day, to work there (first
   * taking a paper from the player's hand, if it says so). False if they are not there or already
   * on one.
   */
  errand(npcId: string, errand: NpcErrand): boolean {
    const person = this.person(npcId);
    if (!person || person.mode === 'errand') return false;
    person.lecture = null;
    person.board = null;
    person.errand = errand;
    person.errandT = 0;
    person.mode = 'errand';
    person.errandStage = errand.receive ? 'receive' : 'work';
    if (errand.receive) {
      // Their hand out towards the player, where the two hands meet.
      const { view } = person;
      const player = this.playerLocal(person);
      const heading = Math.atan2(-(player[0] - view.x), -(player[2] - view.z));
      this.handAt(person, heading, person.meet);
    }
    return true;
  }

  /** The paper is in `npcId`'s hand now (the player let go of it): they go to work on it. */
  takePaper(npcId: string): void {
    const person = this.person(npcId);
    if (person?.errandStage !== 'receive') return;
    person.view.paper = 'hand';
    person.errandStage = 'work';
    person.errandT = 0;
  }

  /** The paper held out was taken (the player's hand has it): the offer ends, the day goes on. */
  release(npcId: string): void {
    const person = this.person(npcId);
    if (!person || person.mode !== 'errand' || person.errandStage !== 'offer') return;
    this.endOffer(person);
    person.view.paper = 'none';
    person.errand = null;
    person.mode = 'day';
    person.t = person.plan?.stops[0]?.stayS ?? 0;
  }

  /**
   * Where `npcId`'s hand meets the player's now, in the session frame: the paper they hold out,
   * or their hand out to take one; null otherwise. Reused: read it at once.
   */
  handPoint(npcId: string): Readonly<Vec3> | null {
    const person = this.person(npcId);
    if (!person || person.mode !== 'errand' || person.errandStage === 'work') return null;
    this.point[0] = person.meet[0] + person.ox;
    this.point[1] = person.meet[1];
    this.point[2] = person.meet[2] + person.oz;
    return this.point;
  }

  /** A later phase plugs in what a choice does; returns its removal. */
  provide(behavior: string, run: (npcId: string) => void): () => void {
    this.behaviors.set(behavior, run);
    return () => this.behaviors.delete(behavior);
  }

  update(dt: number): void {
    const { state } = this.deps;
    const playing = state.session.phase === 'playing';
    for (const person of this.people) {
      this.settle(person);
      if (dt <= 0 || !playing) continue;
      this.live(person, dt);
    }
    const open = this.conversation;
    const talking = open ? this.person(open.npcId) : undefined;
    if (talking && dt > 0 && !open?.stationId) this.turnView(talking, dt);
  }

  dispose(): void {
    this.subscriptions.dispose();
    for (const person of this.people) {
      person.resident = false;
      this.attend(person);
    }
  }

  /** Starts talking with `npcId`; false if they cannot talk now. */
  open(npcId: string): boolean {
    const person = this.person(npcId);
    const { state } = this.deps;
    if (!person || this.conversation || !person.resident) return false;
    if (person.mode === 'follow' && person.npc.lesson) {
      this.set(person, 'waiting', 0);
      return true;
    }
    if (person.mode === 'lecture' || person.mode === 'board') return false;
    if (person.mode === 'errand' && person.errand) {
      const offer = person.errandStage === 'offer' ? person.errand.offer : undefined;
      return this.speak(npcId, { text: offer?.waiting ?? person.errand.busy });
    }
    const greetings = person.npc.greetings.length;
    // The first time they introduce themselves; after that, the other greetings in turn.
    const line =
      person.visits === 0 || greetings < 2 ? 0 : 1 + ((person.visits - 1) % (greetings - 1));
    person.visits++;
    state.session.conversation = { npcId, stage: 'greeting', line };
    this.deps.events.publish('ConversationOpened', { npcId });
    return true;
  }

  /** On from the line shown (the stage's next, or the end). */
  advance(): void {
    const open = this.conversation;
    const person = open ? this.person(open.npcId) : undefined;
    if (!open || !person) return;
    switch (open.stage) {
      case 'greeting':
        this.set(person, 'menu', open.line);
        return;
      case 'farewell':
        this.close();
        return;
      case 'ask':
        // Lead the way: he follows.
        person.mode = 'follow';
        this.close();
        return;
      case 'cancel':
      case 'thanks':
        this.close(); // he walks back (close ends the errand)
        return;
      case 'lecture': {
        const lines = person.lecture?.lines ?? [];
        const next = open.line + 1;
        if (next < lines.length) {
          this.set(person, 'lecture', next);
          const step = lines[next]?.step;
          if (step !== null && step !== undefined) this.deps.explain?.show(step);
        } else this.set(person, 'board', 0);
        return;
      }
      case 'script': {
        const script = person.script;
        // A form is answered by its own buttons; a job is waited for.
        if (!script || script.form || (script.seconds ?? 0) > person.scriptT) return;
        if (script.then) script.then();
        else this.close();
        return;
      }
      case 'lesson': {
        const b = person.board;
        if (!b) return;
        // What this line writes is written at once; then the next line, or the question after.
        for (const i of b.lines[open.line]?.writes ?? []) this.writeWhole(i);
        if (open.line + 1 < b.lines.length) this.set(person, 'lesson', open.line + 1);
        else this.set(person, 'lesson-end', 0);
        return;
      }
      default:
    }
  }

  /** Chooses one of `choices` by id; why it cannot be chosen, or null. */
  pick(choiceId: string): string | null {
    const open = this.conversation;
    const person = open ? this.person(open.npcId) : undefined;
    if (!open || !person) return 'none';
    if (choiceId === 'goodbye') {
      this.goodbye();
      return null;
    }
    if (open.stage === 'waiting') {
      if (choiceId === 'never') this.set(person, 'cancel', 0);
      else if (choiceId === 'keep-going') this.close();
      return null;
    }
    if (open.stage === 'board') {
      if (choiceId === 'no-board') {
        // Thanks, said facing the player: the Explain view closes first (no station: it ends nothing).
        this.deps.state.session.conversation = { npcId: person.npc.id, stage: 'thanks', line: 0 };
        this.deps.explain?.close();
        this.deps.events.publish('ConversationChanged', { npcId: person.npc.id, stage: 'thanks' });
        return null;
      }
      if (choiceId === 'board') return this.startBoard(person, open.stationId ?? '', 0);
      return 'unknown';
    }
    if (open.stage === 'script') return person.script?.pick?.(choiceId) ?? 'unknown';
    if (open.stage === 'lesson-end') {
      const b = person.board;
      if (choiceId === 'another' && b && b.index + 1 < b.count) {
        return this.startBoard(person, b.stationId, b.index + 1);
      }
      if (choiceId === 'enough') this.set(person, 'thanks', 0);
      return null;
    }
    return this.choose(choiceId);
  }

  /** Chooses `optionId` of the person's options; why it cannot be chosen, or null. */
  choose(optionId: string): string | null {
    const npc = this.talkingWith;
    const option = npc?.options.find((o) => o.id === optionId);
    if (!npc || !option) return 'unknown';
    if (!this.available(option)) {
      return this.deps.texts.ui('npc.planned', 'Coming soon: not built yet');
    }
    this.behaviors.get(option.behavior)?.(npc.id);
    return null;
  }

  /** Goodbye: the person says a farewell, then the conversation ends. */
  goodbye(): void {
    const open = this.conversation;
    const person = open ? this.person(open.npcId) : undefined;
    if (!open || !person) return;
    const line = person.farewells++ % Math.max(1, person.npc.farewells.length);
    this.set(person, 'farewell', line);
  }

  /**
   * Ends the conversation at once; false if none was going on. A lecture or an errand given up
   * (Esc, the Explain view closed, leaving) sends the person back to their day.
   */
  close(): boolean {
    const open = this.conversation;
    if (!open) return false;
    const person = this.person(open.npcId);
    this.deps.state.session.conversation = null;
    if (person) {
      person.script = null;
      person.view.progress = null;
    }
    if (person && person.mode === 'lecture') {
      person.lecture = null;
      person.view.point = null;
      person.mode = 'return';
      if (this.deps.explain?.current?.stationId === open.stationId) this.deps.explain?.close();
    } else if (person && person.mode === 'board') {
      // The writing stays on the board; he walks back.
      person.board = null;
      person.mode = 'return';
    } else if (person && (open.stage === 'cancel' || open.stage === 'thanks')) {
      person.mode = 'return';
    }
    this.deps.events.publish('ConversationClosed', { npcId: open.npcId });
    return true;
  }

  /** Explains station `stationId` (it has an Explain view): he comes to it and lectures. */
  lectureAt(npcId: string, stationId: string): boolean {
    const person = this.person(npcId);
    const station = this.deps.stations?.view(stationId);
    const entity = this.deps.world?.entity(stationId);
    const explain = station?.definition.explain;
    const lesson = person?.npc.lesson;
    const sceneId = entity
      ? this.deps.scenes.all().find((s) => s.kind === 'world' && s.rooms.includes(entity.roomId))
          ?.id
      : undefined;
    if (!person || !station || !entity || !explain || !lesson || !sceneId) return false;
    if (this.conversation) this.close();
    if (this.deps.explain?.open(stationId)) return false;
    const t = this.deps.texts;
    const lines: LectureLine[] = [
      {
        text: fill(t.of(lesson.intro, 'text'), { experiment: t.of(station.definition, 'name') }),
        parts: [],
        step: null,
      },
      { text: t.of(explain, 'summary'), parts: [], step: null },
      ...explain.parts.map((part) => ({
        text: fill(t.of(lesson.part, 'text'), {
          name: t.of(part, 'name'),
          role: t.of(part, 'role'),
        }),
        parts: [part.id],
        step: null,
      })),
      ...explain.steps.map((step, i) => ({ text: t.of(step, 'text'), parts: step.parts, step: i })),
    ];
    // Where he stands: beside the apparatus, to its right and a little towards its desk.
    const yaw = 2 * Math.atan2(entity.pose.rotation[1], entity.pose.rotation[3]);
    const offset = this.deps.offsetOf(sceneId);
    const ax = entity.pose.position[0] - (offset?.[0] ?? 0);
    const az = entity.pose.position[2] - (offset?.[2] ?? 0);
    let x = ax + Math.cos(yaw) * BESIDE_M + Math.sin(yaw) * FRONT_M;
    let z = az - Math.sin(yaw) * BESIDE_M + Math.cos(yaw) * FRONT_M;
    const grid = this.grid(sceneId);
    if (grid && nearestFree(grid, x, z, 1.5, this.free)) [x, z] = this.free;
    person.lecture = {
      stationId,
      sceneId,
      x,
      z,
      face: Math.atan2(-(ax - x), -(az - z)),
      lines,
    };
    person.mode = 'lecture';
    this.deps.state.session.conversation = { npcId, stage: 'lecture', line: 0, stationId };
    this.deps.events.publish('ConversationOpened', { npcId });
    return true;
  }

  /**
   * This game drives the person now (Phase F-3): talking with them, or they follow, explain,
   * teach at a board or do a job for this player. The others' games draw them as this one does.
   */
  engaged(npcId: string): boolean {
    const person = this.person(npcId);
    if (!person || person.mirrored) return false;
    return (
      this.conversation?.npcId === npcId || (person.mode !== 'day' && person.mode !== 'return')
    );
  }

  /** The person as drawn here, for the others (`mirror` there). */
  snapshot(npcId: string): NpcMirror | null {
    const view = this.person(npcId)?.view;
    if (!view) return null;
    const out: NpcMirror = {
      sceneId: view.sceneId,
      gesture: view.gesture,
      point: view.point,
      progress: view.progress === null ? null : Math.round(view.progress * 100) / 100,
      paper: view.paper,
      pen: view.pen,
    };
    for (const key of MIRROR_NUMBERS) out[key] = Math.round(view[key] * 1000) / 1000;
    for (const key of MIRROR_FLAGS) out[key] = view[key];
    return out;
  }

  /** Draws the person as another player's game drives them (only what checks out is taken). */
  mirror(npcId: string, fields: NpcMirror): void {
    const person = this.person(npcId);
    if (!person) return;
    const view = person.view;
    for (const key of MIRROR_NUMBERS) {
      const value = fields[key];
      if (typeof value === 'number' && Number.isFinite(value)) view[key] = value;
    }
    for (const key of MIRROR_FLAGS) {
      const value = fields[key];
      if (typeof value === 'boolean') view[key] = value;
    }
    const { sceneId, gesture, point, progress, paper, pen } = fields;
    if (typeof sceneId === 'string' && this.deps.scenes.tryGet(sceneId)) view.sceneId = sceneId;
    if (typeof gesture === 'string' && GESTURES.has(gesture)) view.gesture = gesture as NpcGesture;
    if (point === null || typeof point === 'string') view.point = point;
    if (progress === null || typeof progress === 'number') view.progress = progress;
    if (paper === 'none' || paper === 'hand' || paper === 'desk') view.paper = paper;
    if (pen === 'none' || pen === 'blue' || pen === 'red') view.pen = pen;
    // Looking at their player: here, the one they look at stands where that game says.
    person.mirrored = true;
  }

  /** The board as another player's lesson writes it (Phase F-3). */
  mirrorBoard(board: Readonly<Omit<BoardView, 'version'>>): void {
    const b = this.board;
    b.boardId = board.boardId;
    b.lines = [...board.lines];
    b.shown = board.lines.map((line, i) => Math.min(line.length, board.shown[i] ?? 0));
    b.title = board.title;
    b.answer = board.answer;
    b.version++;
  }

  /** The board the camera frames: a lesson going on at it (Y-3), or null. */
  get boardFramed(): string | null {
    const open = this.conversation;
    const person = open ? this.person(open.npcId) : undefined;
    return person?.mode === 'board' ? this.board.boardId : null;
  }

  /** Worked examples the station's experiment has (0: none, or no such station). */
  private examplesOf(stationId: string): number {
    return this.deps.stations?.view(stationId)?.definition.examples.length ?? 0;
  }

  /** The board (an item tagged `board`) in the station's scene nearest it, or null. */
  private boardNear(stationId: string): WorldEntity | null {
    const world = this.deps.world;
    const station = world?.entity(stationId);
    const scene = station ? this.sceneOf(station.roomId) : undefined;
    if (!world || !station || !scene) return null;
    let best: WorldEntity | null = null;
    let nearest = Infinity;
    for (const entity of world.allEntities()) {
      if (!entity.item.tags.includes('board') || !scene.rooms.includes(entity.roomId)) continue;
      const d = Math.hypot(
        entity.pose.position[0] - station.pose.position[0],
        entity.pose.position[2] - station.pose.position[2],
      );
      if (d < nearest) {
        nearest = d;
        best = entity;
      }
    }
    return best;
  }

  /** The world scene room `roomId` is in. */
  private sceneOf(roomId: string): { id: string; rooms: readonly string[] } | undefined {
    for (const scene of this.deps.scenes.all()) {
      if (scene.kind === 'world' && scene.rooms.includes(roomId)) return scene;
    }
    return undefined;
  }

  /**
   * Works example `index` of the station's experiment on the board of its lab (Y-3): the Explain
   * view closes, the board is wiped, and he goes to it to write the example line by line. The
   * answer is the model's prediction (`workExample`). Why he cannot, or null.
   */
  private startBoard(person: Person, stationId: string, index: number): string | null {
    const t = this.deps.texts;
    const definition = this.deps.stations?.view(stationId)?.definition;
    const model = definition ? this.deps.models?.(definition.model) : undefined;
    const example = definition?.examples[index];
    const lesson = person.npc.lesson;
    const board = this.boardNear(stationId);
    const scene = board ? this.sceneOf(board.roomId) : undefined;
    const offset = scene ? this.deps.offsetOf(scene.id) : null;
    const none = t.ui('npc.noBoard', 'There is no worked example for this one on the board yet.');
    if (!definition || !model || !example || !lesson || !board || !scene || !offset) return none;
    let worked: ReturnType<typeof workExample>;
    try {
      worked = workExample(definition, model, example, index, t);
    } catch {
      return none; // the model refuses it (content checks keep this from happening)
    }
    // What is written: the title, what is given and asked, each step's formula, the answer.
    const written = [worked.title, worked.given, worked.find];
    const lines: { text: string; writes: number[] }[] = [
      { text: worked.question, writes: [0] },
      { text: t.of(lesson.given, 'text'), writes: [1, 2] },
    ];
    for (const step of worked.steps) {
      if (step.write !== null) written.push(step.write);
      lines.push({ text: step.say, writes: step.write === null ? [] : [written.length - 1] });
    }
    written.push(worked.answer);
    lines.push({
      text: fill(t.of(lesson.answer, 'text'), { answer: worked.answerValues }),
      writes: [written.length - 1],
    });
    // Each written text as the board lines it takes (a long one broken to stay readable).
    const laid = layoutBoard(board.item.visual.size, written);
    const range = (i: number) =>
      Array.from(
        { length: (laid.from[i + 1] ?? 0) - (laid.from[i] ?? 0) },
        (_, k) => (laid.from[i] ?? 0) + k,
      );
    const said = lines.map((line) => ({ text: line.text, writes: line.writes.flatMap(range) }));
    // The board in its scene's coordinates; where he stands to write each line, and beside it.
    const [, qy, , qw] = board.pose.rotation;
    const yaw = 2 * Math.atan2(qy, qw);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const bx = board.pose.position[0] - offset[0];
    const by = board.pose.position[1] - offset[1];
    const bz = board.pose.position[2] - offset[2];
    const { area } = laid;
    const half = board.item.visual.size[0] / 2;
    const grid = this.grid(scene.id);
    const spot = (lx: number, lz: number, reach: number): [number, number] => {
      const x = bx + lx * c + lz * s;
      const z = bz - lx * s + lz * c;
      return grid && nearestFree(grid, x, z, reach, this.free)
        ? [this.free[0], this.free[1]]
        : [x, z];
    };
    const writes = laid.lines.map((text) => {
      const middle = area.left + Math.min(area.width, text.length * area.charWidth) / 2;
      const x = Math.min(half - 0.25, Math.max(-half + 0.25, middle - 0.1));
      return spot(x, area.face + WRITE_OUT_M, 0.6);
    });
    const [sideX, sideZ] = spot(half + BOARD_SIDE_M, area.face + 0.45, 1);
    // Beside it he faces out, turned a little towards it.
    const dx = s * Math.cos(BOARD_TURN) - c * Math.sin(BOARD_TURN);
    const dz = c * Math.cos(BOARD_TURN) + s * Math.sin(BOARD_TURN);
    person.board = {
      stationId,
      sceneId: scene.id,
      index,
      count: definition.examples.length,
      lines: said,
      x: bx,
      y: by,
      z: bz,
      yaw,
      area,
      writeX: writes.map((w) => w[0]),
      writeZ: writes.map((w) => w[1]),
      sideX,
      sideZ,
      face: Math.atan2(-dx, -dz),
      ink: 0,
    };
    // The board wiped for this example.
    this.board.boardId = board.id;
    this.board.lines = laid.lines;
    this.board.shown = laid.lines.map(() => 0);
    this.board.title = laid.from[1] ?? 0;
    this.board.answer = laid.from[written.length - 1] ?? 0;
    this.board.version++;
    person.lecture = null;
    person.view.point = null;
    person.mode = 'board';
    const npcId = person.npc.id;
    // Off the station (closing the Explain view ends nothing), then the view closes.
    this.deps.state.session.conversation = { npcId, stage: 'lesson', line: 0 };
    this.deps.explain?.close();
    this.deps.events.publish('ConversationChanged', { npcId, stage: 'lesson' });
    return null;
  }

  /** Board line `line` written out whole at once. */
  private writeWhole(line: number): void {
    const length = this.board.lines[line]?.length ?? 0;
    if ((this.board.shown[line] ?? 0) >= length) return;
    this.board.shown[line] = length;
    this.board.version++;
  }

  /**
   * At the board: while a line said writes, he goes to where it is written and writes it, letter
   * by letter, his hand where the pen is; then he steps aside and talks, facing out.
   */
  private atBoard(person: Person, b: BoardLesson, dt: number): void {
    const { view } = person;
    const open = this.conversation;
    const board = this.board;
    const said =
      open?.npcId === person.npc.id && open.stage === 'lesson' ? b.lines[open.line] : undefined;
    let writing = -1;
    for (const i of said?.writes ?? []) {
      if ((board.shown[i] ?? 0) < (board.lines[i]?.length ?? 0)) {
        writing = i;
        break;
      }
    }
    const turn = Math.min(1, dt * TURN_RATE);
    if (writing < 0) {
      if (person.walker.to(b.sceneId, b.sideX, b.sideZ, FOLLOW_SPEED, dt, 0)) {
        view.heading += wrap(b.face - view.heading) * turn;
        view.gesture = 'talk';
      } else view.gesture = 'idle';
      return;
    }
    const x = b.writeX[writing] ?? b.x;
    const z = b.writeZ[writing] ?? b.z;
    if (!person.walker.to(b.sceneId, x, z, FOLLOW_SPEED, dt, 0)) {
      view.gesture = 'idle';
      return;
    }
    view.heading += wrap(b.yaw - view.heading) * turn;
    view.gesture = 'write';
    const length = board.lines[writing]?.length ?? 0;
    b.ink += dt * WRITE_CPS;
    const whole = Math.floor(b.ink);
    if (whole > 0) {
      b.ink -= whole;
      board.shown[writing] = Math.min(length, (board.shown[writing] ?? 0) + whole);
      board.version++;
    }
    // His hand where the pen is.
    penAt(b.area, writing, board.shown[writing] ?? 0, length, this.pen);
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    view.reaching = true;
    view.reachX = b.x + this.pen[0] * c + this.pen[2] * s;
    view.reachY = b.y + this.pen[1];
    view.reachZ = b.z - this.pen[0] * s + this.pen[2] * c;
  }

  private askWhich(npcId: string): void {
    const person = this.person(npcId);
    if (!person?.npc.lesson) return;
    this.set(person, 'ask', 0);
  }

  /** Looking at a station while a person follows: E asks them to explain it. */
  /** Whether someone follows the player to explain an experiment (Phase Y-2). */
  get following(): boolean {
    for (const p of this.people) if (p.mode === 'follow') return true;
    return false;
  }

  private offer(targetId: string): InteractionAction | null {
    if (this.conversation) return null;
    let person: Person | undefined;
    for (const p of this.people) if (p.mode === 'follow') person = p;
    const stationId = person ? this.stationOf(targetId) : null;
    if (!person || !stationId) return null;
    this.askedNpc = person.npc.id;
    this.askedStation = stationId;
    return this.askAction;
  }

  /** What E on a station does while someone follows (one action: offers run every frame). */
  private makeAskAction(): InteractionAction {
    const label = () => this.askLabel();
    return {
      id: 'ask-npc',
      get label() {
        return label();
      },
      // Following, an experiment offers only this (its own controls, inspect and H wait).
      exclusive: true,
      isAvailable: () => this.conversation === null && this.askedStation !== null,
      perform: () => {
        if (this.askedStation) this.lectureAt(this.askedNpc, this.askedStation);
      },
    };
  }

  /** The label of `askAction`, naming whoever follows. */
  private askLabel(): string {
    const t = this.deps.texts;
    const npc = this.deps.npcs.tryGet(this.askedNpc);
    return t.ui('npc.askExplain', 'Ask {name} to explain this', {
      name: npc ? t.of(npc, 'title') : '',
    });
  }

  /**
   * The station with an Explain view that `targetId` belongs to (its apparatus, or a part naming
   * it: desk, dials, board…), or null; remembered per target (stations do not change).
   */
  private stationOf(targetId: string): string | null {
    const known = this.stationIds.get(targetId);
    if (known !== undefined) return known;
    const entity = this.deps.world?.entity(targetId);
    const placement = entity?.params.station;
    const id = !entity
      ? null
      : typeof placement === 'string'
        ? `${entity.roomId}/${placement}`
        : entity.id;
    const station = id && this.deps.stations?.view(id)?.definition.explain ? id : null;
    if (entity) this.stationIds.set(targetId, station);
    return station;
  }

  private set(person: Person, stage: ConversationStage, line: number): void {
    const open = this.conversation;
    const npcId = person.npc.id;
    this.deps.state.session.conversation = {
      npcId,
      stage,
      line,
      ...(open?.stationId ? { stationId: open.stationId } : {}),
    };
    if (open) this.deps.events.publish('ConversationChanged', { npcId, stage });
    else this.deps.events.publish('ConversationOpened', { npcId });
  }

  private person(npcId: string): Person | undefined {
    for (const person of this.people) if (person.npc.id === npcId) return person;
    return undefined;
  }

  /** Where a person's scene is now (resident or not), and their body and target to match. */
  private settle(person: Person): void {
    const playing = this.deps.state.session.phase === 'playing';
    const offset = playing ? this.deps.offsetOf(person.view.sceneId) : null;
    person.resident = offset !== null;
    person.ox = offset?.[0] ?? 0;
    person.oz = offset?.[2] ?? 0;
    this.attend(person);
  }

  /** Resident: a body and a target for E; out of residence, neither. */
  private attend(person: Person): void {
    const { agents, interaction } = this.deps;
    const here = person.resident;
    if (here && !person.release) {
      const { npc } = person;
      const t = this.deps.texts;
      const height = npc.character.appearance.heightM;
      person.release = interaction.register({
        id: `${npc.scene}/${npc.id}`,
        get displayName() {
          return t.of(npc, 'title');
        },
        center: person.center,
        halfExtents: [0.32, height / 2, 0.32],
        rotation: UPRIGHT,
        actions: [
          {
            id: 'talk',
            get label() {
              return t.ui('npc.talk', 'Talk');
            },
            isAvailable: () =>
              this.conversation === null && person.mode !== 'lecture' && person.mode !== 'board',
            // Another player has them now (Phase F-3): wait until they are done.
            blocked: () => {
              const name = this.deps.drivenBy?.(npc.id) ?? null;
              return name === null
                ? null
                : t.ui('npc.busyWith', '{teacher} is helping {name} now: wait until he is done.', {
                    teacher: t.of(npc, 'title'),
                    name,
                  });
            },
            perform: () => void this.open(npc.id),
          },
        ],
      });
    } else if (!here && person.release) {
      person.release();
      person.release = null;
      this.endOffer(person);
    }
    if (!agents) return;
    if (here) {
      agents.placeAgent(
        person.npc.id,
        person.view.x + person.ox,
        person.view.z + person.oz,
        person.npc.character.appearance.heightM,
      );
      person.bodied = true;
    } else if (person.bodied) {
      agents.removeAgent(person.npc.id);
      person.bodied = false;
    }
  }

  /** On through their day or their errand; where they look. */
  private live(person: Person, dt: number): void {
    const { view } = person;
    if (this.deps.drivenBy?.(person.npc.id)) {
      // Another player's game drives them (Phase F-3): drawn as it says; here they only stand.
      person.mirrored = true;
      person.center[0] = view.x + person.ox;
      person.center[2] = view.z + person.oz;
      person.center[1] = person.npc.character.appearance.heightM / 2 - 0.45 * view.sit;
      return;
    }
    if (person.mirrored) {
      // Done with them there: they walk back to their day from where they are.
      person.mirrored = false;
      person.mode = 'return';
      person.lecture = null;
      person.board = null;
      person.errand = null;
      view.talking = false;
      view.progress = null;
      view.paper = 'none';
      view.pen = 'none';
    }
    const playerScene = this.deps.state.session.sceneId;
    const player = this.playerLocal(person);
    const sameScene = person.resident && playerScene === view.sceneId;
    const near = sameScene ? Math.hypot(player[0] - view.x, player[2] - view.z) : Infinity;
    const open = this.conversation;
    view.talking = open?.npcId === person.npc.id;
    view.point = null;
    if (person.mode !== 'errand') view.progress = null;
    if (!person.walker.busy) view.reaching = false;
    if (person.walker.busy) {
      person.walker.go(dt);
    } else if (
      view.talking &&
      open &&
      !open.stationId &&
      person.mode !== 'lecture' &&
      person.mode !== 'board'
    ) {
      // Held where they are: standing, they turn to the player; seated, they only look round.
      view.speed = 0;
      view.gesture = open.stage === 'menu' || open.stage === 'waiting' ? 'listen' : 'talk';
      const job = person.script?.seconds;
      if (open.stage === 'script' && job !== undefined) {
        // A job done while the line holds: its progress, then on.
        view.gesture = 'write';
        person.scriptT += dt;
        view.progress = Math.min(1, person.scriptT / job);
        if (person.scriptT >= job) this.advance();
      }
      if (view.sit < 0.5) {
        const face = Math.atan2(-(player[0] - view.x), -(player[2] - view.z));
        view.heading += wrap(face - view.heading) * Math.min(1, dt * TURN_RATE);
      }
    } else if (person.mode === 'day') {
      this.day(person, dt, sameScene, player);
    } else if (person.mode === 'follow') {
      this.rise(person, dt);
      if (playerScene && near > FOLLOW_M) {
        const speed = near > HURRY_M ? HURRY_SPEED : FOLLOW_SPEED;
        person.walker.to(playerScene, player[0], player[2], speed, dt, FOLLOW_M);
      } else this.stand(person, dt);
      view.gesture = 'idle';
    } else if (person.mode === 'lecture' && person.lecture) {
      this.rise(person, dt);
      const l = person.lecture;
      const there =
        view.sceneId === l.sceneId && Math.hypot(l.x - view.x, l.z - view.z) <= ARRIVED_M;
      if (!there) {
        const far = view.sceneId !== l.sceneId || Math.hypot(l.x - view.x, l.z - view.z) > HURRY_M;
        person.walker.to(l.sceneId, l.x, l.z, far ? HURRY_SPEED : FOLLOW_SPEED, dt, 0);
        view.gesture = 'idle';
      } else {
        view.speed = 0;
        const line = open?.stage === 'lecture' ? l.lines[open.line] : undefined;
        view.point = line?.parts[0] ?? null;
        // Pointing, he faces the apparatus; otherwise the player.
        const face = view.point ? l.face : Math.atan2(-(player[0] - view.x), -(player[2] - view.z));
        view.heading += wrap(face - view.heading) * Math.min(1, dt * TURN_RATE);
        view.gesture = 'talk';
      }
    } else if (person.mode === 'board' && person.board) {
      this.rise(person, dt);
      this.atBoard(person, person.board, dt);
    } else if (person.mode === 'errand' && person.errand) {
      this.rise(person, dt);
      this.onErrand(person, person.errand, dt);
    } else if (person.mode === 'return') {
      this.rise(person, dt);
      const home = person.plan?.stops[0]?.stand ?? person.npc.schedule[0]?.at ?? [0, 0];
      const there =
        view.sceneId === person.npc.scene &&
        Math.hypot(home[0] - view.x, home[1] - view.z) <= ARRIVED_M;
      if (there || !person.resident) {
        // Home (or out of sight: no need to be seen walking): the day goes on from its first stop.
        this.goHome(person);
      } else {
        person.walker.to(person.npc.scene, home[0], home[1], person.npc.walkSpeed, dt, 0);
        view.gesture = 'idle';
      }
    }
    person.walker.steps(dt);
    view.looking = view.talking || near < NOTICE_M;
    view.lookX = player[0];
    view.lookZ = player[2];
    person.center[0] = view.x + person.ox;
    person.center[2] = view.z + person.oz;
    person.center[1] = person.npc.character.appearance.heightM / 2 - 0.45 * view.sit;
  }

  /** Their day: the stops of their schedule, waiting when the player is in the way. */
  private day(person: Person, dt: number, sameScene: boolean, player: Vec3): void {
    const { view, npc } = person;
    if (view.sceneId !== npc.scene) {
      person.mode = 'return';
      return;
    }
    if (!person.plan) {
      person.plan = this.planFor(npc);
      person.t = person.plan?.stops[0]?.stayS ?? 0; // the day starts at its first stop
    }
    const plan = person.plan;
    if (!plan) return;
    const next = poseAt(plan, person.t + dt, npc.walkSpeed, person.pose);
    const blocked =
      next.walking && sameScene && Math.hypot(player[0] - next.x, player[2] - next.z) < GIVE_WAY_M;
    if (blocked) {
      view.speed = 0; // waits for the player to pass
      poseAt(plan, person.t, npc.walkSpeed, person.pose);
      return;
    }
    person.t += dt;
    view.x = next.x;
    view.z = next.z;
    view.speed = next.speed;
    view.gesture = next.gesture;
    view.sit = next.sit;
    view.heading += wrap(next.heading - view.heading) * Math.min(1, dt * TURN_RATE * 2);
  }

  /**
   * On an errand: (a paper taken from the player's hand first,) to the first stop of their day (at
   * once out of sight), then at work there, facing as that stop does; done, the job hands over and
   * the day goes on from that stop — or they hold the paper out until it is taken.
   */
  private onErrand(person: Person, errand: NpcErrand, dt: number): void {
    const { view, npc } = person;
    if (person.errandStage === 'receive') {
      // Standing, facing where the hands meet, their arm out to it.
      view.speed = 0;
      view.gesture = 'idle';
      const face = Math.atan2(-(person.meet[0] - view.x), -(person.meet[2] - view.z));
      view.heading += wrap(face - view.heading) * Math.min(1, dt * TURN_RATE);
      this.reachTo(view, person.meet);
      person.errandT += dt;
      if (person.errandT >= RECEIVE_MAX_S) this.takePaper(npc.id);
      return;
    }
    if (person.errandStage === 'offer') {
      this.offering(person, errand, dt);
      return;
    }
    const plan = person.plan ?? (person.plan = this.planFor(npc));
    const home = plan?.stops[0]?.stand ?? npc.schedule[0]?.at ?? [0, 0];
    const facing = npc.schedule[0]?.heading ?? view.heading;
    const there =
      view.sceneId === npc.scene && Math.hypot(home[0] - view.x, home[1] - view.z) <= ARRIVED_M;
    if (!there && person.resident) {
      person.walker.to(npc.scene, home[0], home[1], FOLLOW_SPEED, dt, 0);
      view.gesture = 'idle';
      return;
    }
    if (!there) {
      view.sceneId = npc.scene;
      view.x = home[0];
      view.z = home[1];
      person.walker.forget();
    }
    view.speed = 0;
    view.heading += wrap(facing - view.heading) * Math.min(1, dt * TURN_RATE);
    view.gesture = errand.gesture;
    if (errand.desk) this.deskHand(view, errand.desk, person.errandT);
    if (errand.paper) {
      // The paper on the desk under the pen, the pen in the hand.
      view.paper = 'desk';
      view.pen = errand.paper.ink;
      const ahead = (errand.desk?.forward ?? HAND_AHEAD_M) - 0.06;
      view.paperX = view.x - Math.sin(view.heading) * ahead;
      view.paperY = (errand.desk?.height ?? 1) - 0.016;
      view.paperZ = view.z - Math.cos(view.heading) * ahead;
    }
    person.errandT += dt;
    view.progress = Math.min(1, person.errandT / errand.seconds);
    if (person.errandT < errand.seconds) return;
    view.progress = null;
    view.pen = 'none';
    if (errand.offer) {
      person.errandStage = 'offer';
      view.paper = 'hand';
      this.offering(person, errand, 0); // a target from this frame on
      errand.done();
      return;
    }
    view.paper = 'none';
    person.errand = null;
    person.mode = 'day';
    person.t = plan?.stops[0]?.stayS ?? 0;
    errand.done();
  }

  /**
   * Holding the paper out (Phase Y-5): standing at their stop, the arm out over the counter, a
   * target for E (or a click) on it, until the player takes it (`release`).
   */
  private offering(person: Person, errand: NpcErrand, dt: number): void {
    const { view, npc } = person;
    view.speed = 0;
    view.gesture = 'idle';
    const facing = npc.schedule[0]?.heading ?? view.heading;
    view.heading += wrap(facing - view.heading) * Math.min(1, dt * TURN_RATE);
    this.handAt(person, view.heading, person.meet);
    this.reachTo(view, person.meet);
    person.offerCenter[0] = person.meet[0] + person.ox;
    person.offerCenter[1] = person.meet[1] - 0.1;
    person.offerCenter[2] = person.meet[2] + person.oz;
    const offer = errand.offer;
    if (!offer || !person.resident || person.offerRelease) return;
    const t = this.deps.texts;
    person.offerRelease = this.deps.interaction.register({
      id: `${npc.scene}/${npc.id}/paper`,
      get displayName() {
        return t.of(npc, 'title');
      },
      center: person.offerCenter,
      halfExtents: [0.16, 0.18, 0.16],
      rotation: UPRIGHT,
      actions: [
        {
          id: 'take-paper',
          get label() {
            return offer.label();
          },
          click: true,
          isAvailable: () => this.conversation === null,
          perform: () => offer.take(),
        },
      ],
    });
  }

  /** The held-out paper is no longer a target. */
  private endOffer(person: Person): void {
    person.offerRelease?.();
    person.offerRelease = null;
  }

  /** Where their right hand holds a paper out, facing `heading`, into `out` (their scene's frame). */
  private handAt(person: Person, heading: number, out: Vec3): void {
    const { view } = person;
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    out[0] = view.x - sin * HAND_AHEAD_M + cos * HAND_SIDE_M;
    out[1] = HAND_UP_M;
    out[2] = view.z - cos * HAND_AHEAD_M - sin * HAND_SIDE_M;
  }

  private reachTo(view: NpcView, at: Readonly<Vec3>): void {
    view.reaching = true;
    view.reachX = at[0];
    view.reachY = at[1];
    view.reachZ = at[2];
  }

  /**
   * Their right hand writing on a desk in front of them (`desk`: m ahead, m up): along a line of
   * 24 cm in 2.4 s, the next line a little nearer, the pen lifted between words.
   */
  private deskHand(view: NpcView, desk: NpcDesk, t: number): void {
    const along = (t % 2.4) / 2.4;
    const side = -0.12 + 0.24 * along;
    const ahead = desk.forward - 0.04 * (Math.floor(t / 2.4) % 4);
    const sin = Math.sin(view.heading);
    const cos = Math.cos(view.heading);
    view.reaching = true;
    view.reachX = view.x - sin * ahead + cos * side;
    view.reachY = desk.height + 0.012 * Math.abs(Math.sin(t * 7));
    view.reachZ = view.z - cos * ahead - sin * side;
  }

  /** Back to the first stop of the day, which goes on from there. */
  private goHome(person: Person): void {
    const { view, npc } = person;
    const plan = person.plan ?? (person.plan = this.planFor(npc));
    const home = plan?.stops[0]?.stand ?? npc.schedule[0]?.at ?? [0, 0];
    view.sceneId = npc.scene;
    view.x = home[0];
    view.z = home[1];
    view.speed = 0;
    person.t = plan?.stops[0]?.stayS ?? 0;
    person.mode = 'day';
    person.walker.forget();
  }

  /** Up from a seat before walking off on an errand. */
  private rise(person: Person, dt: number): void {
    if (person.view.sit > 0) person.view.sit = Math.max(0, person.view.sit - dt / 0.9);
  }

  private stand(person: Person, dt: number): void {
    person.view.speed = 0;
    const player = this.playerLocal(person);
    const face = Math.atan2(-(player[0] - person.view.x), -(player[2] - person.view.z));
    person.view.heading += wrap(face - person.view.heading) * Math.min(1, dt * TURN_RATE);
  }

  /** The player in a person's scene's own coordinates (scratch: valid until the next call). */
  private playerLocal(person: Person): Vec3 {
    const position = this.deps.state.player.position;
    const out = this.local;
    out[0] = position[0] - person.ox;
    out[1] = position[1];
    out[2] = position[2] - person.oz;
    return out;
  }

  /** Turns the player's view towards the person talked to (they stand left of their choices). */
  private turnView(person: Person, dt: number): void {
    const { player } = this.deps.state;
    const head = person.npc.character.appearance.heightM - 0.12 - 0.45 * person.view.sit;
    const dx = person.view.x + person.ox - player.position[0];
    const dz = person.view.z + person.oz - player.position[2];
    const py = player.position[1];
    const yaw = Math.atan2(-dx, -dz) - VIEW_ASIDE;
    const pitch = Math.atan2(head - (py + player.eyeHeight), Math.hypot(dx, dz));
    const k = Math.min(1, dt * TURN_RATE);
    player.yaw += wrap(yaw - player.yaw) * k;
    player.pitch += (pitch - player.pitch) * k;
  }

  /** A scene's walkable floor (built once, on first need). */
  private grid(sceneId: string): NavGrid | null {
    if (this.grids.has(sceneId)) return this.grids.get(sceneId) ?? null;
    const scene = this.deps.scenes.tryGet(sceneId);
    const rooms =
      scene?.kind === 'world' ? scene.rooms.flatMap((id) => this.deps.rooms.tryGet(id) ?? []) : [];
    const grid = rooms.length > 0 ? buildNavGrid(rooms, this.deps.itemOf) : null;
    this.grids.set(sceneId, grid);
    return grid;
  }

  /** Their day laid out on their scene's floor; null if it has none. */
  private planFor(npc: NpcDefinition): DayPlan | null {
    const grid = this.grid(npc.scene);
    return grid ? planDay(grid, npc.schedule, npc.walkSpeed) : null;
  }
}

type GameStateConversation = NonNullable<GameState['session']['conversation']>;
export type { Explain };
