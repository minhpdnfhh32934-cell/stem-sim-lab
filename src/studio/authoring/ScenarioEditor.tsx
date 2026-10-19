import { useId, useState } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { StudioScenario } from '../scenario';
import { BiologyFields } from './BiologyFields';
import type { AuthorIssue } from './check';
import { ChemistryFields } from './ChemistryFields';
import { MAX_MIN_CHARS, type AuthorDraft, type ListField } from './draft';
import { issueText } from './issueText';
import { PhysicsFields } from './PhysicsFields';
import { saveDraft } from './service';
import { PairField } from './TextFields';

const LEVELS = ['foundation', 'general'] as const;
const DIFFICULTIES = ['intro', 'core', 'stretch'] as const;
const LISTS: readonly ListField[] = ['objectives', 'questions', 'hints', 'assumptions', 'limits'];

interface Props {
  initial: AuthorDraft;
  /** Called with the saved scenario, or null when the teacher cancelled. */
  onDone: (saved: StudioScenario | null) => void;
}

/** Create/edit form: engine choices first, then the teacher's own text. */
export function ScenarioEditor({ initial, onDone }: Props) {
  const t = useT();
  const L = useLocalized();
  const ids = useId();
  const [draft, setDraft] = useState(initial);
  const [issues, setIssues] = useState<AuthorIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const subject = t(`studio.tabs.${draft.base.subject}`);
  const props = { draft, onChange: setDraft };

  const save = async () => {
    setSaving(true);
    const r = await saveDraft(draft);
    setSaving(false);
    if (r.ok) onDone(r.scenario);
    else setIssues(r.issues);
  };

  return (
    <form
      className="author-editor"
      aria-label={t(`studio.authoring.editor.${draft.id ? 'editTitle' : 'newTitle'}`, { subject })}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2>{t(`studio.authoring.editor.${draft.id ? 'editTitle' : 'newTitle'}`, { subject })}</h2>

      <section className="author-section">
        <h3>{t('studio.authoring.editor.enginePart')}</h3>
        <p className="muted small">{t('studio.authoring.editor.engineHint')}</p>
        {draft.binding.kind === 'physics' && <PhysicsFields {...props} />}
        {draft.binding.kind === 'chemistry' && <ChemistryFields {...props} />}
        {draft.binding.kind === 'biology' && <BiologyFields {...props} />}
      </section>

      <section className="author-section">
        <h3>{t('studio.authoring.editor.teacherPart')}</h3>
        <p className="muted small">{t('studio.authoring.editor.teacherHint')}</p>
        <PairField
          label={t('studio.authoring.editor.fields.title')}
          value={draft.title}
          onChange={(title) => {
            setDraft({ ...draft, title });
          }}
        />
        <div className="author-row">
          <label className="author-select">
            <span>{t('studio.authoring.editor.fields.level')}</span>
            <select
              value={draft.level}
              onChange={(e) => {
                const level = LEVELS.find((l) => l === e.target.value);
                if (level) setDraft({ ...draft, level });
              }}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`levels.${l}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="author-select">
            <span>{t('studio.authoring.editor.fields.difficulty')}</span>
            <select
              value={draft.difficulty}
              onChange={(e) => {
                const difficulty = DIFFICULTIES.find((l) => l === e.target.value);
                if (difficulty) setDraft({ ...draft, difficulty });
              }}
            >
              {DIFFICULTIES.map((l) => (
                <option key={l} value={l}>
                  {t(`studio.difficulty.${l}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {LISTS.map((field) => (
          <PairField
            key={field}
            label={t(`studio.authoring.editor.fields.${field}`)}
            value={draft[field]}
            list
            onChange={(value) => {
              setDraft({ ...draft, [field]: value });
            }}
          />
        ))}
        <PairField
          label={t('studio.authoring.editor.fields.expectedConclusion')}
          value={draft.expectedConclusion}
          multiline
          onChange={(expectedConclusion) => {
            setDraft({ ...draft, expectedConclusion });
          }}
        />
        <div className="studio-field">
          <label htmlFor={`${ids}-sources`}>{t('studio.authoring.editor.fields.sources')}</label>
          <p className="muted small">{t('studio.authoring.editor.fields.sourcesHint')}</p>
          <textarea
            id={`${ids}-sources`}
            rows={3}
            value={draft.sources}
            onChange={(e) => {
              setDraft({ ...draft, sources: e.target.value });
            }}
          />
        </div>
        <label className="author-select">
          <span>{t('studio.authoring.editor.fields.minChars')}</span>
          <input
            type="number"
            min={0}
            max={MAX_MIN_CHARS}
            step={1}
            value={Number.isFinite(draft.explanationMinChars) ? draft.explanationMinChars : ''}
            onChange={(e) => {
              setDraft({
                ...draft,
                explanationMinChars: e.target.value === '' ? Number.NaN : Number(e.target.value),
              });
            }}
          />
        </label>
      </section>

      {issues.length > 0 && (
        <div className="author-issues" role="alert">
          <p>{t('studio.authoring.editor.issues')}</p>
          <ul>
            {issues.map((issue, i) => (
              <li key={`${issue.code}-${String(i)}`}>{issueText(t, L, issue)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="studio-actions">
        <button type="submit" className="btn btn--accent" disabled={saving}>
          {t(saving ? 'studio.authoring.editor.saving' : 'studio.authoring.editor.save')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            onDone(null);
          }}
        >
          {t('studio.authoring.editor.cancel')}
        </button>
      </div>
    </form>
  );
}
