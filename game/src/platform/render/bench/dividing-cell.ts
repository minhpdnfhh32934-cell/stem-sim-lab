import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { stagesOf } from '../../../simulation/models/cellDivision';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Cell division (model `biology.cell-division`, Phase X): a simulation table with one large cell
// on a stand whose chromosomes go through the run's stage — the mother's (red) and the father's
// (blue) copy of each pair, each pair a size — doubled in S, lined up at the equator in metaphase,
// pulled to the poles in anaphase, then shared into two cells (mitosis) or, after a second
// division, four (meiosis). In meiosis I the pairs line up side by side and each pair turns its own
// way (independent assortment, a fixed pattern here); meiosis II divides across. Positions ease
// towards each stage's layout; sizes are a picture's, not a cell's.

const BASE = 0.03;
const CENTRE_Y = 0.3;
const MAX_DIPLOID = 60;
const CHROMATIDS = MAX_DIPLOID * 2;
const SISTER = 0.0045; // sister chromatids side by side (times the size)
const SPACING = 0.019; // between chromosomes on a plate (times the size)
/** Few chromosomes are drawn large, many smaller, so a teaching cell (2n = 4) reads at a glance. */
const sizeOf = (diploid: number) => (diploid <= 8 ? 1.8 : diploid <= 16 ? 1.2 : 0.75);
/** A chromatid's drawn length: pair 1 the longest. */
const lengthOf = (pair: number, diploid: number) =>
  (0.006 + 0.012 * (1 - pair / Math.max(1, diploid / 2))) * sizeOf(diploid);
const EASE = 5; // 1/s

interface CellPlace {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}
const ONE: readonly CellPlace[] = [{ x: 0, y: 0, r: 0.12 }];
const TWO: readonly CellPlace[] = [
  { x: -0.1, y: 0, r: 0.088 },
  { x: 0.1, y: 0, r: 0.088 },
];
const FOUR: readonly CellPlace[] = [
  { x: -0.1, y: -0.07, r: 0.066 }, // sister 0 of the left cell: pulled down in anaphase II
  { x: -0.1, y: 0.07, r: 0.066 },
  { x: 0.1, y: -0.07, r: 0.066 },
  { x: 0.1, y: 0.07, r: 0.066 },
];

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A fixed point in the unit ball for chromosome `i` (its interphase or prophase place). */
function scatter(i: number, out: number[]): void {
  let h = (i + 1) * 2654435761;
  const next = () =>
    ((h = (Math.imul(h ^ (h >>> 15), 2246822519) + 374761393) >>> 0) / 4294967296) * 2 - 1;
  for (;;) {
    const x = next();
    const y = next();
    const z = next();
    if (x * x + y * y + z * z <= 1) {
      out[0] = x;
      out[1] = y;
      out[2] = z;
      return;
    }
  }
}

/** Pair k turns its mother's copy to the left pole (0) or the right (1): independent assortment. */
const turned = (k: number) => ((k * 0x9e3779b1) >>> 7) & 1;

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#9aa3ad', ...LOOKS.satin }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 32)), painted).position.set(
    0,
    BASE + 0.01,
    0,
  );
  mesh(
    keep(new THREE.CylinderGeometry(0.006, 0.006, CENTRE_Y - 0.15 - BASE, 10)),
    steel,
  ).position.set(0, BASE + (CENTRE_Y - 0.15 - BASE) / 2, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const membrane = own(
    new THREE.MeshStandardMaterial({
      color: '#f3e3c8',
      ...LOOKS.glass,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  const cellGeometry = keep(new THREE.SphereGeometry(1, 32, 20));
  const cells = Array.from({ length: 4 }, (_, i) => {
    const m = mesh(cellGeometry, membrane);
    m.name = `cell-${i}`;
    m.castShadow = false;
    m.renderOrder = 1;
    m.scale.setScalar(0.12);
    m.position.set(0, CENTRE_Y, 0);
    m.visible = i === 0;
    return m;
  });
  const poleMaterial = own(new THREE.MeshStandardMaterial({ color: '#f0c419', ...LOOKS.satin }));
  const poleGeometry = keep(new THREE.SphereGeometry(0.006, 12, 8));
  const poles = Array.from({ length: 8 }, (_, i) => {
    const m = mesh(poleGeometry, poleMaterial);
    m.name = `pole-${i}`;
    m.visible = false;
    return m;
  });
  const rod = keep(new THREE.CapsuleGeometry(0.0028, 1, 4, 8));
  const chromatids = new THREE.InstancedMesh(
    rod,
    own(new THREE.MeshStandardMaterial({ ...LOOKS.satin })),
    CHROMATIDS,
  );
  chromatids.name = 'chromosomes';
  chromatids.castShadow = false;
  chromatids.position.set(0, CENTRE_Y, 0);
  chromatids.count = 0;
  kit.group.add(chromatids);
  const red = new THREE.Color('#d63c3c');
  const blue = new THREE.Color('#3a68d6');

  const target = new Float32Array(CHROMATIDS * 4); // x, y, z, shown (0/1)
  const now = new Float32Array(CHROMATIDS * 4);
  const cellNow = new Float32Array(4 * 4); // x, y, r, shown
  const cellTarget = new Float32Array(4 * 4);
  const p = [0, 0, 0];
  const matrix = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const upright = new THREE.Quaternion();
  let shownDivision = NaN;
  let shownDiploid = NaN;
  let shownIndex = NaN;
  let thick = 1;
  let thickTarget = 1;
  let first = true;

  const layout = (division: number, diploid: number, index: number) => {
    const stages = stagesOf(division);
    const stage = stages[index] ?? stages[0];
    if (!stage) return;
    const n = diploid / 2;
    const id = stage.id;
    thickTarget = stage.condensed ? 1 : 0.55;
    // Cells: one; two side by side (after the first division); four (after meiosis II).
    const places = stage.cells === 1 ? ONE : stage.cells === 2 ? TWO : FOUR;
    for (let c = 0; c < 4; c++) {
      const place = places[c];
      cellTarget[c * 4] = place?.x ?? 0;
      cellTarget[c * 4 + 1] = place?.y ?? 0;
      cellTarget[c * 4 + 2] = place?.r ?? 0.12;
      cellTarget[c * 4 + 3] = place ? 1 : 0;
    }
    const second = id.endsWith('-2');
    const metaphase = id.startsWith('metaphase');
    const anaphase = id.startsWith('anaphase');
    // Both sisters exist once the DNA is copied (all the chromatids: 4n over the cells).
    const bothSisters = stage.cells * stage.chromatids === 4;
    // Sisters still joined, in one cell (a doubled chromosome).
    const joined = stage.chromatids === 2 * stage.chromosomes;
    // Meiosis I sends chromosome i to the left (0) or right (1) cell.
    const sideOf = (i: number) => ((i & 1) ^ turned(i >> 1)) as 0 | 1;
    const cellOf = (i: number, s: number) =>
      stage.cells === 1
        ? 0
        : division === 0
          ? s
          : stage.cells === 2
            ? sideOf(i)
            : sideOf(i) * 2 + s;
    // Each chromosome's slot on its metaphase plate, and how many share it.
    const count = division === 1 ? n : diploid;
    const slotOf = (i: number) => {
      if (division === 0) return i;
      if (!second) return i >> 1; // the pairs side by side
      let rank = 0;
      for (let j = 0; j < i; j++) if (sideOf(j) === sideOf(i)) rank++;
      return rank;
    };
    const cols = Math.max(1, Math.ceil(Math.sqrt(count / 2)));
    const rows = Math.ceil(count / cols);
    for (let i = 0; i < CHROMATIDS; i++) target[i * 4 + 3] = 0;
    for (let i = 0; i < diploid; i++) {
      const mother = (i & 1) === 0;
      for (let s = 0; s < 2; s++) {
        const j = (i * 2 + s) * 4;
        if (s === 1 && !bothSisters) {
          // Not copied yet: hidden where its sister is, so it grows out of it in S.
          target.copyWithin(j, j - 4, j - 1);
          continue;
        }
        const cell = places[Math.min(cellOf(i, s), places.length - 1)] as CellPlace;
        const r = cell.r;
        const slot = slotOf(i);
        const big = sizeOf(diploid);
        const pitch = Math.max(SPACING * big, lengthOf(0, diploid) + 0.006);
        const u = (Math.floor(slot / cols) - (rows - 1) / 2) * pitch; // along the plate
        const v = ((slot % cols) - (cols - 1) / 2) * SPACING * big; // into the plate
        const sister = joined ? ((s === 0 ? -SISTER : SISTER) * big) / 2 : 0;
        let x: number;
        let y: number;
        let z = v;
        if (!metaphase && !anaphase) {
          scatter(i, p); // interphase, prophase, telophase: loose in the cell
          x = (p[0] ?? 0) * r * 0.5 + sister;
          y = (p[1] ?? 0) * r * 0.5;
          z = (p[2] ?? 0) * r * 0.5;
        } else if (division === 1 && !second) {
          // Meiosis I: the pairs side by side on the equator, then each copy to its pole.
          const side = sideOf(i) === 0 ? -1 : 1;
          x = side * (anaphase ? r * 0.6 : 0.006) + sister;
          y = u;
        } else {
          // On the equator, sisters facing opposite poles; in anaphase, pulled to them. The
          // spindle runs along x (mitosis) or y (meiosis II).
          const along = anaphase ? (s === 0 ? -1 : 1) * r * 0.6 : sister;
          if (second) {
            x = u;
            y = along;
          } else {
            x = along;
            y = u;
          }
        }
        target[j] = cell.x + x;
        target[j + 1] = cell.y + y;
        target[j + 2] = z;
        target[j + 3] = 1;
        chromatids.setColorAt(i * 2 + s, mother ? red : blue);
      }
    }
    if (chromatids.instanceColor) chromatids.instanceColor.needsUpdate = true;
    // The spindle poles of each dividing cell.
    for (let c = 0; c < 4; c++) {
      for (let e = 0; e < 2; e++) {
        const pole = poles[c * 2 + e] as THREE.Mesh;
        const cell = places[c];
        pole.visible = (metaphase || anaphase) && !!cell;
        if (!cell) continue;
        const sign = e === 0 ? -1 : 1;
        if (second) pole.position.set(cell.x, CENTRE_Y + cell.y + sign * cell.r * 0.85, 0);
        else pole.position.set(cell.x + sign * cell.r * 0.85, CENTRE_Y + cell.y, 0);
      }
    }
  };

  const pose = ({ parameters, sample }: BenchPose, dt: number) => {
    const division = parameters.division === 1 ? 1 : 0;
    const diploid = Math.max(
      2,
      Math.min(MAX_DIPLOID, Math.round((parameters.diploid ?? 4) / 2) * 2),
    );
    const index = Number.isFinite(sample.stage) ? Math.round(sample.stage ?? 0) : 0;
    if (division !== shownDivision || diploid !== shownDiploid || index !== shownIndex) {
      shownDivision = division;
      shownDiploid = diploid;
      shownIndex = index;
      layout(division, diploid, index);
      if (first) {
        now.set(target);
        cellNow.set(cellTarget);
        thick = thickTarget;
        first = false;
      }
    }
    const a = 1 - Math.exp(-Math.min(dt, 0.05) * EASE);
    for (let i = 0; i < now.length; i++)
      now[i] = (now[i] ?? 0) + ((target[i] ?? 0) - (now[i] ?? 0)) * a;
    for (let i = 0; i < cellNow.length; i++)
      cellNow[i] = (cellNow[i] ?? 0) + ((cellTarget[i] ?? 0) - (cellNow[i] ?? 0)) * a;
    thick += (thickTarget - thick) * a;
    let count = 0;
    for (let i = 0; i < diploid * 2; i++) {
      const j = i * 4;
      const shown = now[j + 3] ?? 0;
      const length = lengthOf(i >> 2, diploid);
      const width = thick * sizeOf(diploid);
      at.set(now[j] ?? 0, now[j + 1] ?? 0, now[j + 2] ?? 0);
      const visible = shown > 0.05 ? shown : 1e-4;
      size.set(width * visible, length * visible, width * visible);
      matrix.compose(at, upright, size);
      chromatids.setMatrixAt(i, matrix);
      count = i + 1;
    }
    chromatids.count = count;
    chromatids.instanceMatrix.needsUpdate = true;
    for (let c = 0; c < 4; c++) {
      const cell = cells[c] as THREE.Mesh;
      const shown = cellNow[c * 4 + 3] ?? 0;
      cell.visible = shown > 0.05;
      cell.position.set(cellNow[c * 4] ?? 0, CENTRE_Y + (cellNow[c * 4 + 1] ?? 0), 0);
      cell.scale.setScalar(Math.max(1e-3, (cellNow[c * 4 + 2] ?? 0.12) * Math.max(shown, 0.3)));
    }
  };
  return {
    group: kit.group,
    pose,
    dispose: () => {
      chromatids.dispose();
      kit.dispose();
    },
  };
}

export const dividingCell: BenchModel = {
  frame,
  rig,
  reads: ['stage'],
  fullScale: { stage: 6 },
};
