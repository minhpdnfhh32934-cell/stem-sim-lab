import type { Texts } from '../../../core/i18n';
import type { Stage } from './state';

/** The workspace's interface text in the current language; rebuilt when the language changes. */
export function workspaceLabels(t: Texts) {
  const stages: Record<Stage, string> = {
    setup: t.ui('workspace.stage.setup', 'Setup'),
    run: t.ui('workspace.stage.run', 'Run'),
    observe: t.ui('workspace.stage.observe', 'Observe'),
    measure: t.ui('workspace.stage.measure', 'Measure'),
    analyse: t.ui('workspace.stage.analyse', 'Analyse'),
  };
  return {
    stages,
    exit: t.ui('workspace.exit', 'Back to lab'),
    exitHint: t.ui('workspace.exitHint', 'Esc'),
    here: t.ui('workspace.here', 'Where you are'),
    progress: t.ui('workspace.progress', 'Progress'),
    brief: t.ui('workspace.brief', 'Brief'),
    briefTitle: t.ui('workspace.briefTitle', 'Experiment brief'),
    briefSetup: t.ui('workspace.briefSetup', 'Setting up'),
    briefSteps: t.ui('workspace.briefSteps', 'Procedure'),
    close: t.ui('workspace.close', 'Close'),
    library: t.ui('workspace.library', 'Library'),
    materials: t.ui('workspace.materials', 'Materials'),
    equipment: t.ui('workspace.equipment', 'Equipment'),
    libraryHint: t.ui(
      'workspace.libraryHint',
      'Pick an item, then choose the piece it goes on. Esc puts it back.',
    ),
    stage: t.ui('workspace.stage', 'Bench'),
    view: t.ui('workspace.view', 'View'),
    notebook: t.ui('workspace.notebook', 'Notebook'),
    graph: t.ui('workspace.graph', 'Live graph'),
    noGraph: t.ui('workspace.noGraph', 'Nothing to plot yet: press RUN.'),
    runs: t.ui('workspace.runs', 'Runs'),
    noRuns: t.ui('workspace.noRuns', 'No runs yet.'),
    results: t.ui('workspace.results', 'Results · Analyse'),
    resultsTitle: t.ui('workspace.resultsTitle', 'Results and analysis'),
    hideCard: t.ui('workspace.hideCard', 'Hide'),
    showCard: t.ui('workspace.showCard', 'Show'),
    pieces: t.ui('workspace.pieces', 'Apparatus'),
    heroFirst: t.ui('workspace.heroFirst', 'Prep tile'),
    heroSecond: t.ui('workspace.heroSecond', 'Eyepiece'),
    bar: t.ui('workspace.bar', 'Run controls'),
    run: t.ui('workspace.run', 'RUN'),
    stop: t.ui('workspace.stop', 'STOP'),
    reset: t.ui('workspace.reset', 'RESET'),
    clear: t.ui('workspace.clear', 'Clear bench'),
    time: (seconds: string) => t.ui('workspace.time', 't = {t} s', { t: seconds }),
    setupCount: (done: number, total: number) =>
      t.ui('workspace.setupCount', 'Setup {done}/{total}', { done, total }),
    controls: t.ui('workspace.controls', 'Controls'),
    fixed: t.ui('workspace.fixed', 'Fixed in this model'),
    readings: t.ui('workspace.readings', 'Readings'),
    noValue: t.ui('workspace.noValue', 'not measured yet'),
    pending: t.ui('workspace.pending', 'Set; applies to the next run.'),
    state: {
      idle: t.ui('workspace.state.idle', 'Not ready'),
      configured: t.ui('workspace.state.configured', 'Ready'),
      running: t.ui('workspace.state.running', 'Running'),
      stopped: t.ui('workspace.state.stopped', 'Stopped'),
      completed: t.ui('workspace.state.completed', 'Completed'),
    },
    started: t.ui('workspace.started', 'Run started.'),
    finished: t.ui('workspace.finished', 'Run completed.'),
    halted: t.ui('workspace.halted', 'Run stopped.'),
    placeholder: (piece: string) =>
      t.ui('workspace.placeholder', '{piece}: no view for this kind of apparatus yet.', { piece }),
    holding: (item: string) =>
      t.ui('workspace.holding', 'Placing {item}: choose a piece (Esc cancels).', { item }),
    notThere: (item: string, piece: string) =>
      t.ui('workspace.notThere', '{item} does not go on {piece}.', { item, piece }),
    placed: (item: string, piece: string) =>
      t.ui('workspace.placed', '{item} placed on {piece}.', { item, piece }),
    instrument: (name: string, text: string, unit: string, u: string, bound: string) =>
      t.ui(
        'workspace.instrument',
        '{name}: {text} {unit} (u = {u} from the resolution alone; at most ± {bound})',
        { name, text, unit, u, bound },
      ),
    dialog: (experiment: string) =>
      t.ui('workspace.dialog', 'Workspace: {experiment}', { experiment }),
  };
}

export type WorkspaceLabels = ReturnType<typeof workspaceLabels>;
