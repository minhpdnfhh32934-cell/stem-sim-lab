import { Copy, Download, Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { toast } from '@/ui/toast';
import { ReviewNote } from '../ReviewNote';
import { STUDIO_SUBJECTS, type StudioScenario } from '../scenario';
import { TeacherNote } from '../TeacherNote';
import { useAuthoringStore } from './authoringStore';
import type { AuthorIssue } from './check';
import { newDraft, toDraft, type AuthorDraft } from './draft';
import { issueText } from './issueText';
import { ScenarioEditor } from './ScenarioEditor';
import {
  deleteScenario,
  duplicateScenario,
  exportScenarioFile,
  importScenarioFile,
  previewScenario,
} from './service';
import './authoring.css';

function ScenarioItem({
  scenario,
  onEdit,
  onIssues,
}: {
  scenario: StudioScenario;
  onEdit: (s: StudioScenario) => void;
  /** Problems of the last row action (empty = it worked). */
  onIssues: (issues: AuthorIssue[]) => void;
}) {
  const t = useT();
  const L = useLocalized();
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="author-item">
      <div>
        <h3>{L(scenario.title)}</h3>
        <p className="muted small">
          {t(`studio.tabs.${scenario.subject}`)} · {t(`levels.${scenario.level}`)} ·{' '}
          {t(`studio.difficulty.${scenario.difficulty}`)}
        </p>
        <TeacherNote scenario={scenario} />
        <ReviewNote status={scenario.review_status} />
      </div>
      <div className="studio-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            previewScenario(scenario);
          }}
        >
          <Eye size={16} aria-hidden="true" />
          {t('studio.authoring.actions.preview')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            onEdit(scenario);
          }}
        >
          <Pencil size={16} aria-hidden="true" />
          {t('studio.authoring.actions.edit')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            const r = duplicateScenario(scenario.id);
            if (r) onIssues(r.ok ? [] : r.issues);
          }}
        >
          <Copy size={16} aria-hidden="true" />
          {t('studio.authoring.actions.duplicate')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            void exportScenarioFile(scenario).then((name) => {
              if (name) toast(t('studio.authoring.exported', { name }), 'success');
            });
          }}
        >
          <Download size={16} aria-hidden="true" />
          {t('studio.authoring.actions.export')}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                const issues = deleteScenario(scenario.id);
                if (issues.length > 0) setConfirming(false);
                onIssues(issues);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              {t('studio.authoring.actions.confirmDelete')}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('studio.authoring.actions.cancel')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setConfirming(true);
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            {t('studio.authoring.actions.delete')}
          </button>
        )}
      </div>
    </li>
  );
}

/** Soạn bài: the teacher's local scenarios; preview opens each one in its own studio. */
export function AuthoringPane() {
  const t = useT();
  const L = useLocalized();
  const scenarios = useAuthoringStore((s) => s.scenarios);
  const [editing, setEditing] = useState<AuthorDraft | null>(null);
  const [picking, setPicking] = useState(false);
  const [failure, setFailure] = useState<{
    kind: 'import' | 'action';
    issues: AuthorIssue[];
  } | null>(null);

  if (editing) {
    return (
      <ScenarioEditor
        initial={editing}
        onDone={(saved) => {
          setEditing(null);
          if (saved) toast(t('studio.authoring.saved', { title: L(saved.title) }), 'success');
        }}
      />
    );
  }

  const runImport = async () => {
    const r = await importScenarioFile();
    if (!r) return;
    if (r.ok) {
      setFailure(null);
      toast(t('studio.authoring.imported', { title: L(r.scenario.title) }), 'success');
    } else {
      setFailure({ kind: 'import', issues: r.issues });
    }
  };

  return (
    <div className="studio-pane author-pane">
      <p className="muted">{t('studio.authoring.intro')}</p>
      <div className="studio-actions">
        <button
          type="button"
          className="btn btn--accent"
          aria-expanded={picking}
          onClick={() => {
            setPicking(!picking);
          }}
        >
          <Plus size={16} aria-hidden="true" />
          {t('studio.authoring.create')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            void runImport();
          }}
        >
          <Upload size={16} aria-hidden="true" />
          {t('studio.authoring.import')}
        </button>
      </div>
      {picking && (
        <div className="studio-picker" role="group" aria-label={t('studio.authoring.pickSubject')}>
          {STUDIO_SUBJECTS.map((subject) => {
            const draft = newDraft(subject);
            return (
              <button
                key={subject}
                type="button"
                className="btn btn--ghost"
                disabled={!draft}
                onClick={() => {
                  setPicking(false);
                  setEditing(draft);
                }}
              >
                {t(`studio.tabs.${subject}`)}
              </button>
            );
          })}
        </div>
      )}
      {failure && (
        <div className="author-issues" role="alert">
          <p>
            {t(
              failure.kind === 'import'
                ? 'studio.authoring.importFailed'
                : 'studio.authoring.actionFailed',
            )}
          </p>
          <ul>
            {failure.issues.map((issue, i) => (
              <li key={`${issue.code}-${String(i)}`}>{issueText(t, L, issue)}</li>
            ))}
          </ul>
        </div>
      )}
      {scenarios.length === 0 ? (
        <p className="muted">{t('studio.authoring.empty')}</p>
      ) : (
        <ul className="author-list" aria-label={t('studio.authoring.listLabel')}>
          {scenarios.map((s) => (
            <ScenarioItem
              key={s.id}
              scenario={s}
              onEdit={(x) => {
                setEditing(toDraft(x, x.id));
              }}
              onIssues={(issues) => {
                setFailure(issues.length > 0 ? { kind: 'action', issues } : null);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
