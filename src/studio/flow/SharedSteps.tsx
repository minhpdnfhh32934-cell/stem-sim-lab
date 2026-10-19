import {
  CheckCircle2,
  CircleHelp,
  Copy,
  Download,
  Lightbulb,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { saveFile, slugify } from '@/app/project/fileio';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { Source } from '@/core/data/dataset';
import { toast } from '@/ui/toast';
import { buildReport } from '../report';
import { ReviewNote } from '../ReviewNote';
import { learnerText, MAX_NOTE, withLearnerText } from '../session';
import { useStudioStore } from '../studioStore';
import { TeacherNote } from '../TeacherNote';
import { copyText } from './clipboard';
import type { StepProps, SubjectPlugin } from './types';

type WithPlugin = StepProps & { plugin: SubjectPlugin };

function NoteField({
  role,
  label,
  placeholder,
  session,
  update,
}: StepProps & { role: 'explanation' | 'conclusion'; label: string; placeholder: string }) {
  const id = useId();
  const t = useT();
  const text = learnerText(session, role);
  return (
    <div className="studio-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={4}
        maxLength={MAX_NOTE}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const value = e.target.value;
          update((s) => withLearnerText(s, role, value, Date.now()));
        }}
      />
      <p className="muted small">{t('studio.notes.private')}</p>
    </div>
  );
}

/** Explain: the learner's own words, with the scenario's questions and step-by-step hints. */
export function ExplainStep(props: StepProps) {
  const t = useT();
  const L = useLocalized();
  const { scenario, session } = props;
  const [shown, setShown] = useState(0);
  const min = scenario.completion.explanationMinChars;
  const count = learnerText(session, 'explanation').trim().length;
  return (
    <div className="studio-stack">
      {scenario.questions.length + scenario.hints.length > 0 && <TeacherNote scenario={scenario} />}
      {scenario.questions.length > 0 && (
        <ul className="studio-questions">
          {scenario.questions.map((q) => (
            <li key={q.vi}>
              <CircleHelp size={16} aria-hidden="true" />
              <span>{L(q)}</span>
            </li>
          ))}
        </ul>
      )}
      <NoteField
        {...props}
        role="explanation"
        label={t('studio.explain.label')}
        placeholder={t('studio.explain.placeholder')}
      />
      {min > 0 && <p className="muted small">{t('studio.explain.count', { n: count, min })}</p>}
      {scenario.hints.slice(0, shown).map((h, i) => (
        <p key={h.vi} className="studio-hint">
          <Lightbulb size={16} aria-hidden="true" />
          <span>
            <strong>{t('studio.explain.hintN', { n: i + 1 })}</strong> {L(h)}
          </span>
        </p>
      ))}
      {shown < scenario.hints.length && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setShown((n) => n + 1);
          }}
        >
          <Lightbulb size={16} aria-hidden="true" />
          {t('studio.explain.showHint', { n: shown + 1 })}
        </button>
      )}
    </div>
  );
}

/** Conclude: the prediction next to what the engine computed, then the learner's conclusion. */
export function ConcludeStep({ plugin, ...props }: WithPlugin) {
  const t = useT();
  const L = useLocalized();
  const { scenario, session } = props;
  const v = session.verdict;
  const result =
    !v || v.match === null
      ? t('studio.conclude.none')
      : v.match
        ? t('studio.conclude.match')
        : t('studio.conclude.miss');
  const wrote = learnerText(session, 'conclusion').trim().length > 0;
  const Facts = plugin.Facts;
  return (
    <div className="studio-stack">
      <div className="studio-verdict" data-match={v?.match ?? 'none'}>
        <p>{t('studio.conclude.predicted', { label: session.prediction?.label ?? '—' })}</p>
        {v?.correctLabel && <p>{t('studio.conclude.computed', { label: v.correctLabel })}</p>}
        <p className="studio-verdict__result">
          <Sparkles size={16} aria-hidden="true" />
          {result}
        </p>
      </div>
      {Facts && <Facts {...props} />}
      <NoteField
        {...props}
        role="conclusion"
        label={t('studio.conclude.label')}
        placeholder={t('studio.conclude.placeholder')}
      />
      {wrote && (
        <aside className="studio-expected">
          <h4>{t('studio.conclude.expected')}</h4>
          <p>{L(scenario.expectedConclusion)}</p>
          <TeacherNote scenario={scenario} />
          <ReviewNote status={scenario.review_status} />
        </aside>
      )}
    </div>
  );
}

/** Save/Report: a Markdown report built only from this session's evidence (view, save, copy). */
export function ReportStep({ plugin, ...props }: WithPlugin) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const restart = useStudioStore((s) => s.restart);
  const { scenario, session } = props;
  const [sources, setSources] = useState<Source[]>([]);
  const load = plugin.modelSources;

  useEffect(() => {
    let alive = true;
    if (load) {
      load(scenario, session)
        .then((s) => {
          if (alive) setSources(s);
        })
        .catch(() => {
          if (alive) setSources([]);
        });
    }
    return () => {
      alive = false;
    };
    // The sources depend on the inputs only; the session object changes on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, scenario, session.inputs]);

  const report = useMemo(
    () =>
      buildReport({
        scenario,
        session,
        locale,
        modelSources: sources,
        generatedAt: session.completedAt ?? session.updatedAt,
      }),
    [scenario, session, locale, sources],
  );

  const onSave = async () => {
    try {
      const saved = await saveFile({
        name: `${slugify(L(scenario.title))}.md`,
        filterName: 'Markdown',
        extensions: ['md'],
        contents: report,
      });
      if (saved) toast(t('project.saved', { name: saved }), 'success');
    } catch (e) {
      console.error(e);
      toast(t('project.saveFailed'), 'error');
    }
  };

  const onCopy = async () => {
    const ok = await copyText(report);
    toast(t(ok ? 'studio.report.copied' : 'studio.report.copyFailed'), ok ? 'success' : 'error');
  };

  return (
    <div className="studio-stack">
      {session.completedAt !== null && (
        <p className="studio-done">
          <CheckCircle2 size={18} aria-hidden="true" />
          {t('studio.report.done')}
        </p>
      )}
      <pre className="studio-report" tabIndex={0} aria-label={t('studio.report.preview')}>
        {report}
      </pre>
      <div className="studio-actions">
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => {
            void onSave();
          }}
        >
          <Download size={16} aria-hidden="true" />
          {t('studio.report.save')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            void onCopy();
          }}
        >
          <Copy size={16} aria-hidden="true" />
          {t('studio.report.copy')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            restart(scenario);
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t('studio.report.restart')}
        </button>
      </div>
    </div>
  );
}
