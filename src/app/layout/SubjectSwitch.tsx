import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { cx } from '@/ui/cx';

/** The "Môn học" radiogroup: classic top bar; the bench shows it above the library. */
export function SubjectSwitch() {
  const t = useT();
  const { subject, setSubject } = useWorkspaceStore(
    useShallow((s) => ({ subject: s.subject, setSubject: s.setSubject })),
  );
  return (
    <div
      className="subject-switch"
      role="radiogroup"
      aria-label={t('subjects.label')}
      data-tour="subjects"
    >
      {SUBJECTS.map((s) => {
        const Icon = SUBJECT_ICON[s];
        const checked = s === subject;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={checked}
            className={cx('subject-switch__item', `subject--${s}`, checked && 'is-checked')}
            onClick={() => {
              setSubject(s);
            }}
          >
            <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>{t(`subjects.${s}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
