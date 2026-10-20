import { useMemo } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { STAGE3D_NAME } from '@/biology/division/mitosis3d/components';
import { STAGES_3D } from '@/biology/division/mitosis3d/timeline';
import { ScienceCard } from '@/science-card/ScienceCard';
import { cx } from '@/ui/cx';
import type { StepProps } from '../flow/types';
import { ACTIVITY_KEY, engineEvidence, withPrediction } from '../session';
import { studioCard } from './card';
import { stageKey, stageOfKey } from './evidence';
import { biologyOf } from './model';
import { BindingError, CountList, DataNote, FactList } from './parts';
import './biology.css';

/** Predict: one stage of the model, chosen before anything is observed. */
export function Predict({ scenario, session, update }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const b = biologyOf(scenario);
  if (!b) return <BindingError />;
  const locked = session.predictionLocked;
  return (
    <div className="studio-stack">
      <p className="studio-task">{L(b.question)}</p>
      <div className="studio-choices" role="radiogroup" aria-label={t('studio.bio.predictLabel')}>
        {STAGES_3D.map((stage) => {
          const label = L(STAGE3D_NAME[stage]);
          const checked = session.prediction?.choice === stage;
          return (
            <button
              key={stage}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={locked}
              className={cx('studio-choice', checked && 'is-checked')}
              onClick={() => {
                update((s) =>
                  withPrediction(s, {
                    choice: stage,
                    label,
                    text: STAGE3D_NAME[stage],
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
      {locked && <p className="muted small">{t('studio.bio.locked')}</p>}
    </div>
  );
}

/** Observe: every recorded stage with the model's counts, the checked activity, the card. */
export function Observe({ scenario, session }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const b = biologyOf(scenario);
  const card = useMemo(() => (b ? studioCard(b.cellType) : null), [b]);
  if (!b || !card) return <BindingError />;
  const answerKey = session.verdict?.correct ? `stage:${session.verdict.correct}` : null;
  const runs = engineEvidence(session)
    .filter((e) => stageOfKey(e.key) !== null)
    .sort((x, y) => Number(y.key === answerKey) - Number(x.key === answerKey));
  const check = engineEvidence(session).find((e) => e.key === ACTIVITY_KEY);
  return (
    <div className="studio-stack">
      <h4>{t('studio.bio.observe.stages')}</h4>
      {runs.length === 0 ? (
        <p className="muted">{t('studio.bio.observe.none')}</p>
      ) : (
        <ul className="bio-runs" aria-label={t('studio.bio.observe.stages')}>
          {runs.map((run) => (
            <li key={run.key} className={cx('bio-run', run.key === answerKey && 'is-answer')}>
              <h5>
                {L(run.title)}
                {run.key === answerKey && (
                  <span className="bio-run__tag">{t('studio.bio.observe.answerTag')}</span>
                )}
              </h5>
              <CountList quantities={run.quantities} />
              {run.facts && <FactList facts={run.facts} />}
            </li>
          ))}
        </ul>
      )}
      {check?.facts && (
        <section className="bio-run" aria-label={L(check.title)}>
          <h5>{L(check.title)}</h5>
          <FactList facts={check.facts} />
        </section>
      )}
      <p className="muted small">{t('studio.bio.observe.illustrative')}</p>
      <DataNote cellType={b.cellType} />
      <ScienceCard card={card} collapsible />
    </div>
  );
}

/** Next to the conclusion: the model's count for the stage that answered the question. */
export function Facts({ session }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const stage = session.verdict?.correct ? stageOfKey(`stage:${session.verdict.correct}`) : null;
  if (!stage) return null;
  const run = engineEvidence(session).find((e) => e.key === stageKey(stage));
  const value = (id: string) => run?.quantities.find((q) => q.id === id)?.value;
  const onPlane = value('onPlane');
  const total = value('chromosomes');
  if (onPlane === undefined || total === undefined) return null;
  return (
    <p className="studio-fact">
      {t('studio.bio.factLine', {
        stage: L(STAGE3D_NAME[stage]),
        onPlane: formatNumber(locale, onPlane),
        total: formatNumber(locale, total),
      })}
    </p>
  );
}
