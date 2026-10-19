import { useMemo } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { ScienceCard } from '@/science-card/ScienceCard';
import { cx } from '@/ui/cx';
import type { StepProps } from '../flow/types';
import { engineEvidence, withPrediction, type EngineEvidence } from '../session';
import { benchCard } from './card';
import { EvidenceFacts } from './EvidenceFacts';
import { CHEM_CHOICES, chemistryOf, targetMatchesLibrary } from './evidence';
import { mixKey, mixOutcome } from './library';
import { TubeSvg } from './TubeSvg';
import './chemistry.css';

function BindingError() {
  const t = useT();
  return (
    <p className="studio-error" role="alert">
      {t('studio.chem.binding')}
    </p>
  );
}

/** Predict: precipitate or not, before anything is mixed. */
export function Predict({ scenario, session, update }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const b = chemistryOf(scenario);
  if (!b) return <BindingError />;
  const locked = session.predictionLocked;
  return (
    <div className="studio-stack">
      <p className="studio-task">{L(b.question)}</p>
      <div className="studio-choices" role="radiogroup" aria-label={t('studio.chem.predictLabel')}>
        {CHEM_CHOICES.map((c) => {
          const label = t(`studio.chem.choices.${c}`);
          const checked = session.prediction?.choice === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={locked}
              className={cx('studio-choice', checked && 'is-checked')}
              onClick={() => {
                update((s) => withPrediction(s, { choice: c, label, at: Date.now() }));
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {locked && <p className="muted small">{t('studio.chem.locked')}</p>}
    </div>
  );
}

/** The question's mix first, then the other mixes in the order they were made. */
function orderedRuns(runs: readonly EngineEvidence[], targetKey: string): EngineEvidence[] {
  return [...runs].sort((a, b) => Number(b.key === targetKey) - Number(a.key === targetKey));
}

/** Observe: every recorded mix with the library's text, plus the Science Card of the record. */
export function Observe({ scenario, session }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const b = chemistryOf(scenario);
  const target = useMemo(() => (b ? mixOutcome(b.target) : null), [b]);
  if (!b || !targetMatchesLibrary(b) || target?.kind !== 'library') return <BindingError />;
  const targetKey = `mix:${mixKey(b.target)}`;
  const runs = orderedRuns(engineEvidence(session), targetKey);
  if (runs.length === 0) return <p className="muted">{t('studio.chem.noMix')}</p>;
  const done = runs.some((r) => r.key === targetKey);
  return (
    <div className="studio-stack">
      <h4>{t('studio.chem.mixes')}</h4>
      <ul className="chem-runs" aria-label={t('studio.chem.mixes')}>
        {runs.map((run) => {
          const isTarget = run.key === targetKey;
          return (
            <li key={run.key} className={cx('chem-run', isTarget && 'is-target')}>
              {isTarget && (
                <TubeSvg
                  contents={b.target}
                  mixed
                  precipitate={target.precipitate}
                  label={`${L(run.title)}. ${target.precipitate ? t('studio.chem.tubePrecipitate') : ''}`}
                />
              )}
              <div>
                <h5>
                  {L(run.title)}
                  {isTarget && <span className="chem-run__tag">{t('studio.chem.targetTag')}</span>}
                </h5>
                {run.facts && <EvidenceFacts facts={run.facts} />}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted small">{t('studio.chem.unsupported')}</p>
      {done && <ScienceCard card={benchCard(target.reaction)} collapsible />}
    </div>
  );
}

/** Next to the conclusion: the library's observation for the question's mix. */
export function Facts({ scenario, session }: StepProps) {
  const t = useT();
  const L = useLocalized();
  const b = chemistryOf(scenario);
  if (!b) return null;
  const run = engineEvidence(session).find((r) => r.key === `mix:${mixKey(b.target)}`);
  const obs = run?.facts?.find((f) => f.id === 'observation');
  if (!obs) return null;
  return <p className="studio-fact">{t('studio.chem.factLine', { text: L(obs.text) })}</p>;
}
