import { DIM } from '@/core/units';
import type { LocalizedText } from '@/core/data/dataset';
import type { GraphDef, ParamDef } from '../types';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

/** Gravity parameter shared by every scene that uses g (default comes from Settings). */
export const gravityParam: ParamDef = {
  key: 'g',
  label: L('Gia tốc trọng trường', 'Gravitational acceleration'),
  symbol: 'g',
  kind: 'number',
  dim: DIM.acceleration,
  unit: 'm/s^2',
  min: 1,
  max: 25,
  step: 0.01,
  live: true,
};

export const massParam = (key = 'm', max = 20, symbol = 'm'): ParamDef => ({
  key,
  label: L('Khối lượng', 'Mass'),
  symbol,
  kind: 'number',
  dim: DIM.mass,
  unit: 'kg',
  min: 0.01,
  max,
  step: 0.01,
});

/** Standard kinematics graphs for a point mass with x, y, vx, vy, ax, ay in the state. */
export function pointMassGraphs(
  idx: { x: number; y: number; vx: number; vy: number; ax: number; ay: number },
  energy?: {
    mass: (p: Record<string, number>) => number;
    g: (p: Record<string, number>) => number;
  },
): GraphDef[] {
  const graphs: GraphDef[] = [
    {
      id: 'position',
      title: L('Tọa độ theo thời gian', 'Position vs time'),
      yLabel: L('Tọa độ (m)', 'Position (m)'),
      series: [
        { id: 'x', label: L('x', 'x'), value: (s) => s[idx.x] ?? 0 },
        { id: 'y', label: L('y', 'y'), value: (s) => s[idx.y] ?? 0 },
      ],
    },
    {
      id: 'velocity',
      title: L('Vận tốc theo thời gian', 'Velocity vs time'),
      yLabel: L('Vận tốc (m/s)', 'Velocity (m/s)'),
      series: [
        { id: 'vx', label: L('vₓ', 'vₓ'), value: (s) => s[idx.vx] ?? 0 },
        { id: 'vy', label: L('v_y', 'v_y'), value: (s) => s[idx.vy] ?? 0 },
        {
          id: 'v',
          label: L('|v|', '|v|'),
          value: (s) => Math.hypot(s[idx.vx] ?? 0, s[idx.vy] ?? 0),
        },
      ],
    },
    {
      id: 'acceleration',
      title: L('Gia tốc theo thời gian', 'Acceleration vs time'),
      yLabel: L('Gia tốc (m/s²)', 'Acceleration (m/s²)'),
      series: [
        { id: 'ax', label: L('aₓ', 'aₓ'), value: (s) => s[idx.ax] ?? 0 },
        { id: 'ay', label: L('a_y', 'a_y'), value: (s) => s[idx.ay] ?? 0 },
      ],
    },
  ];
  if (energy) {
    graphs.push({
      id: 'energy',
      title: L('Năng lượng', 'Energy'),
      yLabel: L('Năng lượng (J)', 'Energy (J)'),
      series: [
        {
          id: 'K',
          label: L('Động năng W_đ', 'Kinetic K'),
          value: (s, p) => 0.5 * energy.mass(p) * ((s[idx.vx] ?? 0) ** 2 + (s[idx.vy] ?? 0) ** 2),
        },
        {
          id: 'U',
          label: L('Thế năng W_t', 'Potential U'),
          value: (s, p) => energy.mass(p) * energy.g(p) * (s[idx.y] ?? 0),
        },
        {
          id: 'E',
          label: L('Cơ năng W', 'Mechanical E'),
          value: (s, p) =>
            0.5 * energy.mass(p) * ((s[idx.vx] ?? 0) ** 2 + (s[idx.vy] ?? 0) ** 2) +
            energy.mass(p) * energy.g(p) * (s[idx.y] ?? 0),
        },
      ],
    });
  }
  return graphs;
}

/** Relative difference, used to report analytic-vs-numeric agreement. */
export function relDiff(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
  return Math.abs(a - b) / scale;
}

/**
 * When a problem gives only one friction coefficient ("hệ số ma sát là 0,2"), use it for
 * both static and kinetic friction instead of mixing it with an unrelated default.
 */
export function pairFriction(
  p: Record<string, number>,
  sources: Record<string, 'problem' | 'default' | 'user'>,
): Record<string, number> {
  const out = { ...p };
  const sDef = sources.muS === 'default';
  const kDef = sources.muK === 'default';
  if (sDef && !kDef && p.muK !== undefined) out.muS = p.muK;
  if (kDef && !sDef && p.muS !== undefined) out.muK = p.muS;
  return out;
}
