import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ModuleEdge } from '@/app/bench/DriverGrid';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { moleculeById, prettyFormula } from '../data/molecules';
import { QUICK_MOLECULES, selectMolecule, useMoleculeStore, type MoleculeTopic } from './store';

/**
 * A molecule topic's bench edge (docs/BENCH_DESIGN.md §9.10): a stepper "‹ H₂O ›" through the
 * topic's suggested molecules (the stage's quick picks). Nothing here is filled.
 */
function MoleculeStepper({ topic }: { topic: MoleculeTopic }) {
  const Lz = useLocalized();
  const id = useMoleculeStore((s) => s.id);
  const list = QUICK_MOLECULES[topic];
  const i = list.indexOf(id);
  const go = (k: number) => {
    const next = list[k];
    if (next === undefined) return;
    selectMolecule(next);
    useMoleculeStore.setState({ query: '' });
  };
  const m = moleculeById(id);
  return (
    <ModuleEdge label={Lz(L('Chọn phân tử', 'Choose a molecule'))}>
      <div className="bench-edge__stepper">
        <IconButton
          icon={ChevronLeft}
          label={Lz(L('Phân tử trước', 'Previous molecule'))}
          tooltipSide="top"
          disabled={i === 0}
          onClick={() => {
            // A molecule from the search (not in the list) steps back to the list's end.
            go(i < 0 ? list.length - 1 : i - 1);
          }}
        />
        <span aria-live="polite">{m ? prettyFormula(m.display_formula) : ''}</span>
        <IconButton
          icon={ChevronRight}
          label={Lz(L('Phân tử sau', 'Next molecule'))}
          tooltipSide="top"
          disabled={i === list.length - 1}
          onClick={() => {
            go(i + 1);
          }}
        />
      </div>
    </ModuleEdge>
  );
}

export const Molecule3dDriver = () => <MoleculeStepper topic="molecule3d" />;
export const VseprDriver = () => <MoleculeStepper topic="vsepr" />;
export const PolarityDriver = () => <MoleculeStepper topic="bondPolarity" />;
