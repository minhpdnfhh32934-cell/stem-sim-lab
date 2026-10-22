/**
 * The phase-plane board of the predator–prey habitat: a wooden notice board right of the columns,
 * leaning back a little, with the 2D lesson's phase plot on it — axes x (prey, in its colour) and
 * y (predators, in theirs) on the 2D plot's ranges (`binding.ts`: xMax, yMax), the dashed lines x = x* and y = y* where
 * one population momentarily stops changing, the equilibrium (x*, y*), and the orbit drawn
 * through every computed sample (raised ink tube). A glowing bead marks the moment shown, with a
 * line down to the x axis in the prey's colour and one across to the y axis in the predators'
 * colour, so the board, the columns and the animals read together. The board, the wood and the
 * bead's look are illustration; every position on the plot is the model's.
 */
import * as THREE from 'three';
import type { SceneKit, Vec3 } from '../../view3d/kit';
import { highlight } from '../../view3d/recipes';
import { PREDATOR_TOKEN, PREY_TOKEN, orbitPoints, type LvModel3D, type LvMoment } from './binding';
import { boardPoint, type BoardLayout } from './layout';

export interface BoardTexts {
  title: string;
  /** The axes' letters ("x", "y"; the axes are in the species' colours) and the nullcline tags. */
  x: string;
  y: string;
  xStar: string;
  yStar: string;
}

/** The plot inside the panel, as shares of its width (left, right) and height (bottom, top). */
export const PLOT = { left: 0.12, right: 0.05, bottom: 0.13, top: 0.08 };

export interface Board {
  pickables: THREE.Object3D[];
  set(m: LvMoment): void;
  select(on: boolean): void;
  showLabels(on: boolean): void;
  /** The bead's position on the plot as shares of its axes (u = x / xMax, v = y / yMax). */
  bead(): [number, number];
  /** The bead (world). */
  beadPoint(): Vec3;
  /** The equilibrium marker's position on the plot (shares of its axes). */
  equilibrium(): [number, number];
  /** Panel corners (world): what name callouts keep clear of. */
  hull: Vec3[];
}

export function board(
  kit: SceneKit,
  model: LvModel3D,
  B: BoardLayout,
  heightAt: (x: number, z: number) => number,
  texts: BoardTexts,
): Board {
  const L0 = B.lift / Math.cos(B.lean);
  const W = B.width;
  const H = B.height;
  // The board stands on the lower of its two posts' ground, sunk a little (`boardPoint` is the
  // same transform as the group's: the feet at (B.x, B.z), lean back, then the yaw).
  const feet = [-1, 1].map((sx) => boardPoint(B, sx * (W / 2 - 0.45), -L0, -0.2));
  const ground = Math.min(...feet.map((f) => heightAt(f[0], f[2]))) - 0.15;
  const group = new THREE.Group();
  group.name = 'lv-board';
  group.position.set(B.x, ground, B.z);
  group.rotation.set(-B.lean, B.yaw, 0, 'YXZ');
  kit.scene.add(group);
  group.updateMatrixWorld(true);
  const world = (s: number, h: number, out = 0): Vec3 => {
    const v = new THREE.Vector3(s, L0 + h, out).applyMatrix4(group.matrixWorld);
    return [v.x, v.y, v.z];
  };

  // Frame and posts (bark), the panel (the page's panel colour, lifted a little towards the ink
  // so it reads as a surface on both themes).
  const wood = kit.solid(kit.color('--bio3d-bark'), { roughness: 0.88 });
  const box = kit.shared('lv-board-box', () => new THREE.BoxGeometry(1, 1, 1));
  // Back, posts and roof: one instanced draw of the wood box.
  const postH = L0 + H + 0.25;
  const frame = kit.instanced(box, wood, 4, group);
  frame.name = 'lv-board-frame';
  frame.castShadow = kit.shadows;
  const fm = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  (
    [
      [0, L0 + H / 2, -0.08, W + 0.34, H + 0.34, 0.14],
      [-(W / 2 - 0.45), postH / 2 - 0.1, -0.2, 0.2, postH, 0.2],
      [W / 2 - 0.45, postH / 2 - 0.1, -0.2, 0.2, postH, 0.2],
      [0, L0 + H + 0.25, -0.05, W + 0.7, 0.16, 0.5],
    ] as const
  ).forEach(([x, y, z, sx, sy, sz], i) => {
    fm.compose(new THREE.Vector3(x, y, z), one, new THREE.Vector3(sx, sy, sz));
    frame.setMatrixAt(i, fm);
  });
  frame.instanceMatrix.needsUpdate = true;
  frame.computeBoundingSphere();
  const panelColor = new THREE.Color(kit.color('--bg-panel')).lerp(
    new THREE.Color(kit.color('--text')),
    0.05,
  );
  const panel = kit.mesh(
    kit.geometry(new THREE.PlaneGeometry(W, H)),
    kit.solid(`#${panelColor.getHexString()}`, { roughness: 0.95 }),
    group,
  );
  panel.name = 'lv-board-panel';
  panel.position.set(0, L0 + H / 2, 0.005);
  panel.receiveShadow = kit.shadows;

  // The plot's frame of reference on the panel (local units).
  const x0 = -W / 2 + PLOT.left * W;
  const x1 = W / 2 - PLOT.right * W;
  const y0 = L0 + PLOT.bottom * H;
  const y1 = L0 + H - PLOT.top * H;
  const px = (u: number) => x0 + u * (x1 - x0);
  const py = (v: number) => y0 + v * (y1 - y0);
  const Z = 0.03;
  const unit = Math.min(W, H) / 7;

  const inkMat = kit.solid(kit.color('--text'), { roughness: 0.45 });
  // The axes in the species' colours (x: prey, y: predators), as the drop lines and the columns.
  const preyMat = kit.solid(kit.color(PREY_TOKEN), { roughness: 0.5 });
  const predMat = kit.solid(kit.color(PREDATOR_TOKEN), { roughness: 0.5 });
  const bar = (a: Vec3, b: Vec3, r: number, mat: THREE.Material, name?: string) => {
    const m = kit.mesh(box, mat, group);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    m.scale.set(len || 1e-4, r, r);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
    m.raycast = () => undefined;
    if (name) m.name = name;
    return m;
  };
  // Axes with arrowheads.
  const axisR = unit * 0.03;
  bar([x0, y0, Z], [x1 + unit * 0.15, y0, Z], axisR, preyMat);
  bar([x0, y0, Z], [x0, y1 + unit * 0.15, Z], axisR, predMat);
  const tip = kit.geometry(new THREE.ConeGeometry(unit * 0.07, unit * 0.2, 10));
  const tx = kit.mesh(tip, preyMat, group);
  tx.position.set(x1 + unit * 0.25, y0, Z);
  tx.rotation.z = -Math.PI / 2;
  const ty = kit.mesh(tip, predMat, group);
  ty.position.set(x0, y1 + unit * 0.25, Z);
  for (const t of [tx, ty]) t.raycast = () => undefined;

  // The nullclines x = x* and y = y*, dashed (one instanced draw).
  const eqU = model.xMax > 0 ? model.eq.x / model.xMax : 0;
  const eqV = model.yMax > 0 ? model.eq.y / model.yMax : 0;
  const dash = unit * 0.16;
  const dashes: [number, number, number][] = [];
  for (let y = y0; y + dash <= y1; y += dash * 2) dashes.push([px(eqU), y + dash / 2, Math.PI / 2]);
  for (let x = x0; x + dash <= x1; x += dash * 2) dashes.push([x + dash / 2, py(eqV), 0]);
  const faint = kit.solid(kit.color('--text-faint'), { roughness: 0.7 });
  const dashMesh = kit.instanced(box, faint, dashes.length, group);
  dashMesh.name = 'lv-board-nullclines';
  dashMesh.raycast = () => undefined;
  const mm = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  dashes.forEach(([x, y, a], i) => {
    q.setFromAxisAngle(zAxis, a);
    mm.compose(
      new THREE.Vector3(x, y, Z * 0.7),
      q,
      new THREE.Vector3(dash, unit * 0.022, unit * 0.022),
    );
    dashMesh.setMatrixAt(i, mm);
  });
  dashMesh.instanceMatrix.needsUpdate = true;

  // The orbit: a raised ink tube through every computed (x, y), on the 2D plot's axes.
  const pts = orbitPoints(model).map(([u, v]) => new THREE.Vector3(px(u), py(v), Z * 1.6));
  if (pts.length >= 2) {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a && b && a.distanceToSquared(b) > 1e-12) path.add(new THREE.LineCurve3(a, b));
    }
    if (path.curves.length > 0) {
      const segs = Math.min(path.curves.length, kit.tier === 'high' ? 800 : 400);
      const tube = kit.mesh(
        kit.geometry(new THREE.TubeGeometry(path, segs, unit * 0.035, 5, false)),
        inkMat,
        group,
      );
      tube.name = 'lv-board-orbit';
      tube.raycast = () => undefined;
    }
  }

  // The equilibrium: a small ring at (x*, y*).
  const eqRing = kit.mesh(
    kit.geometry(new THREE.TorusGeometry(unit * 0.11, unit * 0.028, 6, 20)),
    inkMat,
    group,
  );
  eqRing.name = 'lv-board-equilibrium';
  eqRing.position.set(px(eqU), py(eqV), Z * 1.6);
  eqRing.raycast = () => undefined;

  // The moment: a glowing bead, a drop line to the x axis (prey colour) and one to the y axis
  // (predators' colour).
  const bead = kit.mesh(
    kit.sphere(2),
    kit.own(
      highlight(
        kit,
        new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.35 }),
      ),
    ),
    group,
  );
  bead.name = 'lv-board-bead';
  bead.scale.setScalar(unit * 0.14);
  bead.raycast = () => undefined;
  const dropX = bar([0, 0, Z], [0, 1, Z], unit * 0.035, preyMat, 'lv-board-drop-prey');
  const dropY = bar([0, 0, Z], [1, 0, Z], unit * 0.035, predMat, 'lv-board-drop-predators');

  // Labels: the title above the roof, the axes' names at their ends, x* and y* at the dashes.
  const title = kit.label(texts.title, world(0, H + 0.95), 'strong');
  title.name = 'lv-board-title';
  // The axes' letters past their arrowheads.
  const xName = kit.label(texts.x, world(x1 + unit * 0.42, PLOT.bottom * H), 'muted');
  xName.center.set(0, 0.5);
  const yName = kit.label(texts.y, world(x0 + unit * 0.22, y1 + unit * 0.3 - L0), 'muted');
  yName.center.set(0, 0.5);
  const xStar = kit.label(texts.xStar, world(px(eqU), PLOT.bottom * H - unit * 0.42), 'muted');
  const yStar = kit.label(texts.yStar, world(x0 - unit * 0.25, py(eqV) - L0), 'muted');
  yStar.center.set(1, 0.5);
  const labels = [title, xName, yName, xStar, yStar];
  for (const l of labels.slice(1)) l.element.classList.add('lv3d__mark');

  // The picked board: a glowing outline round its frame.
  const pick = kit.mesh(
    box,
    kit.own(
      highlight(
        kit,
        new THREE.MeshStandardMaterial({ color: kit.color('--m3d-highlight'), roughness: 0.4 }),
        0.6,
      ),
    ),
    group,
  );
  pick.name = 'lv-board-pick';
  pick.scale.set(W + 0.6, H + 0.6, 0.06);
  pick.position.set(0, L0 + H / 2, -0.17);
  pick.visible = false;
  pick.raycast = () => undefined;

  let now: [number, number] = [0, 0];
  return {
    pickables: [panel, frame],
    set(m) {
      const [u, v] = m.plot;
      now = [u, v];
      const bx = px(Math.max(0, Math.min(1.05, u)));
      const by = py(Math.max(0, Math.min(1.05, v)));
      bead.position.set(bx, by, Z * 2.6);
      dropX.scale.set(Math.max(1e-4, by - y0), unit * 0.035, unit * 0.035);
      dropX.position.set(bx, (by + y0) / 2, Z);
      dropY.scale.set(Math.max(1e-4, bx - x0), unit * 0.035, unit * 0.035);
      dropY.position.set((bx + x0) / 2, by, Z);
    },
    select(on) {
      pick.visible = on;
    },
    showLabels(on) {
      for (const l of labels) l.visible = on;
    },
    bead: () => now,
    beadPoint: () => {
      const v = bead.position.clone().applyMatrix4(group.matrixWorld);
      return [v.x, v.y, v.z];
    },
    equilibrium: () => [(eqRing.position.x - x0) / (x1 - x0), (eqRing.position.y - y0) / (y1 - y0)],
    hull: [world(-W / 2, -0.2), world(W / 2, -0.2), world(-W / 2, H + 0.4), world(W / 2, H + 0.4)],
  };
}
