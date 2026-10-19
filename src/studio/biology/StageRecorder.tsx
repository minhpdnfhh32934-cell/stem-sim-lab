import { Camera, Lock } from 'lucide-react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { CELL_TYPE_NAME, STAGE3D_NAME } from '@/biology/division/mitosis3d/components';
import { timelineFor } from '@/biology/division/mitosis3d/store';
import type { Stage3D } from '@/biology/division/mitosis3d/timeline';
import { useProgressStore } from '@/learn/progressStore';
import type { StepProps } from '../flow/types';
import type { BiologyBinding } from '../scenario';
import { engineEvidence } from '../session';
import { withStageObservation } from './bioSession';
import { stageKey } from './evidence';
import { answerStage, bioVerdict } from './model';
import { CountList } from './parts';
import { useShownStage, useShowsLessonCell } from './useModel';

/**
 * Records the stage on screen; the counts are read from the model of the lesson's cell, never
 * typed in. Recording is only possible while the view shows that cell (the lesson locks it).
 */
export function StageRecorder({ scenario, session, update, b }: StepProps & { b: BiologyBinding }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const tl = timelineFor(b.pairs, b.cellType);
  const shown = useShowsLessonCell(b);
  const stage = useShownStage(tl);
  const answer = answerStage(tl, b.stageQuestion);
  const labelOf = (s: Stage3D) => L(STAGE3D_NAME[s]);
  const rec = shown ? engineEvidence(session).find((e) => e.key === stageKey(stage)) : undefined;

  const record = () => {
    if (!shown) return;
    update((s) => withStageObservation(s, b, stage, Date.now(), labelOf));
    if (stage === answer) {
      const v = bioVerdict(answer, session.prediction, labelOf);
      if (v.match !== null) {
        useProgressStore.getState().recordPrediction(`studio:${scenario.id}`, v.match);
      }
    }
  };

  return (
    <section className="bio-panel" aria-label={t('studio.bio.stages.title')}>
      <h4>{t('studio.bio.stages.title')}</h4>
      <p className="muted small">{t('studio.bio.stages.help')}</p>
      <p className="bio-panel__lock small">
        <Lock size={14} aria-hidden="true" />
        {t('studio.bio.stages.lockedCell', {
          cell: L(CELL_TYPE_NAME[b.cellType]).toLowerCase(),
          diploid: formatNumber(locale, 2 * b.pairs),
        })}
      </p>
      <div className="bio-panel__row">
        <p className="bio-panel__current">
          {t('studio.bio.stages.current', { stage: labelOf(stage) })}
        </p>
        <button type="button" className="btn btn--accent" onClick={record} disabled={!shown}>
          <Camera size={16} aria-hidden="true" />
          {t('studio.bio.stages.record')}
        </button>
      </div>
      {!shown && (
        <p className="studio-error" role="alert">
          {t('studio.bio.stages.otherCell')}
        </p>
      )}
      {rec && <CountList quantities={rec.quantities} />}
      {rec && (
        <p className="muted small" role="status">
          {stage === answer ? t('studio.bio.stages.answered') : t('studio.bio.stages.notAnswer')}
        </p>
      )}
    </section>
  );
}
