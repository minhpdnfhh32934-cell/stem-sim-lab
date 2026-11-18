import { AlertTriangle, Info, Spline } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fromSI, unitLabel } from '@/core/units';
import type { Answer, ParamDef, PhysicsScene } from '@/physics/types';
import { XYChart } from '@/ui/charts/XYChart';
import { EmptyState } from '@/ui/EmptyState';
import { NumberField } from '@/ui/NumberField';
import { useSimStore } from './simStore';
import {
  SWEEP_MAX_STEPS,
  SWEEP_MIN_STEPS,
  runSweep,
  sweepValues,
  sweepable,
  type SweepResult,
} from './sweep';

interface Done {
  result: SweepResult;
  def: ParamDef;
  answer: Answer;
}

/** "Quét tham số" tab (#195 step 5, Advanced): one answer of the lesson against one parameter. */
export function SweepPanel() {
  const t = useT();
  const scene = useSimStore((s) => s.scene);
  if (!scene) {
    return (
      <EmptyState icon={Spline} compact>
        {t('sweep.noScene')}
      </EmptyState>
    );
  }
  // Each lesson has its own sweep: a new lesson starts from a fresh form.
  return <SweepBody key={scene.id} scene={scene} />;
}

function SweepBody({ scene }: { scene: PhysicsScene }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { params, sources, validation } = useSimStore(
    useShallow((s) => ({
      params: s.params,
      sources: s.sources,
      validation: s.validation,
    })),
  );
  const defs = useMemo(() => sweepable(scene, params), [scene, params]);
  const answers = useMemo(() => {
    if (validation.length > 0) return [];
    try {
      return scene.solve(params, locale).answers;
    } catch {
      return [];
    }
  }, [scene, params, validation, locale]);

  const [key, setKey] = useState('');
  const [answerId, setAnswerId] = useState('');
  const [range, setRange] = useState<{ key: string; from: number; to: number } | null>(null);
  const [steps, setSteps] = useState(20);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Leaving the tab or the lesson stops a sweep that is running.
  useEffect(() => {
    const running = abort;
    return () => running.current?.abort();
  }, []);

  const def = defs.find((d) => d.key === key) ?? defs[0];
  const answer = answers.find((a) => a.id === answerId) ?? answers[0];
  if (!def || !answer) {
    return (
      <EmptyState icon={AlertTriangle} compact>
        {t('sweep.nothing')}
      </EmptyState>
    );
  }
  const unit = def.unit ?? '1';
  const from = range?.key === def.key ? range.from : (def.min ?? 0);
  const to = range?.key === def.key ? range.to : (def.max ?? 0);
  const running = progress !== null;
  const values = sweepValues(def, from, to, steps);

  const start = () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setProgress(0);
    void runSweep(scene, params, sources, def, values, answer.id, locale, ctl.signal, setProgress)
      .then((result) => {
        if (result) setDone({ result, def, answer });
      })
      .finally(() => {
        if (abort.current === ctl) setProgress(null);
      });
  };

  return (
    <div className="sweep">
      <p className="solution__note">
        <Info size={14} strokeWidth={1.75} aria-hidden="true" />
        {t('sweep.note')}
      </p>
      <div className="sweep__form">
        <label>
          <span>{t('sweep.param')}</span>
          <select
            value={def.key}
            disabled={running}
            onChange={(e) => {
              setKey(e.target.value);
            }}
          >
            {defs.map((d) => (
              <option key={d.key} value={d.key}>
                {L(d.label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            {t('sweep.from')} ({unitLabel(unit, locale)})
          </span>
          <NumberField
            label={t('sweep.from')}
            value={from}
            step={def.step}
            min={def.min}
            max={def.max}
            onChange={(v) => {
              setRange({ key: def.key, from: v, to });
            }}
          />
        </label>
        <label>
          <span>
            {t('sweep.to')} ({unitLabel(unit, locale)})
          </span>
          <NumberField
            label={t('sweep.to')}
            value={to}
            step={def.step}
            min={def.min}
            max={def.max}
            onChange={(v) => {
              setRange({ key: def.key, from, to: v });
            }}
          />
        </label>
        <label>
          <span>{t('sweep.steps', { min: SWEEP_MIN_STEPS, max: SWEEP_MAX_STEPS })}</span>
          <NumberField
            label={t('sweep.stepsLabel')}
            value={steps}
            step={1}
            min={SWEEP_MIN_STEPS}
            max={SWEEP_MAX_STEPS}
            onChange={(v) => {
              setSteps(Math.round(Math.min(SWEEP_MAX_STEPS, Math.max(SWEEP_MIN_STEPS, v))));
            }}
          />
        </label>
        <label>
          <span>{t('sweep.answer')}</span>
          <select
            value={answer.id}
            disabled={running}
            onChange={(e) => {
              setAnswerId(e.target.value);
            }}
          >
            {answers.map((a) => (
              <option key={a.id} value={a.id}>
                {L(a.label)}
              </option>
            ))}
          </select>
        </label>
        <div className="sweep__actions">
          {running ? (
            <>
              <span className="muted" role="status">
                {t('sweep.progress', { done: progress, total: values.length })}
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  abort.current?.abort();
                  setProgress(null);
                }}
              >
                {t('sweep.cancel')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--accent" onClick={start}>
              {t('sweep.run')}
            </button>
          )}
        </div>
      </div>
      {done && <SweepChart {...done} />}
    </div>
  );
}

function SweepChart({ result, def, answer }: Done) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const xUnit = def.unit ?? '1';
  const y = result.y.map((v) => (v === null ? null : fromSI(v, answer.unit)));
  const fmtX = (x: number) => formatNumber(locale, x, { maximumSignificantDigits: 4 });
  return (
    <section className="sweep__result" aria-label={t('sweep.result')}>
      <XYChart
        x={result.x}
        series={[{ label: L(answer.label), y, markers: true }]}
        xLabel={L(def.label)}
        yLabel={L(answer.label)}
        xUnit={unitLabel(xUnit, locale)}
        yUnit={unitLabel(answer.unit, locale)}
        csvName={`${L(answer.label)} - ${L(def.label)}`}
      />
      {result.skipped.length > 0 && (
        <p className="sweep__skipped" role="note">
          <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />
          {t('sweep.skipped', { count: result.skipped.length })}{' '}
          {result.skipped
            .map(
              (s) =>
                `${fmtX(s.x)} ${unitLabel(xUnit, locale)}${s.reason ? ` (${L(s.reason)})` : ''}`,
            )
            .join('; ')}
        </p>
      )}
      <details className="sweep__table">
        <summary>{t('sweep.table')}</summary>
        <table className="run-log__table">
          <thead>
            <tr>
              <th scope="col">
                {L(def.label)} ({unitLabel(xUnit, locale)})
              </th>
              <th scope="col">
                {L(answer.label)} ({unitLabel(answer.unit, locale)})
              </th>
            </tr>
          </thead>
          <tbody>
            {result.x.map((x, i) => {
              const v = y[i];
              return (
                <tr key={i}>
                  <td className="mono">{fmtX(x)}</td>
                  <td className="mono">
                    {v === null || v === undefined
                      ? '—'
                      : formatNumber(locale, v, { maximumSignificantDigits: 4 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </section>
  );
}
