import { NumberField } from '@/ui/NumberField';
import './moduleControls.css';

/**
 * Inspector controls shared by the physics modules with their own panel (heat, gas laws, magnetic
 * force, induction): a number box with its name shown above it, and a group of choices.
 */
export function LabeledNumber(props: Parameters<typeof NumberField>[0]) {
  return (
    <label className="module-field">
      <span>{props.label}</span>
      <NumberField {...props} />
    </label>
  );
}

/** One choice out of a few: radio buttons, as a segmented bar or as a row of buttons. */
export function ChoiceGroup<T extends string>({
  label,
  items,
  value,
  name,
  onPick,
  segmented = false,
}: {
  label: string;
  items: readonly T[];
  value: T;
  name: (t: T) => string;
  onPick: (t: T) => void;
  segmented?: boolean;
}) {
  return (
    <div
      className={segmented ? 'segmented' : 'module-choices'}
      role="radiogroup"
      aria-label={label}
    >
      {items.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          className={segmented ? 'segmented__item' : 'btn btn--ghost'}
          onClick={() => {
            onPick(t);
          }}
        >
          {name(t)}
        </button>
      ))}
    </div>
  );
}

/** A row of plain buttons (for example the book's questions to load). */
export function ActionRow<T extends string>({
  label,
  items,
  name,
  onPick,
}: {
  label: string;
  items: readonly T[];
  name: (t: T) => string;
  onPick: (t: T) => void;
}) {
  return (
    <div className="module-choices" role="group" aria-label={label}>
      {items.map((t) => (
        <button
          key={t}
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            onPick(t);
          }}
        >
          {name(t)}
        </button>
      ))}
    </div>
  );
}
