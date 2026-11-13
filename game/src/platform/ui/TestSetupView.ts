import { Disposables } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import { subjectCatalog } from '../../game/catalog';
import type { Game } from '../../game/Game';
import type { TestRequest } from '../../gameplay/papers/PaperSystem';
import {
  QUESTION_LEVELS,
  QUESTION_TYPES,
  type QuestionLevel,
  type QuestionType,
} from '../../simulation/questions';
import { el } from './dom';

const COUNTS = [5, 10, 15, 20, 30, 40];

/**
 * The teacher's question "what should the test cover?" answered (Phase Y-5): a form over his line
 * while the conversation's script asks for it (`form: 'test-setup'`) — the simulations with a
 * question bank, by subject and topic (any subjects together), how many questions, which kinds
 * (choice, true/false) and which levels (THPT's four). It says how many questions the choice can
 * have before he is asked; "write it" hands the choice to `papers.request`, "not now" ends the
 * conversation. The choice is kept for the next test. It only asks the PaperSystem.
 */
export class TestSetupView implements GameSystem {
  readonly id = 'test-setup-view';
  private readonly root = el('section', 'test-setup hidden');
  private readonly subscriptions = new Disposables();
  private open = false;
  private npcId = '';
  private readonly experiments = new Set<string>();
  private count = 10;
  private readonly types = new Set<QuestionType>(QUESTION_TYPES);
  private readonly levels = new Set<QuestionLevel>(QUESTION_LEVELS);
  private readonly available = el('p', 'test-setup-available');
  private readonly write = el('button', 'test-setup-write');

  constructor(
    private readonly parent: HTMLElement,
    private readonly game: Game,
  ) {}

  get shown(): boolean {
    return this.open;
  }

  init(): void {
    const { events } = this.game;
    this.root.setAttribute('aria-label', 'test setup');
    this.parent.append(this.root);
    const s = this.subscriptions;
    const check = () => this.check();
    s.add(events.subscribe('ConversationOpened', check));
    s.add(events.subscribe('ConversationChanged', check));
    s.add(events.subscribe('ConversationClosed', check));
    s.add(events.subscribe('LanguageChanged', () => this.open && this.render()));
  }

  update(): void {
    // Drawn on events; nothing per frame.
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.root.remove();
  }

  /** Shown while the teacher's line asks for it. */
  private check(): void {
    const script = this.game.npcs.script;
    const conversation = this.game.state.session.conversation ?? null;
    const wanted = script?.form === 'test-setup' && conversation !== null;
    if (wanted === this.open) return;
    this.open = wanted;
    this.npcId = conversation?.npcId ?? '';
    this.root.classList.toggle('hidden', !wanted);
    if (!wanted) {
      this.root.replaceChildren();
      return;
    }
    this.render();
    if (!this.game.papers.banksReady) {
      this.game
        .loadQuestions()
        .then(() => this.open && this.render())
        .catch(() => this.open && this.render());
    }
  }

  private render(): void {
    const t = this.game.texts;
    const papers = this.game.papers;
    const title = el('h2', 'test-setup-title', t.ui('testSetup.title', 'Your test'));
    if (!papers.banksReady) {
      this.root.replaceChildren(
        title,
        el('p', 'test-setup-loading', t.ui('testSetup.loading', 'Getting the questions…')),
      );
      return;
    }
    const subjects = el('div', 'test-setup-subjects');
    const listed = new Set<string>();
    for (const { laboratory, topics } of subjectCatalog(this.game.content)) {
      const ids: string[] = [];
      const block = el('fieldset', 'test-setup-subject');
      const legend = el('legend');
      legend.append(el('span', undefined, t.of(laboratory, 'displayName')));
      const boxes: HTMLInputElement[] = [];
      for (const { topic, experiments } of topics) {
        const rows = experiments
          .map(({ experiment }) => experiment)
          .filter((e) => papers.bank(e.id) !== null && !listed.has(e.id));
        if (rows.length === 0) continue;
        const group = el('div', 'test-setup-topic');
        group.append(el('h4', undefined, t.of(topic, 'name')));
        for (const experiment of rows) {
          listed.add(experiment.id);
          ids.push(experiment.id);
          const box = this.checkbox(
            t.of(experiment, 'name'),
            this.experiments.has(experiment.id),
            (on) => this.toggle(this.experiments, experiment.id, on),
          );
          box.input.dataset.experiment = experiment.id;
          boxes.push(box.input);
          group.append(box.label);
        }
        block.append(group);
      }
      if (ids.length === 0) continue;
      const all = el('button', 'test-setup-mini', t.ui('testSetup.all', 'All'));
      const none = el('button', 'test-setup-mini', t.ui('testSetup.none', 'None'));
      for (const [button, on] of [
        [all, true],
        [none, false],
      ] as const) {
        button.type = 'button';
        button.addEventListener('click', () => {
          for (const id of ids) this.toggle(this.experiments, id, on);
          for (const box of boxes) box.checked = on;
        });
      }
      legend.append(all, none);
      block.prepend(legend);
      subjects.append(block);
    }

    const count = el('select', 'test-setup-count');
    for (const n of COUNTS) {
      const option = el('option', undefined, String(n));
      option.value = String(n);
      option.selected = n === this.count;
      count.append(option);
    }
    count.addEventListener('change', () => {
      this.count = Number(count.value);
      this.refresh();
    });
    const countLabel = el('label', 'test-setup-field');
    countLabel.append(el('span', undefined, t.ui('testSetup.count', 'Questions')), count);

    const kinds = el('fieldset', 'test-setup-field');
    kinds.append(el('legend', undefined, t.ui('testSetup.types', 'Kinds')));
    const typeNames: Record<QuestionType, string> = {
      choice: t.ui('testSetup.choice', 'Multiple choice'),
      'true-false': t.ui('testSetup.trueFalse', 'True or false'),
    };
    for (const type of QUESTION_TYPES) {
      kinds.append(
        this.checkbox(typeNames[type], this.types.has(type), (on) =>
          this.toggle(this.types, type, on),
        ).label,
      );
    }
    const levels = el('fieldset', 'test-setup-field');
    levels.append(el('legend', undefined, t.ui('testSetup.levels', 'Levels')));
    const levelNames: Record<QuestionLevel, string> = {
      recognise: t.ui('testSetup.recognise', 'Recognise'),
      understand: t.ui('testSetup.understand', 'Understand'),
      apply: t.ui('testSetup.apply', 'Apply'),
      analyse: t.ui('testSetup.analyse', 'Analyse (hardest)'),
    };
    for (const level of QUESTION_LEVELS) {
      levels.append(
        this.checkbox(levelNames[level], this.levels.has(level), (on) =>
          this.toggle(this.levels, level, on),
        ).label,
      );
    }
    const options = el('div', 'test-setup-options');
    options.append(countLabel, kinds, levels);

    const lines = this.game.content.npcs.tryGet(this.npcId)?.test;
    this.write.type = 'button';
    this.write.textContent = lines
      ? t.of(lines.choices.write, 'label')
      : t.ui('testSetup.write', 'Write it');
    this.write.onclick = () => this.ask();
    const cancel = el(
      'button',
      'test-setup-cancel',
      lines ? t.of(lines.choices.cancel, 'label') : t.ui('testSetup.cancel', 'Not now'),
    );
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.game.papers.cancel());
    const actions = el('div', 'test-setup-actions');
    actions.append(this.write, cancel);

    this.root.replaceChildren(title, subjects, options, this.available, actions);
    this.refresh();
  }

  /** The count of questions the choice can have, and whether it can be asked for. */
  private refresh(): void {
    const t = this.game.texts;
    const request = this.request();
    const n = request.experiments.length === 0 ? 0 : this.game.papers.available(request);
    this.available.textContent =
      request.experiments.length === 0
        ? t.ui('testSetup.pick', 'Choose at least one simulation.')
        : n === 0
          ? t.ui('testSetup.nothing', 'No question matches this choice.')
          : n < request.count
            ? t.ui('testSetup.fewer', 'Only {n} questions match: the test will have {n}.', { n })
            : t.ui('testSetup.enough', 'The test will have {n} questions.', { n });
    this.available.classList.toggle('short', n < request.count);
    this.write.disabled = n === 0;
  }

  private ask(): void {
    if (this.write.disabled) return;
    this.game.papers.request(this.npcId, this.request());
  }

  private request(): TestRequest {
    return {
      // In the order of the catalog (the boxes), not of the clicks.
      experiments: [...this.root.querySelectorAll<HTMLInputElement>('input[data-experiment]')]
        .filter((box) => box.checked)
        .map((box) => box.dataset.experiment ?? ''),
      count: this.count,
      types: QUESTION_TYPES.filter((type) => this.types.has(type)),
      levels: QUESTION_LEVELS.filter((level) => this.levels.has(level)),
    };
  }

  private toggle<T>(set: Set<T>, value: T, on: boolean): void {
    if (on) set.add(value);
    else set.delete(value);
    this.refresh();
  }

  private checkbox(
    text: string,
    checked: boolean,
    change: (on: boolean) => void,
  ): { label: HTMLLabelElement; input: HTMLInputElement } {
    const label = el('label', 'test-setup-check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => change(input.checked));
    label.append(input, el('span', undefined, text));
    return { label, input };
  }
}
