import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';

const SPARKS = 8;

/**
 * A small, one-time burst around an icon when a learner reaches a goal (gallery pattern 093):
 * a ring and a few dots, under a second, no sound, no score. Under reduced motion only the icon
 * is shown. Decorative: the success text next to it carries the meaning.
 */
export function Celebrate({ icon: Icon, size = 16 }: { icon: LucideIcon; size?: number }) {
  return (
    <span className="celebrate" aria-hidden="true">
      <Icon size={size} strokeWidth={2} className="celebrate__icon" />
      <span className="celebrate__ring" />
      {Array.from({ length: SPARKS }, (_, i) => (
        <span
          key={i}
          className="celebrate__spark"
          style={{ '--a': `${String((360 / SPARKS) * i)}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}
