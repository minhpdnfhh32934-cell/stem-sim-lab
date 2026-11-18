import {
  Apple,
  ArrowRight,
  Atom,
  Dna,
  FlaskConical,
  GraduationCap,
  Magnet,
  Microscope,
  Orbit,
  PencilRuler,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { openLab } from '@/app/topics';
import { useT } from '@/app/i18n';
import { teacherLocked, useSafetyStore } from '@/safety/safetyStore';
import { openTeacher } from '@/teacher/teacherStore';
import './learner.css';

/**
 * A simple launch page: the lab and the AI tutor. Science Studio lives inside the lab (user
 * decision 2026-10-20): do not add a Science Studio card back here.
 */
export function LandingScreen() {
  const t = useT();
  // Said "under 18": openTeacher refuses, so the card is off and says why (#246).
  const locked = useSafetyStore(teacherLocked);
  return (
    <section className="launch" aria-labelledby="launch-title">
      <div className="launch__glow" aria-hidden="true">
        <span className="launch__blob launch__blob--1" />
        <span className="launch__blob launch__blob--2" />
        <span className="launch__blob launch__blob--3" />
        <span className="launch__blob launch__blob--4" />
      </div>
      {/* Subject shapes drifting slowly behind the page (src/app/fx/fx.css), like the game's menu. */}
      <div className="launch__drift" aria-hidden="true">
        <FlaskConical className="launch__float launch__float--chemistry" size={54} />
        <Dna className="launch__float launch__float--biology" size={60} />
        <Apple className="launch__float launch__float--physics" size={46} />
        <Atom className="launch__float launch__float--chemistry" size={58} />
        <Magnet className="launch__float launch__float--physics" size={40} />
        <Microscope className="launch__float launch__float--biology" size={44} />
        <Orbit className="launch__float launch__float--physics" size={36} />
        <span className="launch__pendulum" />
      </div>
      <div className="launch__inner">
        <div className="launch__eyebrow">
          <Sparkles size={16} aria-hidden="true" />
          <span>{t('landing.eyebrow')}</span>
        </div>
        <h1 id="launch-title" className="launch__title">
          {t('landing.title')}
        </h1>
        <p className="launch__subtitle">{t('landing.subtitle')}</p>

        <div className="launch__cards">
          <button type="button" className="launch-card launch-card--lab" onClick={openLab}>
            <span className="launch-card__icon">
              <PencilRuler size={26} strokeWidth={1.8} />
            </span>
            <span className="launch-card__copy">
              <strong>{t('landing.labTitle')}</strong>
              <span>{t('landing.labBody')}</span>
            </span>
            <ArrowRight className="launch-card__arrow" size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="launch-card launch-card--teacher"
            disabled={locked}
            onClick={openTeacher}
          >
            <span className="launch-card__icon">
              <GraduationCap size={27} strokeWidth={1.8} />
            </span>
            <span className="launch-card__copy">
              <strong>{t('landing.teacherTitle')}</strong>
              <span>{t(locked ? 'teacher.ageLocked' : 'landing.teacherBody')}</span>
            </span>
            <ArrowRight className="launch-card__arrow" size={20} aria-hidden="true" />
          </button>
        </div>

        <p className="launch__privacy">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{t('landing.privacy')}</span>
        </p>
      </div>
    </section>
  );
}
