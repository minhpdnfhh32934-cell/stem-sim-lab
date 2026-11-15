import { CircleCheck, ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ScienceCard } from '@/science-card/ScienceCard';
import { cx } from '@/ui/cx';
import type { StepProps } from '../flow/types';
import { ACTIVITY_KEY, engineEvidence, predictionLabel, withPrediction } from '../session';
import { guidedCard } from './card';
import {
  guidedOf,
  readSheet,
  rowLabel,
  scoreActivity,
  sheetComplete,
  withGuidedCheck,
  withSheet,
} from './check';
import { GuidedActivity, RowOutcome } from './GuidedActivity';
import './guided.css';

function BindingError() {
  const t = useT();
  return (
    <p className="studio-error" role="alert">
      {t('studio.guided.binding')}
    </p>
  );
}

/** Predict: one of the lesson's choices, chosen before any activity. */
export function Predict({ scenario, session, update }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const b = guidedOf(scenario);
  if (!b) return <BindingError />;
  const locked = session.predictionLocked;
  return (
    <div className="studio-stack">
      <p className="studio-task">{L(b.question)}</p>
      <div
        className="studio-choices"
        role="radiogroup"
        aria-label={t('studio.guided.predictLabel')}
      >
        {b.choices.map((c) => {
          const label = L(c.text);
          const checked = session.prediction?.choice === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={locked}
              className={cx('studio-choice', checked && 'is-checked')}
              onClick={() => {
                update((s) =>
                  withPrediction(s, { choice: c.id, label, text: c.text, at: Date.now() }),
                );
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {locked && <p className="muted small">{t('studio.guided.locked')}</p>}
    </div>
  );
}

/** Interact: every activity, then one "Kiểm tra" for the whole sheet. */
export function Interact({ scenario, session, update }: StepProps) {
  const t = useT();
  const b = guidedOf(scenario);
  const sheet = useMemo(
    () => (b ? readSheet(scenario.id, b, session.actions) : {}),
    [b, scenario.id, session.actions],
  );
  if (!b) return <BindingError />;
  const checked = engineEvidence(session).some((e) => e.key === ACTIVITY_KEY);
  const complete = sheetComplete(b, sheet);
  const scores = b.activities.map((a) => scoreActivity(a, sheet[a.id] ?? {}));
  const correct = scores.reduce((n, s) => n + s.correct, 0);
  const total = scores.reduce((n, s) => n + s.total, 0);
  return (
    <div className="studio-stack guided">
      {b.activities.map((a, i) => (
        <GuidedActivity
          key={a.id}
          scenarioId={scenario.id}
          n={i + 1}
          activity={a}
          answers={sheet[a.id] ?? {}}
          checked={checked}
          onChange={(answers) => {
            update((s) => {
              const current = readSheet(scenario.id, b, s.actions);
              return withSheet(scenario, s, { ...current, [a.id]: answers }, Date.now());
            });
          }}
        />
      ))}
      <div className="guided-check">
        <button
          type="button"
          className="btn btn--accent"
          disabled={!complete || checked}
          onClick={() => {
            update((s) => withGuidedCheck(scenario, s, Date.now()));
          }}
        >
          <ListChecks size={16} aria-hidden="true" />
          {t('studio.guided.check')}
        </button>
        <p className="muted" role="status">
          {checked
            ? t('studio.guided.checked', { correct, total })
            : complete
              ? t('studio.guided.ready')
              : t('studio.guided.incomplete')}
        </p>
      </div>
    </div>
  );
}

/**
 * Observe: the prediction's answer and why, then every row with its outcome and reason. The
 * Science Card is shown here only where nothing else shows it (Science Studio; the lab's
 * Inspector already does).
 */
export function Observe({ scenario, session, card = false }: StepProps & { card?: boolean }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const b = guidedOf(scenario);
  const data = useMemo(() => guidedCard(scenario), [scenario]);
  const sheet = useMemo(
    () => (b ? readSheet(scenario.id, b, session.actions) : {}),
    [b, scenario.id, session.actions],
  );
  if (!b) return <BindingError />;
  const answer = b.choices.find((c) => c.id === b.answer);
  const checked = engineEvidence(session).some((e) => e.key === ACTIVITY_KEY);
  return (
    <div className="studio-stack">
      <section className="guided-answer" aria-label={t('studio.guided.observe.prediction')}>
        <h4>{t('studio.guided.observe.prediction')}</h4>
        <p>{L(b.question)}</p>
        {answer && (
          <p className="guided-outcome is-right">
            <strong className="guided-outcome__mark">
              <CircleCheck size={16} aria-hidden="true" />
              {t('studio.guided.observe.answer', { answer: L(answer.text) })}
            </strong>
          </p>
        )}
        <p>{L(b.answerWhy)}</p>
        {session.prediction && (
          <p className="muted">
            {t('studio.guided.observe.yours', {
              label: predictionLabel(session.prediction, locale),
            })}
          </p>
        )}
      </section>
      {!checked && <p className="muted">{t('studio.guided.blockers.activity')}</p>}
      {checked &&
        b.activities.map((a, i) => {
          const score = scoreActivity(a, sheet[a.id] ?? {});
          return (
            <section key={a.id} className="guided-activity" aria-label={L(a.prompt)}>
              <h4>
                <span className="guided-activity__n">
                  {t('studio.guided.activity', { n: i + 1 })}
                </span>{' '}
                {L(a.prompt)}
              </h4>
              <p className="guided-score">
                {t('studio.guided.score', { correct: score.correct, total: score.total })}
              </p>
              <ul className="guided-rows">
                {score.rows.map((r) => (
                  <li key={r.id} className="guided-row" data-row={r.id}>
                    <span className="guided-row__text">{L(rowLabel(a, r.id))}</span>
                    <RowOutcome activity={a} result={r} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      {card && <ScienceCard card={data} collapsible />}
    </div>
  );
}

/** Observe in Science Studio, with the Science Card inline. */
export function ObserveWithCard(props: StepProps) {
  return <Observe {...props} card />;
}
