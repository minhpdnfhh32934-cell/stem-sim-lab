import {
  Gauge,
  Hash,
  Layers,
  MoveRight,
  Ruler,
  Timer,
  ToggleLeft,
  Triangle,
  Weight,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { DIM, getUnit, isKnownUnit, sameDimension, type Dimension } from '@/core/units';
import type { ParamDef } from '@/physics/types';

const BY_DIM: [Dimension, LucideIcon][] = [
  [DIM.length, Ruler],
  [DIM.mass, Weight],
  [DIM.time, Timer],
  [DIM.velocity, Gauge],
  [DIM.acceleration, Gauge],
  [DIM.force, MoveRight],
  [DIM.energy, Zap],
];

/** Icon of a quantity card in "Tôi hiểu đề như sau" (decoration only: the name says it all). */
export function quantityIcon(def: Pick<ParamDef, 'kind' | 'dim' | 'unit'>): LucideIcon {
  if (def.kind === 'choice') return Layers;
  if (def.kind === 'toggle') return ToggleLeft;
  if (def.unit === 'deg' || def.unit === 'rad') return Triangle;
  const dim = def.dim ?? (def.unit && isKnownUnit(def.unit) ? getUnit(def.unit).dim : undefined);
  if (dim) for (const [d, icon] of BY_DIM) if (sameDimension(d, dim)) return icon;
  return Hash;
}
