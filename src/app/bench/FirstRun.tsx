import { Check, Clock, Cpu, KeyRound, Timer } from 'lucide-react';
import { useState } from 'react';
import { WEB_GEMMA_MODELS } from '@/ai/webGemmaModels';
import { useT } from '@/app/i18n';
import { ModalCard } from '@/app/learner/ModalCard';
import { finishProfileSteps } from '@/app/learner/onboardingPhase';
import { useProfileStore } from '@/app/learner/profileStore';
import { StepStrip } from '@/app/learner/StepStrip';
import { GRADE_CHOICES } from '@/app/levels';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { SUBJECTS, useWorkspaceStore, type SettingsSection } from '@/app/workspaceStore';
import { openGate } from '@/safety/safetyStore';
import { cx } from '@/ui/cx';

/**
 * The bench's first run (docs/BENCH_DESIGN.md §9.2): "Bước 1/3" profile (grade and subjects on
 * one page), the shared 18+ gate as step 2 (`AgeGate`), then "Bước 3/3" for 18+ without a key.
 * One filled button per step ("Tiếp"); the classic five-step onboarding stays as it is.
 */
export function BenchProfileStep() {
  const t = useT();
  const profile = useProfileStore();
  return (
    <ModalCard labelledBy="onboarding-title" onCancel={finishProfileSteps} className="first-run">
      <header className="dialog__header onboarding__header">
        <StepStrip i={1} n={3} />
        <h2 id="onboarding-title">{t('onboarding.levelTitle')}</h2>
      </header>
      <div className="dialog__body">
        <p className="onboarding__lead">{t('onboarding.levelBody')}</p>
        <div
          className="first-run__grades"
          role="radiogroup"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-grade-note"
        >
          {GRADE_CHOICES.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={profile.grade === g}
              className="onboarding__option"
              onClick={() => {
                profile.setGrade(g);
              }}
            >
              <span className="onboarding__option-name">
                {g === 'all' ? t('levels.all') : t('levels.grade', { grade: g })}
              </span>
            </button>
          ))}
        </div>
        <h3 id="first-run-subjects" className="first-run__subhead">
          {t('onboarding.subjectsTitle')}
        </h3>
        <div className="first-run__subjects" role="group" aria-labelledby="first-run-subjects">
          {SUBJECTS.map((s) => {
            const Icon = SUBJECT_ICON[s];
            const on = profile.interests.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                className={cx('onboarding__option onboarding__subject', `subject--${s}`)}
                onClick={() => {
                  profile.toggleInterest(s);
                }}
              >
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span className="onboarding__option-name">{t(`subjects.${s}`)}</span>
                {on && (
                  <Check
                    className="onboarding__check"
                    size={16}
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <p id="onboarding-grade-note" className="home__note first-run__note">
          <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('levels.sourceNote')}
        </p>
      </div>
      <footer className="dialog__footer first-run__footer">
        <button type="button" className="btn btn--ghost" onClick={finishProfileSteps}>
          {t('onboarding.skip')}
        </button>
        <button type="button" className="btn btn--accent" onClick={finishProfileSteps}>
          {t('onboarding.next')}
        </button>
      </footer>
    </ModalCard>
  );
}

type Choice = 'connect' | 'gemma' | 'later';
const GEMMA_SIZE = WEB_GEMMA_MODELS.find((m) => m.id === 'gemma3-1b')?.sizeLabel ?? '';

export function BenchConnectStep() {
  const t = useT();
  const finish = useProfileStore((s) => s.finishConnect);
  const [choice, setChoice] = useState<Choice>('connect');
  // Each choice only opens the page where the learner acts: nothing is saved or downloaded here.
  const pages: Record<Choice, SettingsSection | null> = {
    connect: 'ai',
    gemma: 'local',
    later: null,
  };
  const go = () => {
    finish();
    const page = pages[choice];
    if (page) useWorkspaceStore.getState().openSettingsAt(page);
  };
  const options: { id: Choice; icon: typeof KeyRound; name: string; desc: string }[] = [
    {
      id: 'connect',
      icon: KeyRound,
      name: t('onboarding.connectNow'),
      desc: t('bench.firstRun.connectDesc'),
    },
    {
      id: 'gemma',
      icon: Cpu,
      name: t('bench.firstRun.gemma'),
      desc: t('bench.firstRun.gemmaDesc', { size: GEMMA_SIZE }),
    },
    { id: 'later', icon: Timer, name: t('onboarding.later'), desc: t('onboarding.connectNote') },
  ];
  return (
    <ModalCard labelledBy="connect-title" onCancel={finish} className="first-run">
      <header className="dialog__header onboarding__header">
        <StepStrip i={3} n={3} />
        <h2 id="connect-title">{t('onboarding.connectTitle')}</h2>
      </header>
      <div className="dialog__body">
        <p className="onboarding__lead">{t('onboarding.connectBody')}</p>
        <div className="first-run__connect" role="radiogroup" aria-labelledby="connect-title">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={choice === o.id}
              className="onboarding__option"
              onClick={() => {
                setChoice(o.id);
              }}
            >
              <o.icon size={22} strokeWidth={1.5} aria-hidden="true" />
              <span className="onboarding__option-name">{o.name}</span>
              <span className="onboarding__option-desc">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <footer className="dialog__footer first-run__footer">
        <span className="first-run__ghosts">
          {/* Back to step 2: the 18+ question again, to change the answer (§9.2 footer). */}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              openGate({ firstRun: true });
            }}
          >
            {t('onboarding.back')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={finish}>
            {t('onboarding.skip')}
          </button>
        </span>
        <button type="button" className="btn btn--accent" onClick={go}>
          {t('onboarding.next')}
        </button>
      </footer>
    </ModalCard>
  );
}
