import { CheckCircle2, Flag, Lightbulb, Play, RotateCcw, Sparkles, Target } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { fmtQty } from '@/physics/common/tex';
import type { ParamSource, Params, PhysicsScene } from '@/physics/types';
import { cx } from '@/ui/cx';
import { challengesFor, evaluate, optimum, startParams, type Challenge } from './challenges';
import { changedValue, observe, poeFor, type Poe, type PoeChoice } from './poe';
import { useProgressStore } from './progressStore';
import './learn.css';

/** Sources with every parameter at "default": the state a prediction or challenge starts from. */
function defaultSources(scene: PhysicsScene): Record<string, ParamSource> {
  return Object.fromEntries(scene.params.map((d) => [d.key, 'default' as const]));
}

function answerMeta(scene: PhysicsScene, params: Params, id: string) {
  try {
    return scene.solve(params, 'vi').answers.find((a) => a.id === id) ?? null;
  } catch {
    return null;
  }
}

/** "Thử thách" tab: "Dự đoán trước" + "Thử thách nhỏ" for the open physics topic. */
export function ChallengePanel() {
  const t = useT();
  const scene = useSimStore((s) => s.scene);
  if (!scene) return <p className="learn__empty muted">{t('learn.empty')}</p>;
  const poe = poeFor(scene.id);
  const challenges = challengesFor(scene.id);
  if (!poe && challenges.length === 0)
    return <p className="learn__empty muted">{t('learn.none')}</p>;
  return (
    <div className="learn" key={scene.id}>
      {poe && <PredictCard scene={scene} poe={poe} />}
      {challenges.map((c) => (
        <ChallengeCard key={c.id} scene={scene} challenge={c} />
      ))}
    </div>
  );
}

function useCurrentG(): number | undefined {
  return useSimStore((s) => s.params.g);
}

/* ---------------- Predict – Observe – Explain ---------------- */

function choiceLabel(t: ReturnType<typeof useT>, locale: 'vi' | 'en', c: PoeChoice): string {
  if (c.kind === 'direction') return t(`learn.dir.${c.dir}`);
  if (Math.abs(c.ratio - 1) < 1e-9) return t('learn.ratio.same');
  if (Math.abs(c.ratio - 0.5) < 1e-9) return t('learn.ratio.half');
  if (Math.abs(c.ratio - Math.SQRT2) < 1e-9) return t('learn.ratio.sqrt2');
  return t('learn.ratio.times', { n: formatNumber(locale, c.ratio, { maximumFractionDigits: 2 }) });
}

function PredictCard({ scene, poe }: { scene: PhysicsScene; poe: Poe }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const g = useCurrentG();
  const record = useProgressStore((s) => s.recordPrediction);
  const [choice, setChoice] = useState<number | null>(null);
  const [observed, setObserved] = useState<{
    before: number;
    after: number;
    correct: number;
  } | null>(null);
  const [note, setNote] = useState('');
  const groupId = useId();
  const noteId = useId();
  const def = scene.params.find((d) => d.key === poe.param);
  const meta = answerMeta(scene, scene.defaults, poe.answer);

  const run = () => {
    const base = scene.usesGravity && g !== undefined ? { ...scene.defaults, g } : scene.defaults;
    const start = { ...base, ...poe.start };
    const out = observe(scene, poe, start);
    if (!out || choice === null) return;
    setObserved(out);
    record(poe.id, choice === out.correct);
    // Observe: the simulation runs with the changed value (marked "đã chỉnh").
    sim.applyParams(start, defaultSources(scene));
    sim.setParam(poe.param, changedValue(poe, start), 'user');
    if (!useWorkspaceStore.getState().playing) sim.togglePlay();
  };

  const restart = () => {
    setObserved(null);
    setChoice(null);
    setNote('');
  };

  const right = observed !== null && choice === observed.correct;
  return (
    <section className="learn-card" aria-labelledby={`${groupId}-title`}>
      <header className="learn-card__head">
        <Lightbulb size={16} strokeWidth={1.75} aria-hidden="true" />
        <h3 id={`${groupId}-title`}>{t('learn.predictTitle')}</h3>
        <span className="learn-card__steps">{t('learn.poeSteps')}</span>
      </header>
      <p className="learn-card__task">{L(poe.question)}</p>
      <div className="learn-choices" role="radiogroup" aria-labelledby={`${groupId}-title`}>
        {poe.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={choice === i}
            disabled={observed !== null}
            className={cx(
              'learn-choice',
              observed !== null && i === observed.correct && 'is-correct',
              observed !== null && i === choice && i !== observed.correct && 'is-wrong',
            )}
            onClick={() => {
              setChoice(i);
            }}
          >
            {choiceLabel(t, locale, c)}
          </button>
        ))}
      </div>
      {observed === null ? (
        <button type="button" className="btn btn--accent" disabled={choice === null} onClick={run}>
          <Play size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('learn.observe')}
        </button>
      ) : (
        <div className="learn-result" role="status">
          <p className={cx('learn-result__verdict', right ? 'is-right' : 'is-other')}>
            {right ? (
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
            {right ? t('learn.predictRight') : t('learn.predictOther')}
          </p>
          {meta && (
            <p>
              {t('learn.observed', {
                quantity: L(meta.label),
                param: def ? L(def.label) : poe.param,
                before: fmtQty(locale, observed.before, meta.unit),
                after: fmtQty(locale, observed.after, meta.unit),
              })}
            </p>
          )}
          <label htmlFor={noteId} className="learn-result__label">
            {t('learn.explainYours')}
          </label>
          <textarea
            id={noteId}
            className="learn-note"
            rows={2}
            value={note}
            placeholder={t('learn.explainPlaceholder')}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
          <p className="muted small">{t('learn.explainHint')}</p>
          <button type="button" className="btn" onClick={restart}>
            <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
            {t('learn.predictAgain')}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------------- Challenges ---------------- */

function ChallengeCard({ scene, challenge: c }: { scene: PhysicsScene; challenge: Challenge }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { params, sources } = useSimStore(
    useShallow((s) => ({ params: s.params, sources: s.sources })),
  );
  const done = useProgressStore((s) => s.challenges[c.id] !== undefined);
  const complete = useProgressStore((s) => s.completeChallenge);
  const [active, setActive] = useState(false);
  const [hint, setHint] = useState(false);
  const g = useCurrentG();
  const titleId = useId();

  // The best value of a max/min goal depends only on the fixed parameters (computed once).
  const best = useMemo(
    () =>
      active && c.goal.kind !== 'target'
        ? optimum(scene, c, startParams(scene, c, g)).value
        : undefined,
    [active, scene, c, g],
  );
  const status = active ? evaluate(scene, c, params, sources, best) : null;
  const meta = answerMeta(scene, scene.defaults, c.goal.answer);
  const controls = c.controls
    .map((k) => scene.params.find((d) => d.key === k))
    .filter((d) => d !== undefined)
    .map((d) => L(d.label))
    .join(', ');

  const solved = status?.state === 'done';
  useEffect(() => {
    if (solved) complete(c.id);
  }, [solved, complete, c.id]);

  const start = () => {
    sim.applyParams(startParams(scene, c, g), defaultSources(scene));
    setActive(true);
    setHint(false);
  };

  const q = (v: number) => (meta ? fmtQty(locale, v, meta.unit) : String(v));
  return (
    <section
      className={cx('learn-card', status?.state === 'done' && 'learn-card--done')}
      aria-labelledby={titleId}
    >
      <header className="learn-card__head">
        <Target size={16} strokeWidth={1.75} aria-hidden="true" />
        <h3 id={titleId}>
          {t('learn.challenge')}: {L(c.title)}
        </h3>
        {done && (
          <span className="learn-card__badge">
            <Flag size={12} strokeWidth={2} aria-hidden="true" />
            {t('learn.completed')}
          </span>
        )}
      </header>
      <p className="learn-card__task">{L(c.task)}</p>
      {!active ? (
        <button type="button" className="btn btn--accent" onClick={start}>
          <Play size={15} strokeWidth={1.75} aria-hidden="true" />
          {done ? t('learn.tryAgain') : t('learn.start')}
        </button>
      ) : (
        <>
          <p className="muted small">{t('learn.controls', { controls })}</p>
          {status?.state === 'changed' && (
            <p className="learn-warn" role="status">
              {t('learn.changed')}{' '}
              <button type="button" className="link-button" onClick={start}>
                {t('learn.restart')}
              </button>
            </p>
          )}
          {status?.state === 'invalid' && (
            <p className="learn-warn" role="status">
              {t('learn.invalid')}
            </p>
          )}
          {(status?.state === 'trying' || status?.state === 'done') && meta && (
            <dl className="learn-status" aria-live="polite">
              <div>
                <dt>{t('learn.now')}</dt>
                <dd>
                  {L(meta.label)} = {q(status.value)}
                </dd>
              </div>
              <div>
                <dt>{t('learn.goal')}</dt>
                <dd>
                  {c.goal.kind === 'target'
                    ? `${q(status.goal)} (± ${q(status.tol)})`
                    : t(c.goal.kind === 'max' ? 'learn.goalMax' : 'learn.goalMin')}
                </dd>
              </div>
            </dl>
          )}
          {status?.state === 'done' && meta && (
            <p className="learn-success" role="status">
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
              {c.goal.kind === 'target'
                ? t('learn.successTarget', {
                    quantity: L(meta.label),
                    value: q(status.value),
                    goal: q(status.goal),
                    diff: q(Math.abs(status.value - status.goal)),
                  })
                : t('learn.successBest', {
                    quantity: L(meta.label),
                    value: q(status.value),
                    best: q(status.goal),
                  })}
            </p>
          )}
          {status?.state !== 'done' &&
            (hint ? (
              <p className="learn-hint">
                <Lightbulb size={14} strokeWidth={1.75} aria-hidden="true" />
                {L(c.hint)}
              </p>
            ) : (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setHint(true);
                }}
              >
                <Lightbulb size={15} strokeWidth={1.75} aria-hidden="true" />
                {t('learn.showHint')}
              </button>
            ))}
        </>
      )}
    </section>
  );
}
