import { Disposables, type EventBus } from '../../core/EventBus';
import { fill, type Texts } from '../../core/i18n';
import type { Logger } from '../../core/Logger';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState, PaperRecord } from '../../game/GameState';
import type { ExperimentDefinition } from '../../simulation/experiment';
import { composePaper, gradePaper, type PaperGrade } from '../../simulation/paper';
import type {
  Question,
  QuestionLevel,
  QuestionSet,
  QuestionType,
} from '../../simulation/questions';
import type { SimulationModel } from '../../simulation/SimulationModel';
import { exampleInputs, fillExample } from '../../simulation/workedExample';
import type { Vec3 } from '../../core/math';
import type { WorldEntity } from '../../world/World';
import type { ActionTarget } from '../action/ActionSystem';
import type { ItemDefinition } from '../item';
import type { InputState } from '../player/InputState';
import type { InteractionAction, Interactable } from '../interaction/InteractionSystem';
import type { NpcDefinition, NpcTestLines } from '../npc/npc';
import type { NpcErrand, NpcOffer, NpcScript } from '../npc/NpcSystem';

/** Seconds the teacher writes a test at his desk (Phú, 2026-11-09: about 10 s). */
export const WRITE_S = 10;
/** Seconds he marks a paper handed in, at his desk. */
export const MARK_S = 5;
/** The most questions a test may ask for. */
export const MAX_QUESTIONS = 40;

/** A question of a paper as printed, in the current language, its numbers filled from its model. */
export interface PaperItemTexts {
  readonly question: Question;
  readonly stem: string;
  /** A choice question's options in their printed order (A–D); none for true/false. */
  readonly options: readonly string[];
  /** A true/false question's statements a–d; none for a choice question. */
  readonly statements: readonly string[];
  readonly explain: string;
}

/** What the player asks a test to cover (the setup form). */
export interface TestRequest {
  readonly experiments: readonly string[];
  readonly count: number;
  readonly types: readonly QuestionType[];
  readonly levels: readonly QuestionLevel[];
}

export interface PaperSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  texts: Texts;
  input: InputState;
  log: Logger;
  npcDefinitions: Registry<NpcDefinition>;
  npcs: {
    provide(behavior: string, run: (npcId: string) => void): () => void;
    speak(npcId: string, script: NpcScript): boolean;
    errand(npcId: string, errand: NpcErrand): boolean;
    takePaper(npcId: string): void;
    release(npcId: string): void;
    handPoint(npcId: string): Readonly<Vec3> | null;
    mode(npcId: string): string | null;
    open(npcId: string): boolean;
    close(): boolean;
    targetOf(npcId: string): string | null;
    readonly conversation: unknown;
  };
  inventory: {
    give(itemId: string, id: string): boolean;
    discard(id: string): boolean;
    holds(id: string): boolean;
    hasRoom(itemId: string): boolean;
    at(slot: number): { readonly item: string; readonly placements: readonly string[] } | null;
    readonly selected: number;
  };
  interaction: {
    addOffer(offer: (targetId: string) => InteractionAction | null): () => void;
    readonly focused: Interactable | null;
  };
  world: { entity(id: string): WorldEntity | undefined };
  /** The player's hands acted out: taking a paper from a hand, handing one over. */
  actions: {
    playOn(id: string, target: ActionTarget, effect: () => void): boolean;
    readonly busy: boolean;
  };
  items: { tryGet(id: string): ItemDefinition | undefined };
  /** The experiments and their models: a question's numbers are filled from its model. */
  experiments: Registry<ExperimentDefinition>;
  modelOf: (id: string) => SimulationModel | undefined;
  /** The question banks (`content.questions`), filled by `loadQuestions`. */
  banks: Registry<QuestionSet>;
  loadQuestions: () => Promise<void>;
}

/**
 * The hub teacher's tests (Phase Y-5, Phú 2026-11-09): his third choice. He asks what it should
 * cover (a form: simulations of any subjects, how many questions, which kinds, which levels), goes
 * to his desk and writes it on a sheet there with a pen (WRITE_S, his progress over his head) —
 * the game goes on, never paused — then holds it out and calls the player, who takes it from his
 * hand (E or a click on it, the player's hand acted out) into the bag (an instance of his
 * `paperItem` under its own id: `progression.papers`, saved). Chosen in the hotbar, E (on nothing)
 * holds it up to do it: answers circled, changed (the old one crossed out), no time limit; several
 * papers at once. Handed in (E or a click on him with it chosen), the player's hand gives it to
 * his; he marks it at his desk in red (THPT 2025's points, `gradePaper`), holds it out again, and
 * says the mark once it is taken back, his notes on its sheet; the mark is kept
 * (`progression.scores`) even after the paper is thrown away (E on a waste bin with it). A paper
 * he still has when the game is saved is held out again after a load (marked if it was not).
 */
export class PaperSystem implements GameSystem {
  readonly id = 'papers';
  private readonly subscriptions = new Disposables();
  /** Tests written and not yet handed over, by teacher. */
  private readonly pending = new Map<string, PaperRecord>();
  /** Actions offered on a teacher or a bin while a paper is chosen (made once: offers run every frame). */
  private readonly handInAction: InteractionAction;
  private readonly throwAction: InteractionAction;

  constructor(private readonly deps: PaperSystemDeps) {
    const t = deps.texts;
    this.handInAction = {
      id: 'hand-in',
      get label() {
        return t.ui('paper.handIn', 'Hand in the test');
      },
      click: true,
      isAvailable: () => this.chosen !== null,
      perform: () => {
        const paper = this.chosen;
        if (paper) this.handIn(paper.id);
      },
    };
    this.throwAction = {
      id: 'throw-away',
      get label() {
        return t.ui('paper.throwAway', 'Throw the test away');
      },
      isAvailable: () => this.chosen !== null,
      perform: () => {
        const paper = this.chosen;
        if (paper) this.discard(paper.id);
      },
    };
  }

  init(): void {
    const s = this.subscriptions;
    s.add(this.deps.npcs.provide('give-test', (npcId) => this.setUp(npcId)));
    s.add(this.deps.events.subscribe('GameLoaded', () => this.restore()));
    s.add(this.deps.interaction.addOffer((targetId) => this.offer(targetId)));
    s.add(this.deps.events.subscribe('SceneLoading', () => this.closePaper()));
  }

  /** Every paper the player has. */
  get papers(): readonly PaperRecord[] {
    return this.deps.state.progression.papers;
  }

  paper(id: string): PaperRecord | null {
    for (const p of this.deps.state.progression.papers) if (p.id === id) return p;
    return null;
  }

  /** The paper held up to be done or read, or null. */
  get reading(): PaperRecord | null {
    const id = this.deps.state.session.paper ?? null;
    return id === null ? null : this.paper(id);
  }

  /** The paper chosen in the hotbar (its slot selected), or null. */
  get chosen(): PaperRecord | null {
    const stack = this.deps.inventory.at(this.deps.inventory.selected);
    const id = stack?.placements.at(-1);
    return id === undefined ? null : this.paper(id);
  }

  /** The question banks are in (the setup form and a paper read need them). */
  get banksReady(): boolean {
    return this.deps.banks.all().length > 0;
  }

  /** The bank question of a paper's item, or null (a bank that no longer has it). */
  question(item: PaperRecord['items'][number]): Question | null {
    const bank = this.deps.banks.tryGet(item.experiment);
    for (const q of bank?.questions ?? []) if (q.id === item.question) return q;
    return null;
  }

  /**
   * Item `item` of a paper as printed: its stem, options (in the paper's order) or statements, and
   * its explanation, in the current language, numbers filled from the question's own inputs and
   * its model; null if its bank no longer has it.
   */
  textsOf(item: PaperRecord['items'][number]): PaperItemTexts | null {
    const question = this.question(item);
    const definition = this.deps.experiments.tryGet(item.experiment);
    if (!question || !definition) return null;
    const inputs = exampleInputs(definition, question);
    let theory: Record<string, number> = {};
    try {
      theory = this.deps.modelOf(definition.model)?.predict?.(inputs) ?? {};
    } catch {
      // Checked when the banks load: never refused here.
    }
    const t = this.deps.texts;
    const filled = (text: string) => {
      try {
        return fillExample(text, inputs, theory);
      } catch {
        return text;
      }
    };
    return {
      question,
      stem: filled(t.of(question, 'stem')),
      explain: filled(t.of(question, 'explain')),
      options:
        question.type === 'choice'
          ? item.order.map((k) =>
              filled(question.options[k] ? t.of(question.options[k], 'text') : ''),
            )
          : [],
      statements:
        question.type === 'true-false'
          ? question.statements.map((st) => filled(t.of(st, 'text')))
          : [],
    };
  }

  /** The bank of experiment `id` (its skills and their advice), or null. */
  bank(id: string): QuestionSet | null {
    return this.deps.banks.tryGet(id) ?? null;
  }

  /** How many questions `request` could have (its experiments, kinds and levels), at most its count. */
  available(request: TestRequest): number {
    const paper = composePaper(this.deps.banks, { ...request, seed: 1 });
    return typeof paper === 'string' ? 0 : paper.length;
  }

  /** A paper's mark worked out again from its answers (its sheet), or null before it is marked. */
  grade(id: string): PaperGrade | null {
    const paper = this.paper(id);
    return paper?.marked ? gradePaper(this.deps.banks, paper.items, paper.answers) : null;
  }

  update(): void {
    const { input, state, interaction } = this.deps;
    const { session } = state;
    if (session.phase !== 'playing' || session.paused || !input.wasPressed('interact')) return;
    // E on nothing, a paper chosen: hold it up.
    const busy =
      (session.paper ?? null) !== null ||
      (session.conversation ?? null) !== null ||
      (session.workspace ?? null) !== null ||
      (session.explain ?? null) !== null;
    const paper = this.chosen;
    if (!busy && paper && interaction.focused === null) void this.read(paper.id);
  }

  dispose(): void {
    this.subscriptions.dispose();
  }

  /**
   * The test asked for: drawn from the banks at once (the questions fixed), then written by the
   * teacher at his desk. Why not (no question matches), or null.
   */
  request(npcId: string, request: TestRequest): string | null {
    const lines = this.linesOf(npcId);
    if (!lines) return 'unknown';
    const t = this.deps.texts;
    const number = this.nextNumber();
    const seed = number * 7919 + Math.round(this.deps.state.world.clockS * 1000);
    const count = Math.max(1, Math.min(MAX_QUESTIONS, Math.round(request.count)));
    const items = composePaper(this.deps.banks, { ...request, count, seed });
    if (typeof items === 'string') {
      this.deps.npcs.speak(npcId, {
        text: t.of(lines.none, 'text'),
        then: () => this.setUp(npcId),
      });
      return items;
    }
    const paper: PaperRecord = {
      id: `paper-${number}`,
      number,
      teacher: npcId,
      request: {
        experiments: [...request.experiments],
        count,
        types: [...request.types],
        levels: [...request.levels],
        seed,
      },
      items: items.map((item) => ({ ...item, order: [...item.order] })),
      answers: items.map((item) => (item.order.length > 0 ? null : [null, null, null, null])),
      crossed: items.map(() => []),
      marked: null,
      writtenAtS: this.deps.state.world.clockS,
    };
    this.deps.npcs.speak(npcId, {
      text: t.of(lines.wait, 'text'),
      then: () => {
        this.deps.npcs.close();
        this.pending.set(npcId, paper);
        this.deps.npcs.errand(npcId, {
          gesture: 'write',
          seconds: WRITE_S,
          busy: t.of(lines.busy, 'text'),
          ...(lines.desk ? { desk: lines.desk } : {}),
          paper: { ink: 'blue' },
          offer: this.offerOf(npcId, () => t.ui('paper.take', 'Take the test')),
          done: () => {
            this.deps.events.publish('PaperReady', { npcId, text: t.of(lines.ready, 'text') });
          },
        });
      },
    });
    return null;
  }

  /** The setup form given up: the conversation ends. */
  cancel(): void {
    this.deps.npcs.close();
  }

  /** Holds paper `id` up to do or read it (its banks loaded first). */
  async read(id: string): Promise<void> {
    if (!this.paper(id)) return;
    await this.deps.loadQuestions();
    const { session } = this.deps.state;
    if ((session.paper ?? null) !== null) return;
    session.paper = id;
    this.deps.events.publish('PaperOpened', { paperId: id });
  }

  /** Puts the paper down again; false if none was held up. */
  closePaper(): boolean {
    const { session } = this.deps.state;
    const id = session.paper ?? null;
    if (id === null) return false;
    session.paper = null;
    this.deps.events.publish('PaperClosed', { paperId: id });
    return true;
  }

  /**
   * Answers item `index` of paper `id` (until it is marked): a choice question's printed option,
   * or statement `statement`'s true/false. A different answer crosses the old one out; the same
   * one again is kept. False if it cannot be answered.
   */
  answer(id: string, index: number, value: number | boolean, statement = 0): boolean {
    const paper = this.paper(id);
    const item = paper?.items[index];
    if (!paper || !item || paper.marked) return false;
    const crossed = paper.crossed[index] ?? (paper.crossed[index] = []);
    if (item.order.length > 0) {
      if (typeof value !== 'number' || value < 0 || value > 3 || !Number.isInteger(value)) {
        return false;
      }
      const before = paper.answers[index];
      if (before === value) return true;
      if (typeof before === 'number' && !crossed.includes(before)) crossed.push(before);
      paper.answers[index] = value;
    } else {
      if (typeof value !== 'boolean' || statement < 0 || statement > 3) return false;
      const marks = paper.answers[index];
      const list = Array.isArray(marks) ? [...marks] : [null, null, null, null];
      const before = list[statement] ?? null;
      if (before === value) return true;
      const code = 2 * statement + (before ? 1 : 0);
      if (before !== null && !crossed.includes(code)) crossed.push(code);
      list[statement] = value;
      paper.answers[index] = list;
    }
    this.deps.events.publish('PaperAnswered', { paperId: id, index });
    return true;
  }

  /**
   * Hands paper `id` in to its teacher: with nothing answered he says so; marked already, he
   * points at his sheet; else he marks it (MARK_S), the mark is kept, and he says it.
   */
  handIn(id: string): boolean {
    const paper = this.paper(id);
    const lines = paper ? this.linesOf(paper.teacher) : undefined;
    if (!paper || !lines) return false;
    const t = this.deps.texts;
    const npcs = this.deps.npcs;
    if (paper.marked) return npcs.speak(paper.teacher, { text: t.of(lines.marked, 'text') });
    const answered = paper.answers.some((a) =>
      Array.isArray(a) ? a.some((m) => m !== null) : a !== null,
    );
    if (!answered) return npcs.speak(paper.teacher, { text: t.of(lines.blank, 'text') });
    // Busy (writing, marking, holding a paper out): he says so.
    if (npcs.mode(paper.teacher) === 'errand') return npcs.open(paper.teacher);
    if (this.deps.actions.busy) return false;
    const teacher = paper.teacher;
    void this.deps.loadQuestions();
    npcs.errand(teacher, {
      gesture: 'write',
      seconds: MARK_S,
      busy: t.of(lines.marking, 'text'),
      ...(lines.desk ? { desk: lines.desk } : {}),
      paper: { ink: 'red' },
      receive: true,
      offer: this.offerOf(teacher, () => t.ui('paper.takeMarked', 'Take the marked test')),
      done: () => {
        this.mark(paper);
        this.pending.set(teacher, paper);
        this.deps.events.publish('PaperReady', {
          npcId: teacher,
          text: t.of(lines.markedReady, 'text'),
        });
      },
    });
    // The hand gives it: the moment it lets go, the paper is his (out of the bag).
    const handed = () => {
      if (this.deps.state.session.paper === paper.id) this.closePaper();
      this.deps.inventory.discard(paper.id);
      npcs.takePaper(teacher);
      this.deps.events.publish('PaperHandedIn', {
        paperId: paper.id,
        npcId: teacher,
        text: t.of(lines.handIn, 'text'),
      });
    };
    const target = this.handTarget(teacher, lines.paperItem);
    if (!target || !this.deps.actions.playOn('give-paper', target, handed)) handed();
    return true;
  }

  /** Throws paper `id` away (into a bin): out of the bag and the game; its mark stays. */
  discard(id: string): boolean {
    const papers = this.deps.state.progression.papers;
    const at = papers.findIndex((p) => p.id === id);
    if (at < 0) return false;
    if (this.deps.state.session.paper === id) this.closePaper();
    this.deps.inventory.discard(id);
    papers.splice(at, 1);
    this.deps.events.publish('PaperDiscarded', { paperId: id });
    return true;
  }

  /** A mark as the language writes it: 7.5 or 7,5. */
  score(value: number): string {
    return String(Math.round(value * 100) / 100).replace(
      '.',
      this.deps.texts.ui('number.decimal', '.'),
    );
  }

  /** The teacher asked for a test: his setup line with its form (the banks load meanwhile). */
  private setUp(npcId: string): void {
    const lines = this.linesOf(npcId);
    if (!lines) return;
    void this.deps.loadQuestions().catch((error: unknown) => {
      this.deps.log.error('Question banks could not be loaded', error);
    });
    this.deps.npcs.speak(npcId, {
      text: this.deps.texts.of(lines.setup, 'text'),
      form: 'test-setup',
    });
  }

  /** Marks `paper` (THPT 2025): its mark kept, also in the scores; not without the banks. */
  private mark(paper: PaperRecord): void {
    if (paper.marked || !this.banksReady) return;
    const grade = gradePaper(this.deps.banks, paper.items, paper.answers);
    paper.marked = { points: grade.points, max: grade.max, score: grade.score };
    this.deps.state.progression.scores.push({
      paper: paper.number,
      experiments: [...paper.request.experiments],
      points: grade.points,
      max: grade.max,
      score: grade.score,
    });
    this.deps.events.publish('PaperMarked', { paperId: paper.id, score: grade.score });
  }

  /** What taking the paper held out by `npcId` is called and does, and what he says meanwhile. */
  private offerOf(npcId: string, label: () => string): NpcOffer {
    const lines = this.linesOf(npcId);
    const waiting = lines ? this.deps.texts.of(lines.offering, 'text') : '';
    return { label, waiting, take: () => this.take(npcId) };
  }

  /** Where a hand meets `npcId`'s now, as something a hand works (the paper's look), or null. */
  private handTarget(npcId: string, itemId: string): ActionTarget | null {
    const at = this.deps.npcs.handPoint(npcId);
    const item = this.deps.items.tryGet(itemId);
    if (!at || !item) return null;
    return {
      id: `${this.deps.npcs.targetOf(npcId) ?? npcId}/paper`,
      item,
      roomId: '',
      pose: { position: [at[0], at[1], at[2]], rotation: [0, 0, 0, 1] },
    };
  }

  /**
   * The paper `npcId` holds out, taken: the player's hand takes it (acted out) and at that moment
   * it is theirs, in the bag; a bag with no room for it, and he says so and keeps holding it.
   */
  private take(npcId: string): void {
    const paper = this.pending.get(npcId);
    const lines = this.linesOf(npcId);
    if (!paper || !lines) return;
    if (!this.deps.inventory.hasRoom(lines.paperItem)) {
      this.deps.npcs.speak(npcId, { text: this.deps.texts.of(lines.full, 'text') });
      return;
    }
    const target = this.handTarget(npcId, lines.paperItem);
    const taken = () => this.taken(npcId, paper);
    if (!target || !this.deps.actions.playOn('take-paper', target, taken)) taken();
  }

  private taken(npcId: string, paper: PaperRecord): void {
    const lines = this.linesOf(npcId);
    if (!lines || this.pending.get(npcId) !== paper) return;
    const t = this.deps.texts;
    const papers = this.deps.state.progression.papers;
    if (!papers.includes(paper)) papers.push(paper);
    if (!this.deps.inventory.give(lines.paperItem, paper.id)) {
      // The bag filled up meanwhile: he keeps it (a new paper is not the player's yet).
      if (!paper.marked) papers.splice(papers.indexOf(paper), 1);
      this.deps.npcs.speak(npcId, { text: t.of(lines.full, 'text') });
      return;
    }
    this.pending.delete(npcId);
    this.deps.npcs.release(npcId);
    this.deps.events.publish('PaperGiven', { paperId: paper.id });
    const text = paper.marked
      ? fill(t.of(lines.result, 'text'), { score: this.score(paper.marked.score) })
      : t.of(lines.give, 'text');
    this.deps.npcs.speak(npcId, { text });
    this.restore();
  }

  /**
   * Papers the player handed in and has not taken back (a save while he had one): he marks them
   * (if he had not), holds the first out at his desk, the next once that one is taken.
   */
  private restore(): void {
    for (const paper of this.deps.state.progression.papers) {
      if (this.deps.inventory.holds(paper.id) || [...this.pending.values()].includes(paper))
        continue;
      const lines = this.linesOf(paper.teacher);
      if (!lines || this.pending.has(paper.teacher)) continue;
      const t = this.deps.texts;
      const teacher = paper.teacher;
      void this.deps.loadQuestions().then(() => this.mark(paper));
      this.pending.set(teacher, paper);
      this.deps.npcs.errand(teacher, {
        gesture: 'idle',
        seconds: 0.2,
        busy: t.of(lines.marking, 'text'),
        ...(lines.desk ? { desk: lines.desk } : {}),
        offer: this.offerOf(teacher, () => t.ui('paper.takeMarked', 'Take the marked test')),
        done: () => undefined,
      });
    }
  }

  /** E on a teacher or a bin while a paper is chosen: hand it in, or throw it away. */
  private offer(targetId: string): InteractionAction | null {
    const paper = this.chosen;
    if (!paper || this.deps.npcs.conversation) return null;
    if (targetId === this.deps.npcs.targetOf(paper.teacher)) return this.handInAction;
    const entity = this.deps.world.entity(targetId);
    return entity?.item.interactions.includes('waste-bin') ? this.throwAction : null;
  }

  private linesOf(npcId: string): NpcTestLines | undefined {
    return this.deps.npcDefinitions.tryGet(npcId)?.test;
  }

  /** The next paper's number: one more than any written (kept or thrown away). */
  private nextNumber(): number {
    let most = 0;
    for (const p of this.deps.state.progression.papers) most = Math.max(most, p.number);
    for (const s of this.deps.state.progression.scores) most = Math.max(most, s.paper);
    for (const p of this.pending.values()) most = Math.max(most, p.number);
    return most + 1;
  }
}
