import { ArrowRight, Award, GraduationCap, PencilRuler, Play, Sparkles } from 'lucide-react';
import { earnedBadges } from '@/learn/progress';
import { useProgressStore } from '@/learn/progressStore';
import { useId, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { openManual, useAnalyzeStore } from '@/app/ai/analyze';
import { submitProblem } from '@/app/ai/submit';
import { useT, type MessageKey } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { availableCount, suggestions } from '@/app/levels';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { openTopic, subjectOf } from '@/app/topics';
import { SUBJECTS, useWorkspaceStore, type Subject } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { cx } from '@/ui/cx';
import { openTeacher } from '@/teacher/teacherStore';
import { useProfileStore } from './profileStore';
import './learner.css';

/**
 * The AI teacher interface sketch (T0) is reachable only in development builds until the user
 * approves it; released installers keep the "Sắp có" card.
 */
const TEACHER_PREVIEW = import.meta.env.DEV;

/**
 * Home screen "Hôm nay học gì?" (PROMPT_PHAN_2 A4.2), shown while no topic is open:
 * continue the last lesson, paste a problem, pick a subject, suggested topics for the level,
 * the (coming) AI teacher. The AI connection state is the pill in the top-right corner.
 */
export function HomeScreen() {
  const t = useT();
  const profile = useProfileStore(
    useShallow((s) => ({ level: s.level, interests: s.interests, lastTopic: s.lastTopic })),
  );
  const lastSubject = profile.lastTopic ? subjectOf(profile.lastTopic) : undefined;
  const picks = suggestions(profile.level, profile.interests);

  return (
    <section className="home" aria-labelledby="home-title">
      <div className="home__inner">
        <header className="home__header">
          <div>
            <h1 id="home-title" className="home__title">
              {t('home.title')}
            </h1>
            <p className="home__subtitle">{t('home.subtitle')}</p>
          </div>
        </header>

        {profile.lastTopic && lastSubject && (
          <button
            type="button"
            className={cx('btn btn--accent home__continue', `subject--${lastSubject}`)}
            onClick={() => {
              void openTopic(profile.lastTopic ?? '');
            }}
          >
            <Play size={18} strokeWidth={2} aria-hidden="true" />
            <span className="home__continue-text">
              <span>{t('home.continue')}</span>
              <strong>{t(`topics.${profile.lastTopic}` as MessageKey)}</strong>
            </span>
          </button>
        )}

        <ProblemBox />

        <h2 className="home__heading">{t('home.subjectsTitle')}</h2>
        <ul className="home__subjects">
          {SUBJECTS.map((s) => (
            <li key={s}>
              <SubjectCard subject={s} level={profile.level} />
            </li>
          ))}
        </ul>

        <h2 className="home__heading">
          {t('home.suggestedTitle', { level: t(`levels.${profile.level}`) })}
        </h2>
        {picks.length > 0 ? (
          <ul className="home__topics">
            {picks.map(({ subject, topic }) => {
              const Icon = SUBJECT_ICON[subject];
              return (
                <li key={topic.id}>
                  <button
                    type="button"
                    className={cx('home__topic', `subject--${subject}`)}
                    aria-label={`${t(topic.titleKey)} · ${t(`subjects.${subject}`)}`}
                    onClick={() => {
                      void openTopic(topic.id);
                    }}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span>{t(topic.titleKey)}</span>
                    <ArrowRight
                      className="home__topic-arrow"
                      size={15}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="home__note">{t('home.noSuggestions')}</p>
        )}

        <Badges />

        <div className="home__teacher">
          <GraduationCap size={22} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="home__teacher-title">
              {t('home.teacherTitle')}
              <span className="home__soon">{t('home.comingSoon')}</span>
            </p>
            <p className="home__note">{t('home.teacherBody')}</p>
          </div>
          {TEACHER_PREVIEW && (
            <button type="button" className="btn home__teacher-open" onClick={openTeacher}>
              {t('home.teacherOpen')}
            </button>
          )}
        </div>

        <p className="home__note home__footnote">{t('home.noAiNote')}</p>
      </div>
    </section>
  );
}

/** Badges earned (A4.1: healthy motivation — specific, no streaks or rankings). */
function Badges() {
  const t = useT();
  const progress = useProgressStore(
    useShallow((s) => ({
      visited: s.visited,
      challenges: s.challenges,
      predictions: s.predictions,
    })),
  );
  const badges = earnedBadges(progress);
  return (
    <>
      <h2 className="home__heading">{t('learn.badgesTitle')}</h2>
      {badges.length === 0 ? (
        <p className="home__note">{t('learn.noBadges')}</p>
      ) : (
        <ul className="home__badges">
          {badges.map((b) => {
            const params = { ...b.params };
            if (typeof params.chapter === 'string')
              params.chapter = t(params.chapter as MessageKey);
            return (
              <li key={b.id} className="home__badge">
                <Award size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>
                  <strong>{t(b.title)}</strong>
                  <span className="home__badge-desc">{t(b.desc, params)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ProblemBox() {
  const t = useT();
  const id = useId();
  const { problemText, setProblemText } = useWorkspaceStore(
    useShallow((s) => ({ problemText: s.problemText, setProblemText: s.setProblemText })),
  );
  const running = useAnalyzeStore((s) => s.phase === 'running');
  const ai = useAiStore(useShallow((s) => ({ provider: s.provider, status: s.status })));
  const needsKey = ai.provider !== 'off' && ai.status === 'noKey';
  const canAnalyze = ai.provider !== 'off' && !running && problemText.trim().length > 0;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitProblem(problemText);
    }
  };

  return (
    <div className="home__problem" data-tour="problem">
      <label htmlFor={id} className="home__problem-label">
        {t('home.problemLabel')}
      </label>
      <textarea
        id={id}
        className="home__problem-field"
        rows={3}
        placeholder={t('home.problemPlaceholder')}
        value={problemText}
        spellCheck={false}
        onChange={(e) => {
          setProblemText(e.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="home__problem-actions">
        <button
          type="button"
          className="btn btn--accent"
          disabled={!canAnalyze && !needsKey}
          onClick={() => {
            submitProblem(problemText);
          }}
        >
          <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
          {needsKey ? t('home.connectFirst') : t('home.analyze')}
        </button>
        <button
          type="button"
          className="btn"
          aria-label={t('topbar.manual')}
          onClick={() => {
            void openManual();
          }}
        >
          <PencilRuler size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('home.manual')}
        </button>
      </div>
    </div>
  );
}

function SubjectCard({ subject, level }: { subject: Subject; level: 'foundation' | 'general' }) {
  const t = useT();
  const Icon = SUBJECT_ICON[subject];
  const current = useWorkspaceStore((s) => s.subject);
  const count = availableCount(level, subject);
  return (
    <button
      type="button"
      className={cx('home__subject', `subject--${subject}`)}
      aria-pressed={current === subject}
      onClick={() => {
        useWorkspaceStore.getState().setSubject(subject);
        // The library lists the subject's topics (Level → Subject → Topic).
        useLayoutStore.getState().setLeftTab('library');
      }}
    >
      <span className="home__subject-art" aria-hidden="true">
        <Icon size={30} strokeWidth={1.5} />
      </span>
      <span className="home__subject-name">{t(`subjects.${subject}`)}</span>
      <span className="home__subject-desc">{t(`home.subjectDesc.${subject}`)}</span>
      <span className="home__subject-count">{t('home.topicCount', { count })}</span>
    </button>
  );
}
