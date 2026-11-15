import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { moleculeById, prettyFormula } from '../data/molecules';

/** One button per species (the textbook formula), the chosen one pressed. */
export function MoleculeChips({
  ids,
  value,
  label,
  onPick,
}: {
  ids: readonly string[];
  value: string;
  label: LocalizedText;
  onPick: (id: string) => void;
}) {
  const Lz = useLocalized();
  return (
    <div className="mol-chips" role="group" aria-label={Lz(label)}>
      {ids.map((id) => {
        const m = moleculeById(id);
        if (!m) return null;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={id === value}
            title={Lz(m.name)}
            onClick={() => {
              onPick(id);
            }}
          >
            {prettyFormula(m.display_formula)}
          </button>
        );
      })}
    </div>
  );
}
