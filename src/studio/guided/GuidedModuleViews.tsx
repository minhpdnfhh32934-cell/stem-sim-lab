import { BookOpenText } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '@/app/i18n';
import { usePublishCard } from '@/modules/usePublishCard';
import { PoeFlow } from '../flow/PoeFlow';
import { ScenarioHeader } from '../ScenarioHeader';
import type { StudioScenario } from '../scenario';
import { guidedCard, knttLesson } from './card';
import { guidedOf } from './check';
import { guidedLabPlugin } from './plugin';
import '../studio.css';
import './guided.css';

/** A guided lesson on the lab's stage: its header and the shared POE flow, publishing its card. */
export function GuidedStage({ scenario }: { scenario: StudioScenario }) {
  const card = useMemo(() => guidedCard(scenario), [scenario]);
  usePublishCard(card);
  return (
    <div className="guided-stage">
      <div className="studio-pane">
        <ScenarioHeader scenario={scenario} />
        <PoeFlow scenario={scenario} plugin={guidedLabPlugin} />
      </div>
    </div>
  );
}

/** The Inspector says plainly that this lesson has no simulation, and which book lesson it follows. */
export function GuidedPanel({ scenario }: { scenario: StudioScenario }) {
  const t = useT();
  const b = guidedOf(scenario);
  const lesson = b ? knttLesson(b.kntt) : null;
  return (
    <div className="guided-panel">
      <p>
        <BookOpenText size={16} aria-hidden="true" />
        {t('studio.guided.panel')}
      </p>
      {lesson && (
        <p className="muted small">
          {t('studio.guided.panelSource', {
            book: lesson.bookTitle,
            n: lesson.number,
            title: lesson.title,
          })}
        </p>
      )}
    </div>
  );
}
