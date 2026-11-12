import { SpeedChart } from './GasBottom';
import { GasStage } from './GasStage';

/**
 * Maxwell–Boltzmann: the gas box with its speed distribution beside it, seen without opening the
 * notebook (#205 B7); the notebook's tab keeps the chart with its numbers.
 */
export const MaxwellStage = () => (
  <div className="gas-split">
    <div className="gas-split__box">
      <GasStage mode="maxwell" />
    </div>
    <div className="gas-split__chart">
      <SpeedChart />
    </div>
  </div>
);
export const CollisionStage = () => <GasStage mode="collision" />;
