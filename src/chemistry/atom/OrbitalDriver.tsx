import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ModuleEdge } from '@/app/bench/DriverGrid';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { MAX_ORBITAL_N, stepN, useOrbitalStore } from './orbitalStore';

/**
 * Hydrogen orbitals on the bench edge (docs/BENCH_DESIGN.md §9.10, like the element stepper):
 * "‹ n = 2 ›" steps the principal quantum number. Nothing here is filled.
 */
export function OrbitalDriver() {
  const Lz = useLocalized();
  const { n, orbital } = useOrbitalStore();
  const go = (by: number) => {
    useOrbitalStore.setState(stepN(n, orbital, by));
  };
  return (
    <ModuleEdge label={Lz(L('Chọn mức n', 'Choose the level n'))}>
      <div className="bench-edge__stepper">
        <IconButton
          icon={ChevronLeft}
          label={Lz(L('Giảm n', 'Lower n'))}
          tooltipSide="top"
          disabled={n <= 1}
          onClick={() => {
            go(-1);
          }}
        />
        <span aria-live="polite">{`n = ${n}`}</span>
        <IconButton
          icon={ChevronRight}
          label={Lz(L('Tăng n', 'Raise n'))}
          tooltipSide="top"
          disabled={n >= MAX_ORBITAL_N}
          onClick={() => {
            go(1);
          }}
        />
      </div>
    </ModuleEdge>
  );
}
