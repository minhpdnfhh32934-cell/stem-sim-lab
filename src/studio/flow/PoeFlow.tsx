import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';
import { useT } from '@/app/i18n';
import { cx } from '@/ui/cx';
import { scenarioSteps, type FlowStep, type StudioScenario } from '../scenario';
import {
  blockerAt,
  createSession,
  goTo,
  markComplete,
  neighbour,
  type StudioSession,
} from '../session';
import { useStudioSession, useStudioStore } from '../studioStore';
import { AskTeacher } from './AskTeacher';
import { ConcludeStep, ExplainStep, ReportStep } from './SharedSteps';
import type { StepProps, SubjectPlugin } from './types';
import { useStudioContext } from './useStudioContext';

/** Predict → Interact → Observe → Explain → Conclude → Save/Report, shared by every subject. */
export function PoeFlow({ scenario, plugin }: { scenario: StudioScenario; plugin: SubjectPlugin }) {
  const t = useT();
  const titleId = useId();
  const stored = useStudioSession(scenario.id);
  const fresh = useMemo(() => createSession(scenario, 0), [scenario]);
  const session = stored ?? fresh;
  const save = useStudioStore((s) => s.update);
  useStudioContext(scenario);
  const update = useCallback(
    (change: (s: StudioSession) => StudioSession) => {
      save(scenario, change);
    },
    [save, scenario],
  );

  const steps = scenarioSteps(scenario);
  const step = session.step;
  const blocker = blockerAt(scenario, session, step);
  const next = neighbour(scenario, step, 1);
  const prev = neighbour(scenario, step, -1);
  const reachable = (target: FlowStep) => goTo(scenario, session, target).step === target;

  const go = (target: FlowStep) => {
    update((s) => {
      const moved = goTo(scenario, s, target);
      return target === 'report' ? markComplete(scenario, moved, Date.now()) : moved;
    });
  };

  const props: StepProps = { scenario, session, update };
  const body =
    step === 'predict' ? (
      <plugin.Predict {...props} />
    ) : step === 'interact' ? (
      <plugin.Interact {...props} />
    ) : step === 'observe' ? (
      <plugin.Observe {...props} />
    ) : step === 'explain' ? (
      <ExplainStep {...props} />
    ) : step === 'conclude' ? (
      <ConcludeStep {...props} plugin={plugin} />
    ) : (
      <ReportStep {...props} plugin={plugin} />
    );

  return (
    <div className="studio-flow">
      <ol className="studio-steps" aria-label={t('studio.flow.label')}>
        {steps.map((s, i) => {
          const current = s === step;
          const done = steps.indexOf(s) < steps.indexOf(step);
          return (
            <li key={s}>
              <button
                type="button"
                className={cx('studio-steps__item', current && 'is-current', done && 'is-done')}
                aria-current={current ? 'step' : undefined}
                disabled={!current && !reachable(s)}
                onClick={() => {
                  go(s);
                }}
              >
                <span className="studio-steps__num" aria-hidden="true">
                  {done ? <Check size={14} strokeWidth={2.4} /> : i + 1}
                </span>
                <span>{t(`studio.flow.steps.${s}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="studio-flow__body" aria-labelledby={titleId}>
        <h3 id={titleId} className="studio-flow__title">
          {t(`studio.flow.titles.${step}`)}
        </h3>
        <p className="studio-flow__lead muted">
          {t(plugin.leads?.[step] ?? `studio.flow.leads.${step}`)}
        </p>
        {body}
        <AskTeacher scenario={scenario} step={step} />
      </section>

      <div className="studio-flow__nav">
        {prev ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              go(prev);
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t('studio.flow.back')}
          </button>
        ) : (
          <span />
        )}
        {blocker && (
          <p className="studio-flow__blocker muted" role="status">
            {t(plugin.blockers?.[blocker] ?? `studio.flow.blockers.${blocker}`, {
              n: scenario.completion.explanationMinChars,
            })}
          </p>
        )}
        {next && (
          <button
            type="button"
            className="btn btn--accent"
            disabled={blocker !== null}
            onClick={() => {
              go(next);
            }}
          >
            {t('studio.flow.next', { step: t(`studio.flow.steps.${next}`) })}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
