import { ArrowRight, Atom, GraduationCap, PencilRuler, ShieldCheck, Sparkles } from 'lucide-react';
import { openLab, openStudio } from '@/app/topics';
import { useT } from '@/app/i18n';
import { openTeacher } from '@/teacher/teacherStore';
import './learner.css';

/** A simple launch page: the simulator, the AI tutor and the guided Science Studio. */
export function LandingScreen() {
  const t = useT();
  return (
    <section className="launch" aria-labelledby="launch-title">
      <div className="launch__glow" aria-hidden="true">
        <span className="launch__blob launch__blob--1" />
        <span className="launch__blob launch__blob--2" />
        <span className="launch__blob launch__blob--3" />
        <span className="launch__blob launch__blob--4" />
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
          <button type="button" className="launch-card launch-card--teacher" onClick={openTeacher}>
            <span className="launch-card__icon">
              <GraduationCap size={27} strokeWidth={1.8} />
            </span>
            <span className="launch-card__copy">
              <strong>{t('landing.teacherTitle')}</strong>
              <span>{t('landing.teacherBody')}</span>
            </span>
            <ArrowRight className="launch-card__arrow" size={20} aria-hidden="true" />
          </button>
          <button type="button" className="launch-card launch-card--studio" onClick={openStudio}>
            <span className="launch-card__icon">
              <Atom size={26} strokeWidth={1.8} />
            </span>
            <span className="launch-card__copy">
              <strong>{t('landing.studioTitle')}</strong>
              <span>{t('landing.studioBody')}</span>
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
