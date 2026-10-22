/**
 * The two columns of the predator–prey habitat: glass tubes on one oval stone plinth at the
 * meadow's right, filled to x(t) (the prey's chart colour, left) and y(t) (the predators', right)
 * on ONE scale whose top is 1.08 × the largest of the run's peaks, x* and y* (`binding.ts`), like
 * the 2D time chart's single axis. A ring marks the equilibrium on each: x* = γ/δ on the prey
 * tube (above it the predators grow), y* = α/β on the predator tube (below it the prey grow). An
 * ink arrow on each liquid's surface shows dx/dt or dy/dt over `rateRef` (down while shrinking).
 * The tubes, the plinth and the arrows' look are illustration; levels and lengths are the model's.
 */
import * as THREE from 'three';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import { glassMeshes, glassware, highlight } from '../../view3d/recipes';
import { jarGeometry } from '../../genetics/hw3d/genePool';
import { PREDATOR_TOKEN, PREY_TOKEN, type LvModel3D, type LvMoment } from './binding';
import type { ColumnsLayout } from './layout';

/** Below this share of its full length an arrow is not drawn (the rate ≈ 0). */
export const ARROW_MIN = 0.02;
/** An arrow's full length as a share of the tubes' height. */
export const ARROW_SHARE = 0.3;

export interface ColumnsTexts {
  prey: string;
  predators: string;
  /** "x* = …", "y* = …". */
  xStar: string;
  yStar: string;
}

type Species = 'prey' | 'predators';

export interface Columns {
  /** What a tap on the columns can hit (plinth, liquids; the glass is not pickable). */
  pickables: THREE.Object3D[];
  set(m: LvMoment): void;
  select(on: boolean): void;
  showLabels(on: boolean): void;
  /** Top of the plinth (world y): the scale's zero. */
  base: number;
  /** World height of the full scale (`model.top`). */
  height: number;
  /** The plinth and both tubes (world points): what name callouts keep clear of. */
  hull: Vec3[];
  /** Liquid height above `base` now (world units). */
  fillHeight(s: Species): number;
  /** Signed arrow length now (world units; 0 when hidden). */
  arrowLength(s: Species): number;
  /** World y of the equilibrium ring on a tube. */
  ringHeight(s: Species): number;
  /** Front of a liquid's surface (world). */
  surfacePoint(s: Species): Vec3;
}

export function columns(
  kit: SceneKit,
  model: LvModel3D,
  L: ColumnsLayout,
  heightAt: (x: number, z: number) => number,
  texts: ColumnsTexts,
): Columns {
  // The plinth sits level on the lowest ground under it, sunk a little.
  let ground = Infinity;
  for (let k = 0; k <= 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const f = k === 12 ? 0 : 1;
    ground = Math.min(
      ground,
      heightAt(L.x + Math.cos(a) * L.plinthRx * f, L.z + Math.sin(a) * L.plinthRz * f),
    );
  }
  ground -= 0.08;
  const sides = Math.max(24, kit.seg * 2);
  const stone = kit.solid(kit.color('--bio3d-rock'), { roughness: 0.85 });
  const plinth = kit.mesh(kit.cylinder(sides), stone);
  plinth.name = 'lv-plinth';
  const ph = L.plinthH + 0.08;
  plinth.scale.set(L.plinthRx, ph, L.plinthRz);
  plinth.position.set(L.x, ground + ph / 2, L.z);
  plinth.castShadow = kit.shadows;
  plinth.receiveShadow = kit.shadows;
  const base = ground + ph;
  const capRing = kit.mesh(
    kit.geometry(new THREE.TorusGeometry(1, 0.07 / L.plinthRz, 6, sides).rotateX(Math.PI / 2)),
    stone,
  );
  capRing.scale.set(L.plinthRx - 0.06, 1, L.plinthRz - 0.06);
  capRing.position.set(L.x, base - 0.03, L.z);
  capRing.raycast = () => undefined;
  kit
    .shadow(ground + 0.1, L.plinthRx * 1.2, L.plinthRz * 1.3, 0.3)
    .position.set(L.x, ground + 0.1, L.z);

  const H = L.tubeH;
  const inner = L.tubeR * 0.86;
  const glassLook = glassware(kit, { ink: true, edge: true });
  const jar = kit.geometry(jarGeometry(L.tubeR, H * 1.06, sides));
  const rimMat = kit.solid(kit.color('--bio3d-glass-edge'), { roughness: 0.3, clearcoat: 0.4 });
  const ink = kit.solid(kit.color('--text'), { roughness: 0.5 });
  const shaftR = Math.max(0.05, L.tubeR * 0.1);
  const headH = Math.max(0.3, L.tubeR * 0.5);
  const tubes = (['prey', 'predators'] as const).map((s) => {
    const x = s === 'prey' ? L.preyX : L.predatorX;
    for (const g of glassMeshes(kit, glassLook, jar, 5, kit.tier === 'high'))
      g.position.set(x, base, L.z);
    for (const [y, thick, name] of [
      [base + H * 1.06, Math.max(0.045, L.tubeR * 0.05), `lv-glass-lip-${s}`],
      [base + L.tubeR * 0.05, Math.max(0.035, L.tubeR * 0.04), `lv-glass-foot-${s}`],
    ] as const) {
      const lip = kit.mesh(
        kit.geometry(new THREE.TorusGeometry(L.tubeR, thick, 6, sides).rotateX(Math.PI / 2)),
        rimMat,
      );
      lip.name = name;
      lip.position.set(x, y, L.z);
      lip.raycast = () => undefined;
    }
    const liquid = kit.mesh(
      kit.cylinder(sides),
      kit.solid(kit.color(s === 'prey' ? PREY_TOKEN : PREDATOR_TOKEN), {
        roughness: 0.28,
        clearcoat: 0.5,
      }),
    );
    liquid.name = `lv-liquid-${s}`;
    // The equilibrium ring: x* on the prey tube, y* on the predator tube (neutral ink).
    const star = s === 'prey' ? model.eq.x : model.eq.y;
    const ringY = base + (model.top > 0 ? star / model.top : 0) * H;
    const ring = kit.mesh(
      kit.geometry(new THREE.TorusGeometry(L.tubeR * 1.05, 0.07, 6, sides).rotateX(Math.PI / 2)),
      kit.solid(kit.color('--text-muted'), { roughness: 0.45 }),
    );
    ring.name = `lv-ring-${s}`;
    ring.position.set(x, ringY, L.z);
    ring.raycast = () => undefined;
    // Tags on the outer sides; titles above the lips.
    const outer = s === 'prey' ? -1 : 1;
    const tag = kit.label(
      s === 'prey' ? texts.xStar : texts.yStar,
      [x + outer * (L.tubeR * 1.1 + 0.5), ringY, L.z],
      'muted',
    );
    tag.center.set(s === 'prey' ? 1 : 0, 0.5);
    tag.element.classList.add('lv3d__mark');
    // Titles above the lips, spreading outwards (the prey's to the left, the predators' right).
    const title = kit.label(
      s === 'prey' ? texts.prey : texts.predators,
      [x - outer * L.tubeR * 0.35, base + H * 1.06 + 0.95, L.z],
      'strong',
    );
    title.center.set(s === 'prey' ? 1 : 0, 0.5);
    title.name = `lv-title-${s}`;
    title.element.classList.add('lv3d__title', `lv3d__title--${s}`);
    // The arrow sits on the tubes' inner sides (between them).
    const ax = x - outer * (L.tubeR + 0.12 + shaftR * 2.6);
    const arrow = new THREE.Group();
    arrow.name = `lv-arrow-${s}`;
    kit.scene.add(arrow);
    const shaft = kit.mesh(kit.cylinder(10), ink, arrow);
    const head = kit.mesh(
      kit.geometry(new THREE.ConeGeometry(shaftR * 2.6, headH, 14)),
      ink,
      arrow,
    );
    shaft.raycast = () => undefined;
    head.raycast = () => undefined;
    return { s, x, liquid, ringY, tag, title, arrow, shaft, head, ax, fill: 0, len: 0 };
  });

  const pickRing = kit.mesh(
    kit.geometry(new THREE.TorusGeometry(1, 0.05, 6, sides).rotateX(Math.PI / 2)),
    kit.own(
      highlight(
        kit,
        new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.4 }),
      ),
    ),
  );
  pickRing.name = 'lv-columns-ring';
  pickRing.scale.set(L.plinthRx + 0.18, 1, L.plinthRz + 0.18);
  pickRing.position.set(L.x, base - 0.02, L.z);
  pickRing.visible = false;
  pickRing.raycast = () => undefined;

  const tube = (s: Species) => tubes[s === 'prey' ? 0 : 1] ?? tubes[0];
  return {
    pickables: [plinth, ...tubes.map((t) => t.liquid)],
    base,
    height: H,
    hull: [
      [L.x - L.plinthRx, ground, L.z - L.plinthRz],
      [L.x + L.plinthRx, ground, L.z + L.plinthRz],
      [L.preyX - L.tubeR, base + H * 1.06, L.z],
      [L.predatorX + L.tubeR, base + H * 1.06, L.z],
    ],
    set(m) {
      for (const t of tubes) {
        const share = t.s === 'prey' ? m.fill.prey : m.fill.predators;
        t.fill = Math.max(0, Math.min(1, share)) * H;
        t.liquid.visible = t.fill > 1e-4;
        t.liquid.scale.set(inner, Math.max(1e-4, t.fill), inner);
        t.liquid.position.set(t.x, base + t.fill / 2, L.z);
        const a = t.s === 'prey' ? m.arrow.prey : m.arrow.predators;
        const len = Math.abs(a) >= ARROW_MIN ? a * ARROW_SHARE * H : 0;
        t.len = len;
        t.arrow.visible = len !== 0;
        if (len !== 0) {
          const up = len > 0 ? 1 : -1;
          const shaftL = Math.max(0.01, Math.abs(len) - headH);
          t.shaft.scale.set(shaftR, shaftL, shaftR);
          t.shaft.position.set(t.ax, base + t.fill + (up * shaftL) / 2, L.z);
          t.head.position.set(t.ax, base + t.fill + up * (shaftL + headH / 2), L.z);
          t.head.rotation.set(up > 0 ? 0 : Math.PI, 0, 0);
        }
      }
    },
    select(on) {
      pickRing.visible = on;
    },
    showLabels(on) {
      for (const t of tubes) {
        t.tag.visible = on;
        t.title.visible = on;
      }
    },
    fillHeight: (s) => tube(s)?.fill ?? 0,
    arrowLength: (s) => tube(s)?.len ?? 0,
    ringHeight: (s) => tube(s)?.ringY ?? base,
    surfacePoint: (s) => {
      const t = tube(s);
      return [t?.x ?? L.x, base + (t?.fill ?? 0), L.z + inner];
    },
  };
}
