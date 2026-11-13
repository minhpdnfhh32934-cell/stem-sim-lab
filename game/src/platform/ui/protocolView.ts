import type { Texts } from '../../core/i18n';
import type { ProcedureView } from '../../gameplay/procedure/ProcedureSystem';
import { el, svg } from './dom';

/** A step of the protocol as the player reads it; never shown by colour alone. */
export type StepState = 'done' | 'current' | 'pending' | 'locked';

/** One row of the protocol: a stage of the procedure, or the entrance it leads to. */
export interface ProtocolRow {
  readonly label: string;
  readonly state: StepState;
  /** Steps of a stage done and in all ("2/9"), shown on the current stage. */
  readonly progress: string | null;
}

/**
 * The procedure as rows: each stage done (every step of it done), current (it holds the next
 * step) or pending; then the entrance — locked until every step is done and the equipment worn,
 * current once it is open, done once walked through. Pure: the HUD draws what this returns.
 */
export function protocolRows(view: ProcedureView, entrance: string, texts: Texts): ProtocolRow[] {
  const { definition: p, completed, step, status } = view;
  const rows: ProtocolRow[] = p.stages.map((stage) => {
    let total = 0;
    let done = 0;
    p.steps.forEach((s, i) => {
      if (s.stage !== stage.id) return;
      total++;
      if (i < completed) done++;
    });
    const state: StepState =
      done === total ? 'done' : step?.stage === stage.id ? 'current' : 'pending';
    return {
      label: texts.of(stage, 'label'),
      state,
      progress: state === 'current' && total > 1 ? `${done + 1}/${total}` : null,
    };
  });
  rows.push({
    label: entrance,
    state: status === 'entered' ? 'done' : status === 'ready' ? 'current' : 'locked',
    progress: null,
  });
  return rows;
}

/** What a state is called for a screen reader (the marker and the type show it on screen). */
export function stateName(state: StepState, texts: Texts): string {
  switch (state) {
    case 'done':
      return texts.ui('protocol.done', 'done');
    case 'current':
      return texts.ui('protocol.current', 'current');
    case 'pending':
      return texts.ui('protocol.pending', 'not started');
    case 'locked':
      return texts.ui('protocol.locked', 'locked');
  }
}

/** The marker of a state: a check, a ring with a dot, an empty ring, a padlock (16 px). */
export function marker(state: StepState): SVGSVGElement {
  const icon = svg('svg', { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true' });
  icon.classList.add('protocol-marker');
  switch (state) {
    case 'done':
      icon.append(
        svg('circle', { cx: 8, cy: 8, r: 7, fill: 'currentColor' }),
        svg('path', {
          d: 'M4.8 8.3 7 10.4l4.3-4.6',
          fill: 'none',
          stroke: 'var(--marker-ink)',
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      );
      break;
    case 'current':
      icon.append(
        svg('circle', {
          cx: 8,
          cy: 8,
          r: 6.25,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.5,
        }),
        svg('circle', { cx: 8, cy: 8, r: 3, fill: 'currentColor' }),
      );
      break;
    case 'pending':
      icon.append(
        svg('circle', {
          cx: 8,
          cy: 8,
          r: 6.25,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.5,
        }),
      );
      break;
    case 'locked':
      icon.append(
        svg('path', {
          d: 'M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.5,
        }),
        svg('rect', { x: 4, y: 7, width: 8, height: 6.5, rx: 1.2, fill: 'currentColor' }),
      );
      break;
  }
  return icon;
}

/** A row of the list: marker, number, label, the stage's progress, its state for screen readers. */
export function protocolItem(row: ProtocolRow, index: number, texts: Texts): HTMLLIElement {
  const item = el('li', 'protocol-step');
  item.dataset.state = row.state;
  const label = el('span', 'protocol-label');
  label.append(el('span', 'protocol-index', String(index + 1).padStart(2, '0')), row.label);
  item.append(
    marker(row.state),
    label,
    el('span', 'protocol-progress', row.progress ?? ''),
    el('span', 'sr-only', ` — ${stateName(row.state, texts)}`),
  );
  return item;
}
