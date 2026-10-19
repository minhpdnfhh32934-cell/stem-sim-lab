import { FlaskConical, Play, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fromSI, toSI } from '@/core/units';
import { useProgressStore } from '@/learn/progressStore';
import { choiceLabel, choiceText } from '@/learn/poeLabels';
import { fmtQty } from '@/physics/common/tex';
import type { ParamDef, PhysicsScene } from '@/physics/types';
import { ScienceCard } from '@/science-card/ScienceCard';
import { XYChart } from '@/ui/charts/XYChart';
import { Skeleton } from '@/ui/Skeleton';
import { cx } from '@/ui/cx';
import {
  engineEvidence,
  goTo,
  withEngine,
  withInputs,
  withPrediction,
  type EngineEvidence,
  type EngineQuantity,
} from '../session';
import type { StepProps } from '../flow/types';
import {
  conditionParams,
  controlRange,
  maxCheckGap,
  physicsOf,
  toEvidence,
  verdictFor,
} from './comparison';
import { openConditionInLab } from './openInLab';
import { getComparison, useComparison, useRunGravity, useScene } from './usePhysics';

function Loading({ failed }: { failed: boolean }) {
  const t = useT();
  return failed ? (
    <p className="studio-error" role="alert">
      {t('studio.physics.loadFailed')}
    </p>
  ) : (
    <Skeleton label={t('stage.loading')} variant="lines" />
  );
}

function paramDef(scene: PhysicsScene, key: string): ParamDef | undefined {
  return scene.params.find((d) => d.key === key);
}

/* ---------------- Predict ---------------- */

export function Predict({ scenario, session, update }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const ctx = physicsOf(scenario);
  const { scene, failed } = useScene(ctx?.b.scene ?? '');
  if (!ctx) return null;
  if (!scene) return <Loading failed={failed} />;
  const { poe } = ctx;
  const locked = session.predictionLocked;
  const def = paramDef(scene, poe.param);
  return (
    <div className="studio-stack">
      <p className="studio-task">{L(poe.question)}</p>
      <p className="muted">
        {t('studio.physics.conditions', {
          param: def ? L(def.label) : poe.param,
          factor: poe.factor,
        })}
      </p>
      <div
        className="studio-choices"
        role="radiogroup"
        aria-label={t('studio.physics.predictLabel')}
      >
        {poe.choices.map((c, i) => {
          const label = choiceLabel(t, locale, c);
          const checked = session.prediction?.choice === String(i);
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={locked}
              className={cx('studio-choice', checked && 'is-checked')}
              onClick={() => {
                update((s) =>
                  withPrediction(s, {
                    choice: String(i),
                    label,
                    text: choiceText(c),
                    at: Date.now(),
                  }),
                );
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {locked && <p className="muted small">{t('studio.physics.locked')}</p>}
    </div>
  );
}

/* ---------------- Interact ---------------- */

function ControlSlider({
  def,
  range,
  value,
  onChange,
}: {
  def: ParamDef;
  range: [number, number];
  value: number;
  onChange: (si: number) => void;
}) {
  const id = useId();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const unit = def.unit ?? '1';
  return (
    <div className="studio-control">
      <label htmlFor={id}>
        {L(def.label)}: <strong className="mono">{fmtQty(locale, value, unit)}</strong>
      </label>
      <input
        id={id}
        type="range"
        min={fromSI(range[0], unit)}
        max={fromSI(range[1], unit)}
        step={def.step ?? 'any'}
        value={fromSI(value, unit)}
        onChange={(e) => {
          onChange(toSI(Number(e.target.value), unit));
        }}
      />
    </div>
  );
}

export function Interact({ scenario, session, update }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const g = useSettingsStore((s) => s.defaultGravity);
  const ctx = physicsOf(scenario);
  const { scene, failed } = useScene(ctx?.b.scene ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ctx) return null;
  if (!scene) return <Loading failed={failed} />;
  const { b, poe } = ctx;
  const { A, B } = conditionParams(scene, scenario, b, poe, session.inputs, g);
  const def = paramDef(scene, poe.param);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await getComparison(scene, scenario, session.inputs, g);
      if (!r.ok) {
        setError(r.reason);
        return;
      }
      const ev = toEvidence(scene, scenario, r.cmp, Date.now());
      if (!ev) {
        setError('unfinished');
        return;
      }
      const labelOf = (i: number) => {
        const c = poe.choices[i];
        return c ? choiceText(c) : null;
      };
      const verdict = verdictFor(r.cmp.outcome, session.prediction, labelOf);
      update((s) =>
        goTo(
          scenario,
          withEngine(s, ev, verdictFor(r.cmp.outcome, s.prediction, labelOf)),
          'observe',
        ),
      );
      if (session.prediction && verdict.match !== null) {
        useProgressStore.getState().recordPrediction(poe.id, verdict.match);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="studio-stack">
      {b.controls.map((key) => {
        const d = paramDef(scene, key);
        if (!d) return null;
        return (
          <ControlSlider
            key={key}
            def={d}
            range={controlRange(scene, poe, key)}
            value={A[key] ?? 0}
            onChange={(v) => {
              update((s) => withInputs(s, { ...s.inputs, [key]: v }, Date.now()));
            }}
          />
        );
      })}
      <div className="studio-conditions">
        {(['A', 'B'] as const).map((id) => {
          const p = id === 'A' ? A : B;
          return (
            <div key={id} className="studio-condition" data-condition={id}>
              <strong>{t('studio.physics.condition', { id })}</strong>
              <span>
                {def
                  ? `${L(def.label)} = ${fmtQty(locale, p[poe.param] ?? 0, def.unit ?? '1')}`
                  : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="studio-actions">
        <button
          type="button"
          className="btn btn--accent"
          disabled={busy}
          onClick={() => {
            void run();
          }}
        >
          <Play size={16} aria-hidden="true" />
          {busy ? t('studio.physics.running') : t('studio.physics.run')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            update((s) => withInputs(s, { ...scenario.initial }, Date.now()));
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t('studio.physics.reset')}
        </button>
      </div>
      {error && (
        <p className="studio-error" role="alert">
          {t(`studio.physics.errors.${error as 'invalid' | 'unfinished' | 'binding'}`)}
        </p>
      )}
    </div>
  );
}

/* ---------------- Observe ---------------- */

function rowsOf(ev: EngineEvidence) {
  const ids = [...new Set(ev.quantities.filter((q) => q.condition !== 'B/A').map((q) => q.id))];
  const at = (id: string, c: string) => ev.quantities.find((q) => q.id === id && q.condition === c);
  return { ids, at, ratio: ev.quantities.find((q) => q.condition === 'B/A') };
}

function MeasureTable({ ev }: { ev: EngineEvidence }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { ids, at, ratio } = rowsOf(ev);
  const inputs = ev.conditions[0]?.inputs ?? [];
  const inputAt = (id: string, c: string) =>
    ev.conditions.find((x) => x.id === c)?.inputs.find((q) => q.id === id);
  const cell = (q: EngineQuantity | undefined) => (q ? fmtQty(locale, q.value, q.unit) : '—');
  return (
    <table className="studio-table">
      <caption>{t('studio.physics.tableCaption', { model: ev.model })}</caption>
      <thead>
        <tr>
          <th scope="col">{t('studio.physics.col.quantity')}</th>
          <th scope="col">{t('studio.physics.condition', { id: 'A' })}</th>
          <th scope="col">{t('studio.physics.condition', { id: 'B' })}</th>
        </tr>
      </thead>
      <tbody>
        {inputs.map((q) => (
          <tr key={`in-${q.id}`} className="studio-table__input">
            <th scope="row">
              {L(q.label)} <span className="muted small">({t('studio.physics.input')})</span>
            </th>
            <td className="mono">{cell(inputAt(q.id, 'A'))}</td>
            <td className="mono">{cell(inputAt(q.id, 'B'))}</td>
          </tr>
        ))}
        {ids.map((id) => {
          const a = at(id, 'A');
          return (
            <tr key={id}>
              <th scope="row">{a ? L(a.label) : id}</th>
              <td className="mono">{cell(a)}</td>
              <td className="mono">{cell(at(id, 'B'))}</td>
            </tr>
          );
        })}
        {ratio && (
          <tr className="studio-table__ratio">
            <th scope="row">{L(ratio.label)}</th>
            <td className="mono" colSpan={2}>
              {formatNumber(locale, ratio.value, { maximumSignificantDigits: 4 })}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function Observe({ scenario, session }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const ctx = physicsOf(scenario);
  const { scene, failed } = useScene(ctx?.b.scene ?? '');
  const result = useComparison(scene, scenario, session);
  const g = useRunGravity(session);
  const ev = engineEvidence(session)[0];
  if (!ctx) return null;
  if (!ev) return <p className="muted">{t('studio.physics.noRun')}</p>;
  if (!scene) return <Loading failed={failed} />;
  const { b, poe } = ctx;
  const graphDef = scene.graphs.find((gd) => gd.id === b.graph.graph);
  const series = graphDef?.series.find((s) => s.id === b.graph.series);
  const gap = maxCheckGap(ev.quantities);
  const { A } = conditionParams(scene, scenario, b, poe, session.inputs, g);
  return (
    <div className="studio-stack">
      <MeasureTable ev={ev} />
      {advanced && gap !== null && (
        <p className="muted small">
          {t('studio.physics.crossCheck', {
            gap: formatNumber(locale, gap, { style: 'percent', maximumSignificantDigits: 2 }),
          })}
        </p>
      )}
      {result?.ok && graphDef && series ? (
        <figure className="studio-graph">
          <figcaption>
            {L(graphDef.title)} — {L(series.label)}
          </figcaption>
          <XYChart
            x={result.cmp.graph.x}
            series={[
              {
                label: t('studio.physics.condition', { id: 'A' }),
                y: result.cmp.graph.a,
                spanGaps: true,
              },
              {
                label: t('studio.physics.condition', { id: 'B' }),
                y: result.cmp.graph.b,
                spanGaps: true,
                dash: true,
              },
            ]}
            xLabel={t('studio.physics.timeAxis')}
            yLabel={L(graphDef.yLabel)}
            xUnit="s"
            height={220}
            csvName={L(scenario.title)}
          />
        </figure>
      ) : (
        <Skeleton label={t('stage.loading')} variant="lines" />
      )}
      <ScienceCard card={scene.scienceCard(A)} collapsible />
      <div className="studio-actions">
        {(['A', 'B'] as const).map((c) => (
          <button
            key={c}
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              void openConditionInLab(scene, scenario, session.inputs, g, c);
            }}
          >
            <FlaskConical size={16} aria-hidden="true" />
            {t('studio.physics.openInLab', { id: c })}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Conclude facts + sources ---------------- */

export function Facts({ session }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const ev = engineEvidence(session)[0];
  const ratio = ev?.quantities.find((q) => q.condition === 'B/A');
  if (!ev || !ratio) return null;
  return (
    <p className="studio-fact">
      {t('studio.physics.fact', {
        q: L(ratio.label),
        value: formatNumber(locale, ratio.value, { maximumSignificantDigits: 4 }),
        model: ev.model,
      })}
    </p>
  );
}
