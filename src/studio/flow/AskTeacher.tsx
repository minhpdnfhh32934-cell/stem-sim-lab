import { GraduationCap } from 'lucide-react';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { askInBubble } from '@/teacher/teacherStore';
import type { FlowStep, StudioScenario } from '../scenario';

/**
 * "Hỏi thầy": opens the chat bubble with a question about the current step, written from the
 * lesson's own title. The learner may change it and sends it; the lesson's data goes along only
 * when the learner turns on the bubble's screen-context switch.
 */
export function AskTeacher({ scenario, step }: { scenario: StudioScenario; step: FlowStep }) {
  const t = useT();
  const L = useLocalized();
  // The bubble is hidden in presentation mode, so there is nothing to open.
  const presentation = useLayoutStore((s) => s.presentation);
  if (presentation) return null;
  return (
    <div className="studio-ask">
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          askInBubble(t(`studio.ask.questions.${step}`, { title: L(scenario.title) }));
        }}
      >
        <GraduationCap size={16} aria-hidden="true" />
        {t('studio.ask.button')}
      </button>
      <p className="muted small">{t('studio.ask.hint', { toggle: t('chat.contextToggle') })}</p>
    </div>
  );
}
