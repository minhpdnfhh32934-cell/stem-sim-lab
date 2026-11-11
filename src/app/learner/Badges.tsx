import { Award } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useT, type MessageKey } from '@/app/i18n';
import { earnedBadges } from '@/learn/progress';
import { useProgressStore } from '@/learn/progressStore';
import './learner.css';

/** Badges earned (A4.1: healthy motivation — specific, no streaks or rankings). */
export function Badges() {
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
