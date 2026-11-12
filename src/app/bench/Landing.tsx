import { GraduationCap, Info, Lock, PencilRuler, RotateCcw, ShieldCheck } from 'lucide-react';
import { useT } from '@/app/i18n';
import { useProfileStore } from '@/app/learner/profileStore';
import { openLab, openTopic, subjectOf } from '@/app/topics';
import { useSafetyStore } from '@/safety/safetyStore';
import { openTeacher } from '@/teacher/teacherStore';
import { SceneStill } from './SceneStill';

/**
 * "Cửa vào" (docs/BENCH_DESIGN.md §9.1): two doors, Virtual Lab (the only filled element) and
 * AI Teacher (outlined; a locked card for a learner who said they are under 18), a "Tiếp tục"
 * text button for a returning learner, and the notes: AI Teacher can be wrong (moved off its card,
 * which now says what it does, #205 B1) and the privacy line. Science Studio stays inside the lab
 * (user decision 2026-10-20).
 */
export function BenchLanding() {
  const t = useT();
  const lastTopic = useProfileStore((s) => s.lastTopic);
  const minor = useSafetyStore((s) => s.status?.minor === true);
  const lastSubject = lastTopic ? subjectOf(lastTopic) : undefined;

  return (
    <section className="bench-launch" aria-labelledby="launch-title">
      <div className="bench-launch__main">
        <p className="bench-launch__eyebrow">{t('bench.launchEyebrow')}</p>
        <h1 id="launch-title" className="bench-launch__title">
          {t('landing.title')}
        </h1>
        <p className="bench-launch__subtitle">{t('landing.subtitle')}</p>
        <div className="bench-launch__doors">
          <button
            type="button"
            className="launch-card launch-card--lab bench-door bench-door--lab"
            onClick={openLab}
          >
            <PencilRuler size={28} strokeWidth={1.75} aria-hidden="true" />
            <strong>{t('landing.labTitle')}</strong>
            <span>{t('landing.labBody')}</span>
          </button>
          {minor ? (
            <div className="bench-door bench-door--locked">
              <Lock size={28} strokeWidth={1.75} aria-hidden="true" />
              <strong>{t('landing.teacherTitle')}</strong>
              <span>{t('bench.teacherLocked')}</span>
            </div>
          ) : (
            <button
              type="button"
              className="launch-card launch-card--teacher bench-door"
              onClick={openTeacher}
            >
              <GraduationCap size={28} strokeWidth={1.75} aria-hidden="true" />
              <strong>{t('landing.teacherTitle')}</strong>
              <span>{t('bench.teacherDoorBody')}</span>
            </button>
          )}
        </div>
        {lastTopic && lastSubject && (
          <button
            type="button"
            className="btn bench-launch__resume"
            onClick={() => {
              void openTopic(lastTopic);
            }}
          >
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
            {t('bench.resume', {
              topic: t(`topics.${lastTopic}` as Parameters<typeof t>[0]),
              subject: t(`subjects.${lastSubject}`),
            })}
          </button>
        )}
        <div className="bench-launch__notes">
          {!minor && (
            <p className="bench-launch__note">
              <Info size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{t('bench.teacherDoorNote')}</span>
            </p>
          )}
          <p className="bench-launch__note">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{t('landing.privacy')}</span>
          </p>
        </div>
      </div>
      {/* "Bench still" (§9.1): one frame the projectile engine computes, drawn once when idle. */}
      <figure className="bench-launch__still">
        <SceneStill topic="obliqueProjectile" className="bench-launch__canvas" />
        <figcaption>{t('bench.stillCaption')}</figcaption>
      </figure>
    </section>
  );
}
