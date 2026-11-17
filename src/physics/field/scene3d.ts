/**
 * The 3D scene of "Điện trường" (three.js, on the biology scene kit): the charges as spheres
 * (+ --chart-4, − --chart-1, as in 2D), the field lines of `field3d` in two draw calls (solid, and
 * dashed where the tracer's step budget cut a line), one arrowhead per line, the points E = 0,
 * point M with E⃗; or, for the capacitor, the two plates with the uniform field between them.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addArrow, type Vec3 } from '../view3d/arrow';
import type { Field3D, Line3D } from './field3d';

export interface FieldTexts {
  /** Names of the charges (q₁, q₂, q₃) and of point M. */
  charges: string[];
  M: string;
  E: string;
  nul: string;
}

export interface FieldScene extends Bio3DScene {
  state(): { lines: number; cut: number; arrowheads: number; charges: number; nulls: number };
}

/**
 * Seen almost side-on, a little from above: the gap between the plates and the field across it
 * show (seen from above, the plates would hide it).
 */
export const PLATES_VIEW: Vec3 = [0.35, 0.3, 1];

/** Length of E⃗ at M: a quarter of the view's height (the 2D picture's `vectorScale(…, 0.25)`). */
export const E_SHARE = 0.25;

function segments(lines: readonly Line3D[]): Float32Array {
  const n = lines.reduce((a, l) => a + Math.max(0, l.points.length - 1), 0);
  const out = new Float32Array(n * 6);
  let k = 0;
  for (const l of lines)
    for (let i = 0; i + 1 < l.points.length; i++) {
      const a = l.points[i];
      const b = l.points[i + 1];
      if (!a || !b) continue;
      out.set(a, k);
      out.set(b, k + 3);
      k += 6;
    }
  return out;
}

export function buildFieldScene(
  kit: SceneKit,
  o: { model: Field3D; texts: FieldTexts },
): FieldScene {
  const { model: m, texts } = o;
  const v = m.view;
  const size = Math.max(v.xMax - v.xMin, v.yMax - v.yMin);
  const plus = kit.color('--chart-4');
  const minus = kit.color('--chart-1');
  const muted = kit.color('--text-muted');
  const eColor = kit.color('--chart-3');
  let arrowheads = 0;

  if (m.mode === 'plates') {
    const { U, d, w } = m.plates;
    const plate = (y: number, positive: boolean) => {
      // A thin flat plate (the 2D picture's line seen in space).
      const p = kit.mesh(
        kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1)),
        kit.solid(positive ? plus : minus, { roughness: 0.4 }),
      );
      p.scale.set(w, d * 0.05, w);
      p.position.set(0, y, 0);
      kit.label(positive ? '+' : '−', [w / 2 + d * 0.3, y, 0], 'strong');
    };
    plate(d / 2, U >= 0);
    plate(-d / 2, U < 0);
    if (U !== 0) {
      // Field lines from the + plate to the − plate, a 3 × 3 grid (illustration of a uniform field).
      const g = new THREE.Group();
      g.name = 'field-uniform';
      kit.scene.add(g);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const x = (i - 1) * w * 0.3;
          const z = (j - 1) * w * 0.3;
          const top = U > 0 ? d / 2 : -d / 2;
          addArrow(
            kit,
            {
              from: [x, top, z],
              dir: [0, -Math.sign(U), 0],
              length: d,
              radius: d * 0.012,
              color: muted,
            },
            g,
          );
        }
    }
  } else {
    // Charges: a sphere each, the radius of the 2D picture's disc.
    m.charges.forEach((c, i) => {
      const color = c.q > 0 ? plus : c.q < 0 ? minus : kit.color('--text-faint');
      const ball = kit.mesh(kit.sphere(), kit.solid(color, { roughness: 0.35 }));
      ball.scale.setScalar(c.r);
      ball.position.set(...c.at);
      ball.name = `field-charge-${String(i + 1)}`;
      const sign = c.q > 0 ? '+' : c.q < 0 ? '−' : '0';
      kit.label(
        `${texts.charges[i] ?? ''} ${sign}`,
        [c.at[0], c.at[1] + c.r * 2.2, c.at[2]],
        'strong',
      );
    });

    // Field lines: solid and dashed (cut) in one draw call each.
    for (const cut of [false, true]) {
      const lines = m.lines.filter((l) => l.cut === cut);
      if (!lines.length) continue;
      const geo = kit.geometry(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(segments(lines), 3));
      const mat = kit.own(
        cut
          ? new THREE.LineDashedMaterial({
              color: muted,
              dashSize: size * 0.012,
              gapSize: size * 0.01,
            })
          : new THREE.LineBasicMaterial({ color: muted }),
      );
      const seg = new THREE.LineSegments(geo, mat);
      if (cut) seg.computeLineDistances();
      seg.name = cut ? 'field-lines-cut' : 'field-lines';
      kit.scene.add(seg);
    }

    // One arrowhead in the middle of each line, pointing along E.
    const heads = m.lines.flatMap((l) => {
      const i = Math.floor(l.points.length / 2);
      const a = l.points[i];
      const b = l.points[i + 1];
      if (!a || !b) return [];
      const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).multiplyScalar(l.dir);
      return dir.lengthSq() > 0 ? [{ at: a, dir: dir.normalize() }] : [];
    });
    if (heads.length) {
      const cone = kit.shared(
        `cone|${String(kit.seg)}`,
        () => new THREE.ConeGeometry(1, 1, kit.seg),
      );
      const inst = kit.instanced(cone, kit.solid(muted), heads.length);
      inst.name = 'field-arrowheads';
      const mat4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const s = new THREE.Vector3(size * 0.008, size * 0.022, size * 0.008);
      heads.forEach((h, k) => {
        q.setFromUnitVectors(up, h.dir);
        mat4.compose(new THREE.Vector3(...h.at), q, s);
        inst.setMatrixAt(k, mat4);
      });
      inst.instanceMatrix.needsUpdate = true;
      arrowheads = heads.length;
    }

    // Points E = 0.
    for (const n of m.nulls) {
      const dot = kit.mesh(kit.sphere(), kit.solid(kit.color('--text')));
      dot.scale.setScalar(size * 0.006);
      dot.position.set(...n);
      kit.label(texts.nul, [n[0], n[1] - size * 0.03, n[2]], 'muted');
    }
  }

  // Point M (between the plates: the middle) and E⃗ there.
  const probe = kit.mesh(kit.sphere(), kit.solid(kit.color('--text')));
  probe.scale.setScalar(size * 0.007);
  probe.position.set(...m.probe);
  probe.name = 'field-probe';
  kit.label(
    texts.M,
    m.mode === 'plates'
      ? [m.probe[0] - m.plates.d * 0.25, m.probe[1], m.probe[2]]
      : [m.probe[0] - size * 0.02, m.probe[1] - size * 0.035, m.probe[2]],
    'plain',
  );
  if (m.e > 0) {
    // Between the plates: 0,35·d, as in the 2D picture (it stays inside the gap).
    const plates = m.mode === 'plates';
    const length = plates ? 0.35 * m.plates.d : E_SHARE * (v.yMax - v.yMin);
    addArrow(kit, {
      from: m.probe,
      dir: [m.E[0], m.E[1], 0],
      length,
      radius: plates ? m.plates.d * 0.02 : size * 0.005,
      color: eColor,
      name: 'field-E',
    });
    const u: Vec3 = [m.E[0] / m.e, m.E[1] / m.e, 0];
    kit.label(
      texts.E,
      plates
        ? [m.probe[0] + m.plates.d * 0.25, m.probe[1] + u[1] * length * 0.6, 0]
        : [m.probe[0] + u[0] * length * 1.15, m.probe[1] + u[1] * length * 1.15 + size * 0.02, 0],
      'strong',
    );
  }

  // The capacitor: framed by its plates (the gap fills the picture's middle). Point charges: the
  // 2D view's region; turned lines fill a cylinder about the axis, as deep as the view is high.
  const box =
    m.mode === 'plates'
      ? { x: [-m.plates.w / 2, m.plates.w / 2], y: [-m.plates.d, m.plates.d], hz: m.plates.w / 2 }
      : {
          x: [v.xMin, v.xMax],
          y: [v.yMin, v.yMax],
          hz: m.axis ? (v.yMax - v.yMin) / 2 : size * 0.05,
        };
  const cx = ((box.x[0] ?? 0) + (box.x[1] ?? 0)) / 2;
  const cy = ((box.y[0] ?? 0) + (box.y[1] ?? 0)) / 2;
  const points: Vec3[] = [];
  for (const x of box.x)
    for (const y of box.y) for (const z of [-box.hz, box.hz]) points.push([x, y, z]);
  return {
    kit,
    bounds: {
      center: [cx, cy, 0],
      radius: Math.hypot((box.x[1] ?? 0) - cx, (box.y[1] ?? 0) - cy, box.hz),
      points,
    },
    state: () => ({
      lines: m.lines.length,
      cut: m.lines.filter((l) => l.cut).length,
      arrowheads,
      charges: m.charges.length,
      nulls: m.nulls.length,
    }),
  };
}
