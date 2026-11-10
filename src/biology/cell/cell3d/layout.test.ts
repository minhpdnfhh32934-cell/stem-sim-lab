import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CELL_KINDS, partsFor } from '../parts';
import {
  OUTSIDE,
  cellLayout,
  depthInside,
  drawnParts,
  extent,
  grown,
  type CellLayout,
  type Item,
  type Piece,
} from './layout';

const piece = (l: CellLayout, part: string): Piece | undefined =>
  l.pieces.find((p) => p.part === part);

/** Distance (world) from point q to the surface of a torus piece's ring item. */
function torusDistance(p: Piece, it: Item, q: [number, number, number]): number {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...it.at),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...it.rot)),
    new THREE.Vector3(...it.scale),
  );
  const local = new THREE.Vector3(...q).applyMatrix4(m.invert());
  const d = Math.abs(Math.hypot(Math.hypot(local.x, local.y) - 1, local.z) - (p.tube ?? 0));
  return d * it.scale[0];
}

describe.each(CELL_KINDS)('3D layout of the %s cell', (kind) => {
  const l = cellLayout(kind);

  it('draws exactly the parts of the textbook picture (partsFor)', () => {
    expect(new Set(drawnParts(l))).toEqual(new Set(partsFor(kind)));
  });

  it('organelles lie inside the plasma membrane, with their whole shape', () => {
    for (const p of l.pieces.filter((x) => !OUTSIDE.has(x.part))) {
      for (const it of p.items) {
        expect(
          depthInside(l.body, it.at) - extent(p, it),
          `${p.part} at ${String(it.at)}`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('flagellum and pili lie outside the outermost layer', () => {
    const outer = grown(l.body, Math.max(...l.layers.map((x) => x.grow)));
    for (const p of l.pieces.filter((x) => OUTSIDE.has(x.part))) {
      for (const it of p.items) {
        const margin = p.shape === 'helix' ? 0 : extent(p, it);
        expect(depthInside(outer, it.at) + margin, p.part).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it('is the same picture on every build (seeded)', () => {
    expect(cellLayout(kind)).toEqual(l);
  });
});

describe.each(['animal', 'plant'] as const)('the %s cell: ER and ribosomes', (kind) => {
  const l = cellLayout(kind);
  const nucleus = piece(l, 'nucleus')?.items[0];
  const er = piece(l, 'er');

  it('the ER touches the nuclear envelope (inner edge of every ring on it)', () => {
    if (!nucleus || !er?.tube) throw new Error('no nucleus or ER');
    const rn = nucleus.scale[0];
    for (const ring of er.items) {
      expect(ring.at).toEqual(nucleus.at);
      // Inner edge radius = ring radius − tube radius.
      expect(ring.scale[0] * (1 - er.tube)).toBeCloseTo(rn, 12);
    }
  });

  it('ribosomes sit on the rough ER (and some float free in the cytoplasm)', () => {
    if (!er) throw new Error('no ER');
    const ribosomes = piece(l, 'ribosome')?.items ?? [];
    const onEr = ribosomes.filter((r) =>
      er.items.some((ring) => torusDistance(er, ring, r.at) < 1e-9),
    );
    expect(onEr.length).toBeGreaterThanOrEqual(30);
    expect(ribosomes.length - onEr.length).toBeGreaterThanOrEqual(30);
  });
});

it('only the bacterium has no nucleus; only the animal cell has lysosomes and a centrosome', () => {
  expect(piece(cellLayout('bacterium'), 'nucleus')).toBeUndefined();
  expect(piece(cellLayout('bacterium'), 'nucleoid')).toBeDefined();
  expect(piece(cellLayout('animal'), 'lysosome')).toBeDefined();
  expect(piece(cellLayout('plant'), 'lysosome')).toBeUndefined();
  expect(piece(cellLayout('plant'), 'chloroplast')).toBeDefined();
  expect(cellLayout('plant').layers.map((x) => x.part)).toEqual(['plantWall', 'membrane']);
});
