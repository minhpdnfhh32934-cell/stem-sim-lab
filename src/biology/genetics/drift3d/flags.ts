/**
 * The fate flags of the genetic drift archipelago: when the model fixes or loses A on an island,
 * a flag stands on its back shore, behind its animals and trees (the island tags of the row
 * behind sit beside it, never over it): a banner in the colour of the allele left and, on top of the
 * pole, that allele's bead shape (A a cube ■, a a sphere ●), readable without colour. Islands that
 * still hold both alleles have no flag. The ground never changes colour: the habitat is the same
 * on every island, only the marker tells the fate.
 *
 * Poles, banners and finials are instanced (one draw call each kind and allele), rewritten in
 * place when the generation changes. Shapes are illustration; which islands carry which flag is
 * the model's (`binding.ts`, `fate`).
 */
import * as THREE from 'three';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import type { Fate } from './binding';
import { coastAt, type DriftLayout } from './layout';

/** Where the flag stands: at the back, a little right of centre, on the beach behind the trees. */
export const FLAG_ANGLE = -Math.PI / 2 + 0.35;
const FLAG_U = 0.9;
/**
 * Sizes as shares of the island's mean coast radius (a figure is about 1.4 tall, a coast at
 * least 5.2): pole height and radius, banner width and height, finial (cube's half side,
 * sphere's radius). Big enough to read from the whole archipelago's view.
 */
const POLE = 0.8;
const POLE_RADIUS = 0.016;
const BANNER_W = 0.46;
const BANNER_H = 0.28;
const FINIAL = 0.06;

export interface FateFlags {
  /** Shows the flags of these fates (one per island; 'polymorphic' = no flag). */
  show(fates: readonly Fate[]): void;
  /** The fate each island's flag shows now (for tests and the callouts). */
  shown(): readonly Fate[];
  /** The top of island i's flag (world, over its finial): where a callout points. */
  top(island: number): Vec3;
}

/** A banner with a baked ripple: x from the pole (0) to its free end (1), y centred. */
function bannerGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1, 10, 3);
  g.translate(0.5, 0, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    // The free end ripples more than the edge held by the pole; the bottom trails a little.
    p.setZ(i, 0.1 * Math.sin(x * Math.PI * 1.7) * x);
    p.setY(i, y - 0.06 * x * x);
  }
  g.computeVertexNormals();
  return g;
}

export function fateFlags(
  kit: SceneKit,
  L: DriftLayout,
  colors: { A: string; a: string },
  heightAt: (x: number, z: number) => number,
): FateFlags {
  const n = L.islands.length;
  const size = L.islands.map((is) => is.coast);
  const feet: Vec3[] = L.islands.map((is) => {
    const r = FLAG_U * coastAt(is, FLAG_ANGLE);
    const x = is.x + Math.cos(FLAG_ANGLE) * r;
    const z = is.z + Math.sin(FLAG_ANGLE) * r;
    return [x, heightAt(x, z), z];
  });

  const poles = kit.instanced(
    kit.cylinder(Math.max(6, Math.round(kit.seg / 3))),
    kit.solid(kit.color('--bio3d-bark'), { roughness: 0.8 }),
    n,
  );
  poles.name = 'drift-flag-poles';
  const banner = kit.geometry(bannerGeometry());
  const make = (name: string, geometry: THREE.BufferGeometry, color: string, double = false) => {
    const m = kit.instanced(
      geometry,
      kit.solid(color, { roughness: 0.55, ...(double ? { side: THREE.DoubleSide } : {}) }),
      n,
    );
    m.name = name;
    return m;
  };
  const banners = {
    fixed: make('drift-flags-A', banner, colors.A, true),
    lost: make('drift-flags-a', banner, colors.a, true),
  };
  const finials = {
    fixed: make('drift-finials-A', kit.roundedBox(), colors.A),
    lost: make('drift-finials-a', kit.sphere(0.6), colors.a),
  };
  for (const m of [poles, banners.fixed, banners.lost, finials.fixed, finials.lost]) {
    m.raycast = () => undefined;
    m.castShadow = kit.shadows;
    m.receiveShadow = kit.shadows;
  }

  const shown: Fate[] = L.islands.map(() => 'polymorphic');
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const upright = new THREE.Quaternion();
  // The banner flies to the right (+x), facing the camera (which looks from +z).
  const outward = new THREE.Quaternion();

  const write = () => {
    let p = 0;
    const k = { fixed: 0, lost: 0 };
    for (let i = 0; i < n; i++) {
      const fate = shown[i];
      const foot = feet[i];
      if (!foot || (fate !== 'fixed' && fate !== 'lost')) continue;
      const [x, y, z] = foot;
      const c = size[i] ?? 1;
      const h = POLE * c;
      poles.setMatrixAt(
        p++,
        m4.compose(
          pos.set(x, y + h / 2, z),
          upright,
          scale.set(POLE_RADIUS * c, h, POLE_RADIUS * c),
        ),
      );
      const j = k[fate]++;
      banners[fate].setMatrixAt(
        j,
        m4.compose(
          pos.set(x, y + h - 0.03 * c - (BANNER_H * c) / 2, z),
          outward,
          scale.set(BANNER_W * c, BANNER_H * c, BANNER_W * c),
        ),
      );
      finials[fate].setMatrixAt(
        j,
        m4.compose(pos.set(x, y + h + FINIAL * c, z), upright, scale.setScalar(FINIAL * c)),
      );
    }
    poles.count = p;
    for (const f of ['fixed', 'lost'] as const) {
      banners[f].count = k[f];
      finials[f].count = k[f];
      banners[f].instanceMatrix.needsUpdate = true;
      finials[f].instanceMatrix.needsUpdate = true;
    }
    poles.instanceMatrix.needsUpdate = true;
  };
  write();

  return {
    show(fates) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        const f = fates[i] ?? 'polymorphic';
        if (shown[i] !== f) {
          shown[i] = f;
          changed = true;
        }
      }
      if (changed) write();
    },
    shown: () => shown,
    top(island) {
      const f = feet[island];
      return f ? [f[0], f[1] + (POLE + 2 * FINIAL) * (size[island] ?? 1), f[2]] : [0, 0, 0];
    },
  };
}
