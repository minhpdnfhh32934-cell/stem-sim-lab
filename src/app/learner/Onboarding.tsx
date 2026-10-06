import { Check, KeyRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import { LEVELS } from '@/app/levels';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { cx } from '@/ui/cx';
import { useOnboardingPhase } from './onboardingPhase';
import { useProfileStore } from './profileStore';
import './learner.css';

type Step = 'level' | 'subjects';
/** Main: level, subjects, (gate), (connect), (tour) = 5 steps. Pilot: subject, (gate), (tour). */
const STEPS: Step[] = __EDITION__ === 'pilot' ? ['subjects'] : ['level', 'subjects'];
const TOTAL = __EDITION__ === 'pilot' ? 3 : 5;

/** First-run onboarding: profile steps, then (after the age gate) "Kết nối AI" in main. */
export function Onboarding() {
  const phase = useOnboardingPhase();
  if (phase === 'profile') return <ProfileSteps />;
  if (phase === 'connect') return <ConnectStep />;
  return null;
}

function ModalCard({
  labelledBy,
  onCancel,
  children,
}: {
  labelledBy: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog onboarding"
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      {children}
    </dialog>
  );
}

function ProfileSteps() {
  const t = useT();
  const [index, setIndex] = useState(0);
  const profile = useProfileStore();
  const step = STEPS[index] ?? 'subjects';
  const last = index === STEPS.length - 1;
  const finish = () => {
    // The first chosen subject becomes the open subject in the library.
    const first = useProfileStore.getState().interests[0];
    if (first) useWorkspaceStore.getState().setSubject(first);
    profile.finishProfile();
  };

  return (
    <ModalCard labelledBy="onboarding-title" onCancel={finish}>
      <header className="dialog__header onboarding__header">
        <p className="onboarding__step">{t('onboarding.step', { i: index + 1, n: TOTAL })}</p>
        <h2 id="onboarding-title">
          {t(step === 'level' ? 'onboarding.levelTitle' : 'onboarding.subjectsTitle')}
        </h2>
      </header>
      <div className="dialog__body">
        <p className="onboarding__lead">
          {t(step === 'level' ? 'onboarding.levelBody' : 'onboarding.subjectsBody')}
        </p>
        {step === 'level' ? (
          <div className="onboarding__options" role="radiogroup" aria-labelledby="onboarding-title">
            {LEVELS.map((l) => {
              const planned = l.status === 'planned';
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={profile.level === l.id}
                  disabled={planned}
                  className="onboarding__option"
                  onClick={() => {
                    profile.setLevel(l.id);
                  }}
                >
                  <span className="onboarding__option-name">
                    {t(`levels.${l.id}`)}
                    {planned && <span className="home__soon">{t('levels.soon')}</span>}
                  </span>
                  <span className="onboarding__option-desc">
                    {t(l.id === 'foundation' ? 'levels.foundationDesc' : 'levels.generalDesc')}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="onboarding__options onboarding__options--row">
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
                  <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
                  <span className="onboarding__option-name">{t(`subjects.${s}`)}</span>
                  <span className="onboarding__option-desc">{t(`home.subjectDesc.${s}`)}</span>
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
        )}
      </div>
      <footer className="dialog__footer">
        <button type="button" className="btn btn--ghost" onClick={finish}>
          {t('onboarding.skip')}
        </button>
        {index > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setIndex(index - 1);
            }}
          >
            {t('onboarding.back')}
          </button>
        )}
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => {
            if (last) finish();
            else setIndex(index + 1);
          }}
        >
          {t(last ? 'onboarding.finish' : 'onboarding.next')}
        </button>
      </footer>
    </ModalCard>
  );
}

function ConnectStep() {
  const t = useT();
  const finish = useProfileStore((s) => s.finishConnect);
  return (
    <ModalCard labelledBy="connect-title" onCancel={finish}>
      <header className="dialog__header onboarding__header">
        <p className="onboarding__step">{t('onboarding.step', { i: 4, n: TOTAL })}</p>
        <h2 id="connect-title">{t('onboarding.connectTitle')}</h2>
      </header>
      <div className="dialog__body">
        <p className="onboarding__lead">{t('onboarding.connectBody')}</p>
        <p className="home__note">{t('onboarding.connectNote')}</p>
      </div>
      <footer className="dialog__footer">
        <button type="button" className="btn" onClick={finish}>
          {t('onboarding.later')}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => {
            finish();
            useWorkspaceStore.getState().setSettingsOpen(true);
          }}
        >
          <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('onboarding.connectNow')}
        </button>
      </footer>
    </ModalCard>
  );
}
