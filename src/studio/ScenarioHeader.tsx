import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { ReviewNote } from './ReviewNote';
import type { StudioScenario } from './scenario';
import { TeacherNote } from './TeacherNote';

/** A lesson's title, level, objectives and review note (Science Studio and the guided lessons). */
export function ScenarioHeader({ scenario }: { scenario: StudioScenario }) {
  const t = useT();
  const L = useLocalized();
  return (
    <header className="studio-scenario">
      <h2>{L(scenario.title)}</h2>
      <p className="muted small">
        {t(`levels.${scenario.level}`)} · {t(`studio.difficulty.${scenario.difficulty}`)}
      </p>
      <ul className="studio-objectives">
        {scenario.objectives.map((o) => (
          <li key={o.vi}>{L(o)}</li>
        ))}
      </ul>
      <TeacherNote scenario={scenario} />
      <ReviewNote status={scenario.review_status} guided={scenario.binding.kind === 'guided'} />
    </header>
  );
}
