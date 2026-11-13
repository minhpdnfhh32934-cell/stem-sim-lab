import { describeError } from '../../core/SystemRunner';
import {
  type CatalogExperiment,
  routeBetween,
  type RouteStep,
  subjectCatalog,
} from '../../game/catalog';
import type { Game } from '../../game/Game';
import type { SceneDefinition } from '../../world/definitions';
import { el } from './dom';

/** Gives an element its text now and again whenever the language changes (MainMenu's `show`). */
type Show = <T extends HTMLElement>(element: T, text: () => string) => T;

/**
 * The experiment catalog, a page of the main menu in place of its panel: by subject (named by
 * its laboratory), topic and experiment, all from the content (`subjectCatalog`). Each experiment
 * shows its name, whether the saved game has run it to its natural end, where it is played and
 * what it teaches; opened, how to run it (its procedure), the way there from a new game and from
 * the saved game, and the model's notes (collapsed). Directions only: browsing it moves nothing
 * and starts nothing — New game and Continue do. A planned laboratory says it has no experiments
 * yet; nothing is invented to fill a gap. The experiments are the lab pack's, loaded the first time
 * the catalog opens: until then it says so, or why they could not be loaded, with Try again.
 */
export class ExperimentCatalog {
  readonly root = el('section', 'menu-catalog hidden');
  readonly title = el('h2', 'menu-catalog-title');
  private readonly back = el('button', 'menu-button menu-back');
  private readonly head = el('div', 'menu-catalog-head');
  /** In place of the list until it is built: loading, or the problem and Try again. */
  private readonly status = el('div', 'menu-catalog-status');
  private readonly loading = el('p');
  private readonly problem = el('p');
  private readonly retry = el('button', 'menu-button menu-back');
  /** Whether the list is built: once, when the experiments have loaded. */
  private listed = false;
  /** The world scene Continue would load, read when the catalog opens; null: no usable save. */
  private savedScene: string | null = null;
  /** The experiments that save has run to their natural end at least once. */
  private savedRuns: ReadonlySet<string> = new Set();
  /** The lines of directions from the saved game, hidden while there is none. */
  private readonly savedWays: HTMLElement[] = [];
  /** Each experiment's mark, with the experiment it marks. */
  private readonly marks: [HTMLElement, string][] = [];

  constructor(
    private readonly game: Game,
    private readonly show: Show,
    onBack: () => void,
    /** Gives every text of the menu again (MainMenu's), once what they show has been read. */
    private readonly render: () => void,
  ) {
    const t = game.texts;
    this.title.id = 'menu-catalog-title';
    this.title.tabIndex = -1; // focused on opening, so it is read first
    this.root.setAttribute('aria-labelledby', this.title.id);
    this.back.type = 'button';
    this.back.addEventListener('click', onBack);
    show(this.back, () => t.ui('catalog.back', 'Back to the main menu'));
    show(this.title, () => t.ui('menu.catalog', 'Experiment catalog'));
    show(this.loading, () => t.ui('catalog.loading', 'Loading the experiments…'));
    this.retry.type = 'button';
    show(this.retry, () => t.ui('catalog.retry', 'Try again'));
    // The button goes while it loads: the focus follows to what is there after.
    this.retry.addEventListener('click', () => {
      void this.refresh().then(() => (this.retry.isConnected ? this.retry : this.title).focus());
    });
    this.status.setAttribute('role', 'status');
    this.head.append(this.back, this.title);
    this.root.append(this.head, this.status);
  }

  get open(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /**
   * Reads the saved game again — its scene and its runs — once the experiments are there (loaded
   * the first time, saying so meanwhile, or why they could not be, with Try again: the game
   * loads them again), lists them the first time, then gives the texts.
   */
  async refresh(): Promise<void> {
    if (!this.listed) {
      this.root.setAttribute('aria-busy', 'true');
      this.status.replaceChildren(this.loading);
    }
    try {
      this.savedScene = this.game.savedScene();
      this.savedRuns = await this.game.savedCompletedExperiments(); // loads the experiments
      if (!this.listed) this.list();
    } catch (error) {
      this.problem.textContent = describeError(error); // already in the language of the moment
      this.status.replaceChildren(this.problem, this.retry);
    }
    for (const way of this.savedWays) way.classList.toggle('hidden', this.savedScene === null);
    for (const [mark, id] of this.marks) mark.dataset.done = String(this.savedRuns.has(id));
    this.root.setAttribute('aria-busy', 'false');
    this.render();
  }

  /** The subjects, topics and experiments, from the content (the lab pack's now loaded), once. */
  private list(): void {
    const { content, texts: t } = this.game;
    const show = this.show;
    const subjects = subjectCatalog(content);
    const total = subjects.flatMap((s) => s.topics.flatMap((topic) => topic.experiments)).length;
    const progress = show(el('p', 'menu-catalog-progress'), () =>
      this.savedScene === null
        ? t.ui('catalog.noSave', 'No saved game yet: an experiment run to its end is marked here.')
        : t.ui('catalog.saved', 'Your saved game: {done} of {total} experiments run to the end', {
            done: [...this.savedRuns].length,
            total,
          }),
    );
    this.head.append(progress);
    this.status.remove();

    for (const { laboratory, topics } of subjects) {
      const subject = el('section', 'menu-subject');
      subject.append(show(el('h3'), () => t.of(laboratory, 'displayName')));
      if (topics.length === 0) {
        subject.append(
          show(el('p', 'menu-planned'), () => t.ui('catalog.planned', 'No experiments yet')),
        );
      }
      for (const { topic, experiments } of topics) {
        const list = el('ul', 'menu-catalog-list');
        for (const entry of experiments) list.append(this.item(entry));
        subject.append(
          show(el('h4'), () => t.of(topic, 'name')),
          list,
        );
      }
      this.root.append(subject);
    }
    this.listed = true; // only now: a failure while building leaves "Try again" able to rebuild
  }

  /** One experiment: name, mark, place and objective; opened, its steps, ways and notes. */
  private item({ experiment, places }: CatalogExperiment): HTMLLIElement {
    const { config, texts: t } = this.game;
    const show = this.show;
    const item = el('li', 'menu-catalog-item');
    item.dataset.experiment = experiment.id;

    const mark = show(el('span', 'menu-run'), () =>
      // Only that a run reached its natural end: not that the experiment was learned.
      this.savedRuns.has(experiment.id)
        ? t.ui('catalog.done', 'Run completed')
        : t.ui('catalog.notDone', 'Not yet run to the end'),
    );
    mark.dataset.done = 'false';
    this.marks.push([mark, experiment.id]);
    const line = el('div', 'menu-catalog-line');
    line.append(
      show(el('span', 'menu-experiment'), () => t.of(experiment, 'name')),
      mark,
    );

    const place = show(el('p', 'menu-place'), () => {
      if (places.length === 0) {
        return t.ui('catalog.noStation', 'No station yet: it cannot be played');
      }
      // The scene, and the room in it unless it bears the same name (the lab's main room).
      const where = places.map(({ scene, room }) =>
        [...new Set([t.of(scene, 'displayName'), t.of(room, 'displayName')])].join(' · '),
      );
      return t.ui('catalog.place', 'Played in {place}', { place: where.join('; ') });
    });
    const objective = show(el('p', 'menu-objective'), () =>
      experiment.description
        ? t.of(experiment, 'description')
        : t.ui('catalog.noObjective', 'No learning objective written yet'),
    );

    const more = el('details', 'menu-more');
    more.append(
      show(el('summary'), () => t.ui('catalog.more', 'How to run it and how to get there')),
    );
    more.append(show(el('h5'), () => t.ui('catalog.steps', 'How to run it')));
    if (experiment.procedure.length > 0) {
      const steps = el('ol', 'menu-steps');
      for (const step of experiment.procedure) {
        steps.append(show(el('li'), () => t.of(step, 'instruction')));
      }
      more.append(steps);
    } else {
      more.append(show(el('p'), () => t.ui('catalog.noSteps', 'No steps written yet')));
    }
    const scenes = [...new Map(places.map(({ scene }) => [scene.id, scene])).values()];
    if (scenes.length > 0) {
      more.append(show(el('h5'), () => t.ui('catalog.where', 'Getting there')));
      for (const scene of scenes) more.append(...this.ways(scene, config.game.newGameScene));
    }
    if (experiment.note) {
      const model = el('details', 'menu-model');
      model.append(
        show(el('summary'), () => t.ui('catalog.model', 'About the model')),
        show(el('p'), () => t.of(experiment, 'note')),
      );
      more.append(model);
    }
    item.append(line, place, objective, more);
    return item;
  }

  /** The way to `scene` from a new game, and from the saved game (hidden while there is none). */
  private ways(scene: SceneDefinition, newGameScene: string): HTMLElement[] {
    const { content, texts: t } = this.game;
    const name = () => t.of(scene, 'displayName');
    const steps = (route: RouteStep[]) =>
      route
        .map((step) =>
          step.kind === 'scene' ? t.of(step.scene, 'displayName') : t.of(step.procedure, 'name'),
        )
        .join(' → ');
    const route = routeBetween(content, newGameScene, scene.id);
    const fromNewGame = this.show(el('p', 'menu-route'), () =>
      route
        ? t.ui('catalog.route', 'From a new game: {steps}', { steps: steps(route) })
        : t.ui('catalog.noRoute', 'No way to {scene} yet', { scene: name() }),
    );
    const fromSave = this.show(el('p', 'menu-saved-route hidden'), () => {
      const start = this.savedScene;
      if (start === null) return '';
      if (start === scene.id) {
        return t.ui('catalog.savedHere', 'From your saved game: you are already in {scene}', {
          scene: name(),
        });
      }
      const path = routeBetween(content, start, scene.id);
      return path
        ? t.ui('catalog.savedRoute', 'From your saved game: {steps}', { steps: steps(path) })
        : t.ui('catalog.noRoute', 'No way to {scene} yet', { scene: name() });
    });
    this.savedWays.push(fromSave);
    return [fromNewGame, fromSave];
  }
}
