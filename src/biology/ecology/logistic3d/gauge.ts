/**
 * The gauge of the logistic-growth habitat: a glass column on a stone plinth beside the meadow,
 * filled in the population's colour to N(t) on a scale whose top is 1.08 × max(K, the run's
 * peak) (`binding.ts`), with two rings — the carrying capacity K (the 2D chart's K-line colour)
 * and K/2, where growth is fastest — and an arrow on the liquid's surface whose length is |dN/dt|
 * over the model's arrowRef = max(rK/4, |dN/dt| at N₀) (pointing down while the population
 * shrinks, N > K). The glass has lip rings at its top and foot and, on the dark stage, a light
 * silhouette (`glassware` edge), so it reads as a vessel being filled on both themes. The column,
 * the plinth and the arrow's look are illustration; its levels and length are the model's.
 */
import * as THREE from 'three';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import { glassMeshes, glassware, highlight } from '../../view3d/recipes';
import { jarGeometry } from '../../genetics/hw3d/genePool';
import {
  CAPACITY_TOKEN,
  POPULATION_TOKEN,
  type LogisticModel3D,
  type LogisticMoment,
} from './binding';
import type { GaugeLayout } from './layout';

/** Below this share of its full length the arrow is not drawn (dN/dt ≈ 0: at K, or N = 0). */
export const ARROW_MIN = 0.02;
/** The arrow's full length as a share of the column's height. */
export const ARROW_SHARE = 0.34;

export interface GaugeTexts {
  title: string;
  k: string;
  half: string;
  /** The moment's label beside the column (N and dN/dt; two lines). */
  moment: (m: LogisticMoment) => string;
}

export interface GaugeColumn {
  /** What a tap on the gauge can hit (plinth, liquid; the glass is not pickable). */
  pickables: THREE.Object3D[];
  set(m: LogisticMoment): void;
  select(on: boolean): void;
  /** Shows or hides the column's labels (title, K, K/2 and the moment's N, dN/dt). */
  showLabels(on: boolean): void;
  /** Top of the plinth (world y): the column's zero. */
  base: number;
  /** World height of the column's full scale (`model.top`). */
  height: number;
  /** The column on its plinth (world points): what name callouts keep clear of. */
  hull: Vec3[];
  /** Height of the liquid now (world units above `base`). */
  fillHeight(): number;
  /** Signed length of the arrow now (world units; 0 when hidden). */
  arrowLength(): number;
  /** Front of the liquid's surface (world). */
  surfacePoint(): Vec3;
  /** The arrow's middle (world), or null while it is hidden. */
  arrowPoint(): Vec3 | null;
}

export function gauge(
  kit: SceneKit,
  model: LogisticModel3D,
  L: GaugeLayout,
  heightAt: (x: number, z: number) => number,
  texts: GaugeTexts,
): GaugeColumn {
  // The plinth sits on the lowest ground under it (sunk a little), level.
  let ground = Infinity;
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rr = k === 8 ? 0 : L.plinthR;
    ground = Math.min(ground, heightAt(L.x + Math.cos(a) * rr, L.z + Math.sin(a) * rr));
  }
  ground -= 0.08;
  const sides = Math.max(24, kit.seg * 2);
  const stone = kit.solid(kit.color('--bio3d-rock'), { roughness: 0.85 });
  const plinth = kit.mesh(kit.cylinder(sides), stone);
  plinth.name = 'logi-plinth';
  plinth.scale.set(L.plinthR, L.plinthH + 0.08, L.plinthR);
  plinth.position.set(L.x, ground + (L.plinthH + 0.08) / 2, L.z);
  plinth.castShadow = kit.shadows;
  plinth.receiveShadow = kit.shadows;
  const base = ground + L.plinthH + 0.08;
  const cap = kit.mesh(
    kit.geometry(new THREE.TorusGeometry(L.plinthR - 0.06, 0.07, 6, sides).rotateX(Math.PI / 2)),
    stone,
  );
  cap.position.set(L.x, base - 0.03, L.z);
  cap.raycast = () => undefined;
  kit
    .shadow(ground + 0.1, L.plinthR * 1.3, L.plinthR * 1.3, 0.3)
    .position.set(L.x, ground + 0.1, L.z);

  // The liquid: a unit cylinder scaled to the fill (its top a slightly brighter disc).
  const inner = L.tubeR * 0.86;
  const liquidMat = kit.solid(kit.color(POPULATION_TOKEN), { roughness: 0.28, clearcoat: 0.5 });
  const liquid = kit.mesh(kit.cylinder(sides), liquidMat);
  liquid.name = 'logi-gauge-liquid';
  const H = L.tubeH;
  const height = H;

  // The glass tube (see-through, never pickable), a little taller than the full scale, with a
  // light silhouette on the dark stage and lip rings at its top and foot (both themes).
  const glass = glassMeshes(
    kit,
    glassware(kit, { ink: true, edge: true }),
    kit.geometry(jarGeometry(L.tubeR, H * 1.06, sides)),
    5,
    kit.tier === 'high',
  );
  for (const g of glass) g.position.set(L.x, base, L.z);
  const rimMat = kit.solid(kit.color('--bio3d-glass-edge'), { roughness: 0.3, clearcoat: 0.4 });
  for (const [y, thick, name] of [
    [base + H * 1.06, Math.max(0.045, L.tubeR * 0.05), 'logi-glass-lip'],
    [base + L.tubeR * 0.05, Math.max(0.035, L.tubeR * 0.04), 'logi-glass-foot'],
  ] as const) {
    const lip = kit.mesh(
      kit.geometry(new THREE.TorusGeometry(L.tubeR * 1.0, thick, 6, sides).rotateX(Math.PI / 2)),
      rimMat,
    );
    lip.name = name;
    lip.position.set(L.x, y, L.z);
    lip.raycast = () => undefined;
  }

  // Rings at K and K/2 on the glass (K in the 2D chart's K-line colour, K/2 muted).
  const ringAt = (share: number, colorToken: string, thick: number, name: string) => {
    const r = kit.mesh(
      kit.geometry(new THREE.TorusGeometry(L.tubeR * 1.04, thick, 6, sides).rotateX(Math.PI / 2)),
      kit.solid(kit.color(colorToken), { roughness: 0.45 }),
    );
    r.name = name;
    r.position.set(L.x, base + share * H, L.z);
    r.raycast = () => undefined;
    return r;
  };
  const kShare = model.K / model.top;
  ringAt(kShare, CAPACITY_TOKEN, 0.085, 'logi-ring-k');
  ringAt(kShare / 2, '--text-muted', 0.05, 'logi-ring-half');
  const kLabel = kit.label(texts.k, [L.x - L.tubeR * 1.1 - 0.55, base + kShare * H, L.z], 'muted');
  kLabel.center.set(1, 0.5);
  const halfLabel = kit.label(
    texts.half,
    [L.x - L.tubeR * 1.1 - 0.55, base + (kShare / 2) * H, L.z],
    'muted',
  );
  halfLabel.center.set(1, 0.5);
  for (const tag of [kLabel, halfLabel]) tag.element.classList.add('logi3d__mark');
  // The title stands clear above the lip ring (seen from above, the lip's far half shows).
  const title = kit.label(texts.title, [L.x, base + H * 1.06 + 1.05, L.z], 'strong');
  title.name = 'logi-gauge-title';

  // The growth arrow on the liquid's surface, right of the column (neutral ink: an annotation).
  const ink = kit.solid(kit.color('--text'), { roughness: 0.5 });
  const arrow = new THREE.Group();
  arrow.name = 'logi-arrow';
  kit.scene.add(arrow);
  const shaftR = Math.max(0.06, L.tubeR * 0.12);
  const headH = Math.max(0.35, L.tubeR * 0.6);
  const shaft = kit.mesh(kit.cylinder(10), ink, arrow);
  const head = kit.mesh(kit.geometry(new THREE.ConeGeometry(shaftR * 2.6, headH, 14)), ink, arrow);
  shaft.raycast = () => undefined;
  head.raycast = () => undefined;
  const ax = L.x + L.tubeR + 0.45 + shaftR * 2;
  const momentLabel = kit.label('', [ax + 0.55, base, L.z], 'plain');
  momentLabel.center.set(0, 0.5);
  momentLabel.element.classList.add('logi3d__moment');
  momentLabel.name = 'logi-moment-label';

  // The picked gauge: a glowing ring round the plinth (the data colours never change).
  const pickRing = kit.mesh(
    kit.geometry(new THREE.TorusGeometry(L.plinthR + 0.18, 0.06, 6, sides).rotateX(Math.PI / 2)),
    kit.own(
      highlight(
        kit,
        new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.4 }),
      ),
    ),
  );
  pickRing.name = 'logi-gauge-ring';
  pickRing.position.set(L.x, base - 0.02, L.z);
  pickRing.visible = false;
  pickRing.raycast = () => undefined;

  let fillH = 0;
  let arrowLen = 0;
  return {
    pickables: [plinth, liquid],
    base,
    height,
    hull: [
      [L.x - L.plinthR, ground, L.z - L.plinthR],
      [L.x + L.plinthR, ground, L.z + L.plinthR],
      [L.x - L.tubeR, base + H * 1.06, L.z - L.tubeR],
      [L.x + L.tubeR, base + H * 1.06, L.z + L.tubeR],
    ],
    set(m) {
      fillH = Math.max(0, Math.min(1, m.fill)) * H;
      liquid.visible = fillH > 1e-4;
      liquid.scale.set(inner, Math.max(1e-4, fillH), inner);
      liquid.position.set(L.x, base + fillH / 2, L.z);
      const len = Math.abs(m.arrow) >= ARROW_MIN ? m.arrow * ARROW_SHARE * H : 0;
      arrowLen = len;
      arrow.visible = len !== 0;
      if (len !== 0) {
        const up = len > 0 ? 1 : -1;
        const total = Math.abs(len);
        const shaftL = Math.max(0.01, total - headH);
        // Up: from the surface to the tip above it; down: from the surface to the tip below it.
        shaft.scale.set(shaftR, shaftL, shaftR);
        shaft.position.set(ax, base + fillH + (up * shaftL) / 2, L.z);
        head.position.set(ax, base + fillH + up * (shaftL + headH / 2), L.z);
        head.rotation.set(up > 0 ? 0 : Math.PI, 0, 0);
      }
      momentLabel.position.set(ax + 0.55, base + fillH, L.z);
      momentLabel.element.textContent = texts.moment(m);
    },
    select(on) {
      pickRing.visible = on;
    },
    showLabels(on) {
      for (const l of [title, kLabel, halfLabel, momentLabel]) l.visible = on;
    },
    fillHeight: () => fillH,
    arrowLength: () => arrowLen,
    surfacePoint: () => [L.x, base + fillH, L.z + inner],
    arrowPoint: () => (arrowLen === 0 ? null : [ax, base + fillH + arrowLen / 2, L.z]),
  };
}
