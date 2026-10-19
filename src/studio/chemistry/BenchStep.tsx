import { Droplets, FlaskConical, ShieldAlert, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '@/app/i18n';
import { formatFormula } from '@/chemistry/formula';
import { useProgressStore } from '@/learn/progressStore';
import type { StepProps } from '../flow/types';
import { engineEvidence, type StudioSession } from '../session';
import { applyAction, benchPhase, replayBench, type BenchAction, type BenchError } from './bench';
import { withBenchAction } from './benchSession';
import { EvidenceFacts } from './EvidenceFacts';
import {
  chemistryOf,
  chemVerdict,
  followsProcedure,
  isTargetMix,
  targetMatchesLibrary,
  type ChemChoice,
} from './evidence';
import { mixKey, mixOutcome } from './library';
import { TubeSvg } from './TubeSvg';
import './chemistry.css';

interface Problem {
  error: BenchError;
  formula: string;
}

/** Interact: the bench. Every valid action is stored; what a mix shows comes from the library. */
export function Bench({ scenario, session, update }: StepProps) {
  const t = useT();
  const b = chemistryOf(scenario);
  const targetOk = useMemo(() => (b ? targetMatchesLibrary(b) : false), [b]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const inventory = useMemo(() => b?.inventory ?? [], [b]);
  const state = useMemo(
    () => replayBench(session.actions, inventory),
    [session.actions, inventory],
  );
  const outcome = useMemo(
    () => (state.mixed ? mixOutcome(state.contents) : null),
    [state.mixed, state.contents],
  );

  if (!b || !targetOk) {
    return (
      <p className="studio-error" role="alert">
        {t('studio.chem.binding')}
      </p>
    );
  }

  const labelOf = (c: ChemChoice) => t(`studio.chem.choices.${c}`);

  const act = (a: BenchAction) => {
    const step = applyAction(state, a, inventory);
    if (!step.ok) {
      setProblem({ error: step.error, formula: a.op === 'add' ? formatFormula(a.reagent) : '' });
      return;
    }
    setProblem(null);
    update((s: StudioSession) => withBenchAction(s, b, a, Date.now(), labelOf));
    if (a.op === 'mix' && isTargetMix(b, step.state.contents)) {
      const v = chemVerdict(mixOutcome(step.state.contents), session.prediction, labelOf);
      if (v.match !== null) {
        useProgressStore.getState().recordPrediction(`studio:${scenario.id}`, v.match);
      }
    }
  };

  const phase = benchPhase(state);
  const current = state.mixed
    ? engineEvidence(session).find((e) => e.key === `mix:${mixKey(state.contents)}`)
    : undefined;
  const isTarget = state.mixed && isTargetMix(b, state.contents);
  const names = state.contents.map((f) => t('studio.chem.solution', { formula: formatFormula(f) }));
  const tubeLabel = [
    t('studio.chem.tube'),
    phase === 'empty'
      ? t('studio.chem.tubeEmpty')
      : t('studio.chem.tubeHas', { list: names.join(', ') }),
    state.mixed ? t('studio.chem.tubeMixed') : '',
    outcome?.kind === 'library' && outcome.precipitate ? t('studio.chem.tubePrecipitate') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="studio-stack">
      <section className="chem-procedure" aria-labelledby="chem-procedure-title">
        <h4 id="chem-procedure-title">{t('studio.chem.procedureTitle')}</h4>
        <ol>
          <li>{t('studio.chem.procedure.first', { formula: formatFormula(b.target[0]) })}</li>
          <li>{t('studio.chem.procedure.second', { formula: formatFormula(b.target[1]) })}</li>
          <li>{t('studio.chem.procedure.mix')}</li>
          <li>{t('studio.chem.procedure.wash')}</li>
        </ol>
      </section>

      <div className="chem-bench">
        <div className="chem-rack" role="group" aria-label={t('studio.chem.rack')}>
          <h4>{t('studio.chem.rack')}</h4>
          {inventory.map((f) => (
            <button
              key={f}
              type="button"
              className="btn btn--ghost chem-rack__item"
              aria-label={t('studio.chem.add', { formula: formatFormula(f) })}
              onClick={() => {
                act({ op: 'add', reagent: f });
              }}
            >
              <Droplets size={16} aria-hidden="true" />
              {formatFormula(f)}
            </button>
          ))}
        </div>

        <figure className="chem-bench__tube">
          <TubeSvg
            contents={state.contents}
            mixed={state.mixed}
            precipitate={outcome?.kind === 'library' && outcome.precipitate}
            label={tubeLabel}
          />
          <figcaption className="muted small">{tubeLabel}</figcaption>
        </figure>

        <div className="chem-bench__actions">
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => {
              act({ op: 'mix' });
            }}
          >
            <FlaskConical size={16} aria-hidden="true" />
            {t('studio.chem.mix')}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              act({ op: 'empty' });
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            {t('studio.chem.empty')}
          </button>
        </div>
      </div>

      {problem && (
        <p className="studio-error" role="alert">
          {t(`studio.chem.errors.${problem.error}`, { formula: problem.formula })}
        </p>
      )}

      {current?.facts && (
        <div className="chem-result" aria-live="polite">
          <p className="studio-task">
            {isTarget ? t('studio.chem.targetDone') : t('studio.chem.notTarget')}
          </p>
          {isTarget && !followsProcedure(b, state.contents) && (
            <p className="muted">{t('studio.chem.orderDiffers')}</p>
          )}
          <EvidenceFacts facts={current.facts} />
        </div>
      )}

      <p className="chem-note muted small">
        <ShieldAlert size={14} aria-hidden="true" />
        {t('studio.chem.safety')}
      </p>
      <p className="muted small">{t('studio.chem.unsupported')}</p>
    </div>
  );
}
