import { PencilLine } from 'lucide-react';
import { useT } from '@/app/i18n';
import type { StudioScenario } from './scenario';

/** Labels teacher-written text so it is never read as a simulation result. */
export function TeacherNote({ scenario }: { scenario: Pick<StudioScenario, 'author'> }) {
  const t = useT();
  if (scenario.author !== 'teacher') return null;
  return (
    <p className="studio-teacher">
      <PencilLine size={14} aria-hidden="true" />
      {t('studio.teacher')}
    </p>
  );
}
