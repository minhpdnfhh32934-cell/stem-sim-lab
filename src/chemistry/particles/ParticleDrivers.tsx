import { RotateCcw } from 'lucide-react';
import { EdgePlay, ModuleEdge } from '@/app/bench/DriverGrid';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { resetEq, useEqStore } from './eqStore';
import { resetGas, useGasStore } from './gasStore';

/** The particle views' standard time driver on the bench edge: D0 Chạy, D3 restart (§9.10). */
function TimeEdge({
  running,
  toggle,
  restartLabel,
  restart,
}: {
  running: boolean;
  toggle: () => void;
  restartLabel: string;
  restart: () => void;
}) {
  const Lz = useLocalized();
  return (
    <ModuleEdge label={Lz(L('Điều khiển thời gian', 'Time controls'))}>
      <EdgePlay playing={running} onClick={toggle} />
      <IconButton
        className="bench-edge__d3"
        icon={RotateCcw}
        label={restartLabel}
        tooltipSide="top"
        animation="spin"
        onClick={restart}
      />
    </ModuleEdge>
  );
}

export function GasDriver() {
  const Lz = useLocalized();
  const running = useGasStore((s) => s.running);
  return (
    <TimeEdge
      running={running}
      toggle={() => {
        useGasStore.setState((s) => ({ running: !s.running }));
      }}
      restartLabel={Lz(L('Làm lại từ đầu', 'Restart'))}
      restart={resetGas}
    />
  );
}

export function EquilibriumDriver() {
  const Lz = useLocalized();
  const running = useEqStore((s) => s.running);
  return (
    <TimeEdge
      running={running}
      toggle={() => {
        useEqStore.setState((x) => ({ running: !x.running, stalled: false }));
      }}
      restartLabel={Lz(L('Làm lại', 'Restart'))}
      restart={resetEq}
    />
  );
}
