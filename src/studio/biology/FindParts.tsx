import { CircleCheck, CircleX, ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { COMPONENTS } from '@/biology/division/mitosis3d/components';
import { useMitosis3D } from '@/biology/division/mitosis3d/store';
import { cx } from '@/ui/cx';
import type { StepProps } from '../flow/types';
import type { BiologyBinding } from '../scenario';
import { ACTIVITY_KEY, engineEvidence } from '../session';
import { withAnswer, withMatchCheck } from './bioSession';
import { answersFromActions, scoreMatch } from './match';
import { taskParts } from './model';
import { DataNote } from './parts';

/**
 * "Find the part from its function": the function texts come from the model's part data and an
 * answer is the part selected in the 3D view (or its parts list) — the same selection that opens
 * the part's info card and "Hỏi thầy về bộ phận này".
 */
export function FindParts({ session, update, b }: StepProps & { b: BiologyBinding }) {
  const t = useT();
  const L = useLocalized();
  const tasks = useMemo(() => taskParts(b), [b]);
  const selected = useMitosis3D((s) => s.selected?.component ?? null);
  const answers = useMemo(
    () => answersFromActions(session.actions, tasks),
    [session.actions, tasks],
  );
  const score = scoreMatch(tasks, answers);
  const checked = engineEvidence(session).some((e) => e.key === ACTIVITY_KEY);
  const selectedName = selected ? L(COMPONENTS[selected].name) : null;

  return (
    <section className="bio-panel" aria-label={t('studio.bio.match.title')}>
      <h4>{t('studio.bio.match.title')}</h4>
      <p className="muted small">{t('studio.bio.match.help')}</p>
      <p className="bio-panel__current" role="status">
        {selectedName
          ? t('studio.bio.match.selected', { name: selectedName })
          : t('studio.bio.match.noSelection')}
      </p>
      <ol className="bio-tasks">
        {score.results.map((r, i) => {
          const n = i + 1;
          const chosen = r.chosen ? L(COMPONENTS[r.chosen].name) : t('studio.bio.match.unanswered');
          return (
            <li
              key={r.task}
              className={cx('bio-task', checked && (r.correct ? 'is-right' : 'is-wrong'))}
            >
              <span className="bio-task__n">{t('studio.bio.match.task', { n })}</span>
              <p className="bio-task__role">{L(COMPONENTS[r.task].role)}</p>
              <div className="bio-task__foot">
                <span className="small">
                  {t('studio.bio.match.answer', { name: chosen })}
                  {checked && (
                    <strong className="bio-task__result">
                      {r.correct ? (
                        <CircleCheck size={14} aria-hidden="true" />
                      ) : (
                        <CircleX size={14} aria-hidden="true" />
                      )}
                      {t(r.correct ? 'studio.bio.match.right' : 'studio.bio.match.wrong')}
                    </strong>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!selected}
                  aria-label={t('studio.bio.match.assignLabel', { n, name: selectedName ?? '…' })}
                  onClick={() => {
                    if (selected) {
                      update((s) => withAnswer(s, tasks, r.task, selected, Date.now()));
                    }
                  }}
                >
                  {t('studio.bio.match.assign', { name: selectedName ?? '…' })}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="bio-panel__row">
        <button
          type="button"
          className="btn btn--accent"
          disabled={!score.complete}
          onClick={() => {
            update((s) => withMatchCheck(s, tasks, Date.now()));
          }}
        >
          <ListChecks size={16} aria-hidden="true" />
          {t('studio.bio.match.check')}
        </button>
        {checked && (
          <p className="bio-panel__current" role="status">
            {t('studio.bio.match.score', { correct: score.correct, total: score.total })}{' '}
            {score.correct < score.total && t('studio.bio.match.retry')}
          </p>
        )}
      </div>
      <DataNote cellType={b.cellType} />
    </section>
  );
}
