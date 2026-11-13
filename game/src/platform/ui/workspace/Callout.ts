import type { Texts } from '../../../core/i18n';
import type { StationView } from '../../../gameplay/experiment/StationSystem';
import type { ExperimentParameter, WorkspacePiece } from '../../../simulation/experiment';
import { formatUncertainty, readings } from '../../../simulation/measurement';
import { el, formatQuantity } from '../dom';
import { type WorkspaceLabels, workspaceLabels } from './labels';
import type { WorkspaceController } from './controller';

const NO_VALUE = '—';

interface Control {
  readonly parameter: ExperimentParameter;
  readonly radios: { input: HTMLInputElement; value: number }[];
  readonly steppers: HTMLButtonElement[];
  readonly value: HTMLElement;
  readonly reason: HTMLElement;
  readonly pending: HTMLElement;
}

interface Readout {
  readonly node: HTMLElement;
  readonly read: (view: StationView) => string;
  text: string;
}

/**
 * The controls of one piece, shown beside it (docked at the side below 1280 px wide): the
 * parameters it owns as preset radios (arrow keys step them, as the dial does), the shown inputs
 * fixed in the model, its readouts and its instrument's reading. A control only sends a command;
 * the reason the station would refuse it is shown beside it while there is one. The structure is
 * built when a piece is selected; afterwards `refresh` only changes values that changed, so the
 * focus stays where it is.
 */
export class Callout {
  readonly root = el('section', 'ws-callout hidden');
  private readonly heading = el('h3', 'ws-callout-title');
  private readonly close = el('button', 'ws-callout-close');
  private readonly body = el('div', 'ws-callout-body');
  private controls: Control[] = [];
  private readouts: Readout[] = [];
  private piece: WorkspacePiece | null = null;
  private labels: WorkspaceLabels;

  constructor(
    private readonly texts: Texts,
    private readonly controller: WorkspaceController,
    onClose: () => void,
  ) {
    this.labels = workspaceLabels(texts);
    this.close.type = 'button';
    this.close.addEventListener('click', onClose);
    this.root.append(el('div', 'ws-callout-head'), this.body);
    this.root.firstElementChild?.append(this.heading, this.close);
    this.root.addEventListener('keydown', (event) => this.trap(event));
  }

  get open(): boolean {
    return this.piece !== null;
  }

  /** Builds the callout of `piece` and shows it; null puts it away. */
  show(piece: WorkspacePiece | null, view: StationView | null): void {
    this.piece = piece;
    this.root.classList.toggle('hidden', piece === null || view === null);
    if (piece === null || view === null) return;
    const t = this.texts;
    this.labels = workspaceLabels(t);
    this.root.setAttribute('role', 'group');
    this.heading.textContent = t.of(piece, 'label');
    this.root.setAttribute('aria-label', `${this.labels.controls}: ${t.of(piece, 'label')}`);
    this.close.textContent = this.labels.close;
    this.controls = [];
    this.readouts = [];
    const { definition } = view;
    const sections: HTMLElement[] = [];

    for (const id of piece.owns) {
      const parameter = view.session.parameter(id);
      if (parameter) sections.push(this.control(parameter));
    }
    const fixed = el('dl', 'ws-fixed');
    const readingList = el('dl', 'ws-readings');
    for (const shown of piece.shows) {
      if ('input' in shown) {
        const spec = definition.inputs[shown.input];
        const value = definition.initialConditions[shown.input];
        // An input the student must work out is never listed (`hidden`), nor one kept off the desk.
        if (!spec || value === undefined || spec.desk === false || spec.hidden === true) continue;
        fixed.append(
          el('dt', undefined, spec.symbol),
          el('dd', undefined, formatQuantity(value, spec.unit)),
        );
      } else {
        const entry = this.readout(shown, view);
        if (entry) readingList.append(entry.label, entry.node);
      }
    }
    if (fixed.childElementCount > 0) {
      sections.push(el('h4', undefined, this.labels.fixed), fixed);
    }
    if (readingList.childElementCount > 0) {
      sections.push(el('h4', undefined, this.labels.readings), readingList);
    }
    this.body.replaceChildren(...sections);
    this.refresh(view);
  }

  /** Focus goes to the first control (or Close), as the callout opens. */
  focusFirst(): void {
    (
      this.body.querySelector<HTMLElement>('input:checked, input:not(:disabled), button') ??
      this.close
    ).focus();
  }

  /** Updates what changed: selected presets, refusal reasons and the readouts (text only if different). */
  refresh(view: StationView): void {
    if (this.piece === null) return;
    const { session } = view;
    const running = session.run?.inputs;
    for (const c of this.controls) {
      const value = session.parameters[c.parameter.id] ?? Number.NaN;
      const why = this.controller.refusal('set', c.parameter.id, value);
      for (const r of c.radios) {
        const checked = Math.abs(r.value - value) < 1e-9;
        if (r.input.checked !== checked) r.input.checked = checked;
        if (r.input.disabled !== (why !== null)) r.input.disabled = why !== null;
      }
      for (const b of c.steppers) {
        const off =
          this.controller.refusal('adjust', c.parameter.id, Number(b.dataset.direction)) !== null;
        if (b.disabled !== off) b.disabled = off;
      }
      const text = formatQuantity(value, c.parameter.unit);
      if (c.value.textContent !== text) c.value.textContent = text;
      const reason = why ?? '';
      if (c.reason.textContent !== reason) c.reason.textContent = reason;
      const differs = running !== undefined && running[c.parameter.id] !== value && why === null;
      const pending = differs ? this.labels.pending : '';
      if (c.pending.textContent !== pending) c.pending.textContent = pending;
    }
    for (const r of this.readouts) {
      const text = r.read(view);
      if (text !== r.text) {
        r.text = text;
        r.node.textContent = text;
      }
    }
  }

  // ---- building ------------------------------------------------------------------------------

  private control(parameter: ExperimentParameter): HTMLElement {
    const t = this.texts;
    const group = el('fieldset', 'ws-param');
    group.setAttribute('role', parameter.presets.length > 0 ? 'radiogroup' : 'group');
    const name = parameter.symbol
      ? `${t.of(parameter, 'label')} (${parameter.symbol})`
      : t.of(parameter, 'label');
    const value = el('output', 'ws-param-value');
    const reason = el('p', 'ws-reason');
    const pending = el('p', 'ws-pending');
    const legend = el('legend', undefined, name);
    group.append(legend);
    const control: Control = { parameter, radios: [], steppers: [], value, reason, pending };
    if (parameter.presets.length > 0) {
      const chips = el('div', 'ws-chips');
      for (const preset of parameter.presets) {
        const label = el('label', 'ws-chip');
        const input = el('input');
        input.type = 'radio';
        input.name = `ws-${parameter.id}`;
        input.addEventListener('change', () => {
          if (input.checked)
            this.controller.send({ command: 'set', parameter: parameter.id, value: preset.value });
        });
        label.append(input, el('span', undefined, t.of(preset, 'label')));
        chips.append(label);
        control.radios.push({ input, value: preset.value });
      }
      group.append(chips);
    } else {
      const row = el('div', 'ws-stepper');
      for (const direction of [-1, 1] as const) {
        const button = el('button', 'ws-step', direction > 0 ? '+' : '−');
        button.type = 'button';
        button.dataset.direction = String(direction);
        button.setAttribute('aria-label', `${name} ${direction > 0 ? '+' : '−'}`);
        button.addEventListener('click', () =>
          this.controller.send({ command: 'adjust', parameter: parameter.id, direction }),
        );
        control.steppers.push(button);
        row.append(button);
        if (direction < 0) row.append(value);
      }
      group.append(row);
    }
    if (parameter.presets.length > 0) group.append(value);
    group.append(reason, pending);
    reason.id = `ws-reason-${parameter.id}`;
    group.setAttribute('aria-describedby', reason.id);
    this.controls.push(control);
    return group;
  }

  /** A readout line: what it is called, and a node whose text `refresh` keeps current. */
  private readout(
    shown: WorkspacePiece['shows'][number],
    view: StationView,
  ): { label: HTMLElement; node: HTMLElement } | null {
    const t = this.texts;
    const { definition } = view;
    const none = this.labels.noValue;
    let name: string;
    let read: (v: StationView) => string;
    if ('variable' in shown) {
      const m = definition.measurements.find((x) => x.variable === shown.variable);
      name = m ? (m.symbol ?? t.of(m, 'label')) : shown.variable;
      const unit = m?.unit ?? '';
      read = (v) => {
        const x = v.kind === 'bench' && v.session.run ? v.pose.sample[shown.variable] : undefined;
        return x !== undefined && Number.isFinite(x) ? formatQuantity(x, unit) : NO_VALUE;
      };
    } else if ('result' in shown) {
      const r = definition.results.find((x) => x.id === shown.result);
      if (!r) return null;
      name = r.symbol ?? t.of(r, 'label');
      read = (v) => {
        const x = v.session.run?.status === 'completed' ? v.session.run.results?.[r.id] : undefined;
        return x !== undefined && Number.isFinite(x) ? formatQuantity(x, r.unit) : NO_VALUE;
      };
    } else if ('parameter' in shown) {
      const p = definition.parameters.find((x) => x.id === shown.parameter);
      if (!p) return null;
      name = p.symbol ?? t.of(p, 'label');
      read = (v) =>
        formatQuantity(
          v.session.run?.inputs[p.id] ?? v.session.parameters[p.id] ?? Number.NaN,
          p.unit,
        );
    } else if ('instrument' in shown) {
      const instrument = definition.instruments.find((i) => i.result === shown.instrument);
      // An instrument that reads an answer the student works out is never listed.
      if (!instrument || definition.results.find((x) => x.id === instrument.result)?.answer)
        return null;
      name = t.of(instrument, 'quantity');
      let cached: { id: string; text: string } | null = null;
      read = (v) => {
        const run = v.session.run;
        if (!run || run.status !== 'completed') return none;
        if (cached?.id === run.runId) return cached.text;
        const r = readings(definition, run).find((x) => x.result === instrument.result);
        const text = r
          ? this.labels.instrument(
              t.of(instrument, 'name'),
              r.text,
              r.unit,
              formatUncertainty(r.uncertainty),
              formatUncertainty(r.bound),
            )
          : none;
        cached = { id: run.runId, text };
        return text;
      };
    } else {
      return null;
    }
    const node = el('dd');
    const text = read(view);
    node.textContent = text;
    this.readouts.push({ node, read, text });
    return { label: el('dt', undefined, name), node };
  }

  /** Tab stays inside the callout while it is open. */
  private trap(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = [...this.root.querySelectorAll<HTMLElement>('input:not(:disabled), button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const at = document.activeElement;
    if (event.shiftKey && at === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && at === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
