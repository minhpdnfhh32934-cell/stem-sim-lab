import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EMBLEM } from '../../ui/emblemShape';
import { flightDashes, HUB_PROPS, periodicCells } from './hub';
import type { PropPart } from './parts';
import { bounds, EPSILON, expectProp, triangles } from './testing';

// Every hub prop at the size the hub ships it (Z3 §3.3, Appendix A), and at 0.8 × that so no
// detail fits one size only; then what each promises in the hall.

/** The hub's props as its items carry them: prop, item shape, size. */
const SHIPPED = [
  ['column', 'cylinder', [0.7, 9, 0.7]],
  ['pilaster', 'box', [0.7, 9, 0.2]],
  ['beam', 'box', [26, 0.6, 0.45]],
  ['beam', 'box', [0.4, 0.5, 18]],
  ['clerestory', 'box', [17, 1.2, 0.06]],
  ['clerestory', 'box', [9, 1.2, 0.06]],
  ['oculus', 'cylinder', [6.6, 0.25, 6.6]],
  ['light-panel', 'box', [2.4, 0.08, 0.8]],
  ['emblem', 'box', [5.2, 5.6, 5.2]],
  ['emblem-floor', 'box', [6, 0.01, 6]],
  ['door-portal', 'box', [1.9, 2.9, 0.16]],
  ['reception-desk', 'box', [2.2, 1.1, 0.8]],
  ['bench-seat', 'box', [2, 0.45, 0.55]],
  ['planter', 'cylinder', [1, 1.4, 1]],
  ['pendant', 'box', [0.9, 6, 0.9]],
  ['path-light', 'box', [0.12, 0.01, 3]],
  ['floor-field', 'box', [19.3, 0.01, 11.3]],
  ['wainscot', 'box', [10.9, 1.1, 0.04]],
  ['wainscot', 'box', [5.41, 1.1, 0.04]],
  ['sign-mount', 'box', [3.8, 1, 0.07]],
  ['periodic-table', 'box', [4.4, 2.6, 0.06]],
  ['progress-board', 'box', [4.4, 2.6, 0.06]],
  ['atom-model', 'box', [2.6, 2.6, 0.2]],
  ['dna-helix', 'box', [1.6, 2.6, 0.2]],
  ['standing-wave', 'box', [2.6, 1.6, 0.12]],
  ['low-table', 'box', [0.6, 0.42, 1.2]],
] as const;

const finish = (parts: readonly PropPart[], name: PropPart['finish']) => {
  const found = parts.find((p) => p.finish === name);
  expect(found, name).toBeDefined();
  return bounds(found!.geometry);
};

describe('hub props', () => {
  it('cover every hub builder', () => {
    expect(new Set(SHIPPED.map(([prop]) => prop))).toEqual(new Set(Object.keys(HUB_PROPS)));
  });

  describe.each(SHIPPED.flatMap((row) => [1, 0.8].map((scale) => [...row, scale] as const)))(
    '%s (%s %j) × %d',
    (prop, shape, size, scale) => {
      it('is sound and inside its box', () => {
        const scaled = size.map((v) => v * scale);
        expectProp(HUB_PROPS[prop](scaled), shape, scaled);
      });
    },
  );

  it('are cheap to draw: the emblem under 12,000 triangles, every other under 2,000', () => {
    for (const [prop, , size] of SHIPPED) {
      const count = triangles(HUB_PROPS[prop](size));
      expect(count, prop).toBeLessThan(prop === 'emblem' ? 12_000 : 2_000);
    }
  });

  it('give columns and pilasters one order: the same base and capital heights', () => {
    const column = HUB_PROPS.column([0.7, 9, 0.7]);
    const pilaster = HUB_PROPS.pilaster([0.7, 9, 0.2]);
    for (const parts of [column, pilaster]) {
      const stone = finish(parts, 'stone');
      expect(stone.min.y).toBeCloseTo(-4.5, 6); // on the floor
      expect(stone.max.y).toBeCloseTo(4.5, 6); // the capital under the beam, at the ceiling
    }
    const [shaft, flat] = [finish(column, 'body'), finish(pilaster, 'body')];
    expect(flat.min.y).toBeCloseTo(shaft.min.y, 6);
    expect(flat.max.y).toBeCloseTo(shaft.max.y, 6);
    expect(shaft.max.x).toBeCloseTo(0.28, 6); // shaft radius 0.4 × the diameter
    expect(finish(pilaster, 'stone').min.z).toBeCloseTo(-0.1, 6); // its back on the wall
  });

  it('leave a door portal’s 1.2 × 2.3 m doorway free, framed to the box', () => {
    const [w, h, d] = [1.9, 2.9, 0.16];
    const parts = HUB_PROPS['door-portal']([w, h, d]);
    for (const { finish: name, geometry } of parts) {
      const position = geometry.getAttribute('position');
      const index = geometry.getIndex()!;
      for (let i = 0; i < index.count; i += 3) {
        const corners = [0, 1, 2].map((k) => index.getX(i + k));
        const xs = corners.map((c) => position.getX(c));
        const ys = corners.map((c) => position.getY(c));
        const clear =
          Math.max(...xs) <= -0.6 + EPSILON ||
          Math.min(...xs) >= 0.6 - EPSILON ||
          Math.min(...ys) >= -h / 2 + 2.3 - EPSILON;
        expect(clear, `${name} triangle ${i / 3} in the doorway`).toBe(true);
      }
    }
    const frame = finish(parts, 'body');
    const edges = [-w / 2, w / 2, -h / 2, h / 2];
    [frame.min.x, frame.max.x, frame.min.y, frame.max.y].forEach((v, i) =>
      expect(v).toBeCloseTo(edges[i] ?? NaN, 6),
    );
  });

  it('cross the emblem on its axis: face-on from four sides, hung from the ceiling', () => {
    const [w, h] = [5.2, 5.6];
    const parts = HUB_PROPS.emblem([w, h, w]);
    expect(parts.map((p) => p.finish)).toEqual([
      'body',
      'emblem-cyan',
      'emblem-pale',
      'emblem-warm',
      'emblem-glow',
      'steel',
    ]);
    // The rings and tape are the same seen along x and along z.
    const rings = finish(parts, 'emblem-cyan');
    expect(rings.min.z).toBeCloseTo(rings.min.x, 6);
    expect(rings.max.z).toBeCloseTo(rings.max.x, 6);
    // The ball and its halo on the axis, at the flight's top: 22 units over the dial's centre,
    // which is 0.2 m under the box's centre (the emblem's square on the box's bottom).
    const s = w / EMBLEM.size;
    for (const name of ['emblem-warm', 'emblem-glow'] as const) {
      const centre = finish(parts, name).getCenter(new THREE.Vector3());
      expect(centre.x).toBeCloseTo(0, 6);
      expect(centre.z).toBeCloseTo(0, 6);
      expect(centre.y).toBeCloseTo(w / 2 - h / 2 + (EMBLEM.size / 2 - EMBLEM.ball.y) * s, 6);
    }
    expect(finish(parts, 'steel').max.y).toBeCloseTo(h / 2, 6); // the cables reach the ceiling
  });

  it('dash the flight on its curve, evenly and symmetric about its top', () => {
    const { from, control, to } = EMBLEM.flight;
    const dashes = flightDashes();
    expect(dashes).toHaveLength(18);
    for (const [x0, y0, x1, y1] of dashes) {
      for (const [x, y] of [
        [x0, y0],
        [x1, y1],
      ] as const) {
        const t = (x - from[0]) / (to[0] - from[0]); // x runs evenly with t (control midway)
        const curve = (1 - t) ** 2 * from[1] + 2 * t * (1 - t) * control[1] + t ** 2 * to[1];
        expect(y).toBeCloseTo(curve, 9);
      }
    }
    const length = ([x0, y0, x1, y1]: readonly number[]) =>
      Math.hypot((x1 ?? 0) - (x0 ?? 0), (y1 ?? 0) - (y0 ?? 0));
    dashes.forEach((dash, k) => {
      const mirror = dashes[dashes.length - 1 - k]!;
      expect(dash[0] + mirror[2]).toBeCloseTo(EMBLEM.size, 6);
      expect(length(dash) / length(dashes[0]!)).toBeCloseTo(1, 2);
      if (k > 0) expect(dash[0]).toBeGreaterThan(dashes[k - 1]![2]); // a gap before each
    });
  });

  it('lay the floor emblem upright from the entrance, its colours stacked, none in one plane', () => {
    const [w, h] = [6, 0.01];
    const parts = HUB_PROPS['emblem-floor']([w, h, w]);
    const [disc, cyan, pale, warm] = ['body', 'inlay-cyan', 'inlay-pale', 'inlay-warm'].map(
      (name) => finish(parts, name as PropPart['finish']),
    );
    expect(disc!.max.y).toBeLessThan(cyan!.min.y);
    for (const inlay of [cyan!, pale!, warm!]) expect(inlay.max.y).toBeCloseTo(inlay.min.y, 9);
    expect(cyan!.max.y).toBeLessThan(pale!.min.y);
    expect(pale!.max.y).toBeLessThan(warm!.min.y);
    expect(warm!.max.y).toBeCloseTo(h / 2, 9);
    // Upright from the entrance (+z): the ball beyond the dial's centre, the flight landing nearer.
    expect(warm!.getCenter(new THREE.Vector3()).z).toBeLessThan(0);
    expect(pale!.max.z).toBeGreaterThan(-pale!.min.z);
  });

  it('run a bench along its longer side', () => {
    for (const size of [
      [2, 0.45, 0.55],
      [0.55, 0.45, 2],
    ]) {
      const seat = finish(HUB_PROPS['bench-seat'](size), 'body');
      expect(seat.max.x - seat.min.x).toBeCloseTo(size[0]!, 6);
      expect(seat.max.z - seat.min.z).toBeCloseTo(size[2]!, 6);
    }
  });
});

describe('the hub’s UX2 props', () => {
  it('lay the floor field flat, plain round the floor emblem but for its ring and four marks', () => {
    const [w, h, d] = [19.3, 0.01, 11.3];
    const parts = HUB_PROPS['floor-field']([w, h, d]);
    for (const { geometry } of parts) {
      const box = bounds(geometry);
      expect(box.min.y).toBeCloseTo(h / 2, 9); // all at its top, 1 mm above the floor
      expect(box.max.y).toBeCloseTo(h / 2, 9);
    }
    // No joint or border inside the 4.2 m circle the floor emblem (r 3 m) and the ring keep.
    const position = parts.find((p) => p.finish === 'body')!.geometry.getAttribute('position');
    let nearest = Infinity;
    for (let i = 0; i < position.count; i++) {
      nearest = Math.min(nearest, Math.hypot(position.getX(i), position.getZ(i)));
    }
    expect(nearest).toBeGreaterThanOrEqual(4.2 - 0.02);
    const ring = finish(parts, 'steel');
    expect(ring.max.x).toBeCloseTo(3.43, 6);
    // The marks on the two axes (the doors' lines), between the ring and the clear circle's edge.
    const marks = finish(parts, 'inlay-cyan');
    expect(marks.max.x).toBeCloseTo(4.1, 6);
    expect(marks.max.z).toBeCloseTo(4.1, 6);
  });

  it('mount a department sign 3 cm off its plate, over a band in the item’s colour', () => {
    const [w, h, d] = [3.8, 1, 0.07];
    const parts = HUB_PROPS['sign-mount']([w, h, d]);
    const band = finish(parts, 'body');
    expect(band.min.y).toBeCloseTo(-h / 2, 6);
    expect(band.max.y).toBeCloseTo(-h / 2 + 0.1, 6);
    expect(finish(parts, 'frame-dark').max.z).toBeCloseTo(-d / 2 + 0.04, 6);
    expect(finish(parts, 'steel').max.z).toBeCloseTo(d / 2, 6); // the stand-offs reach the sign
  });

  it('tile the periodic table’s 118 elements: 14 s, 36 p, 38 d, 30 f, one tile each', () => {
    const cells = periodicCells();
    expect([cells.s, cells.p, cells.d, cells.f].map((c) => c.length)).toEqual([14, 36, 38, 30]);
    const all = Object.values(cells).flat();
    expect(new Set(all.map(([c, r]) => `${c},${r}`)).size).toBe(118);
    const parts = HUB_PROPS['periodic-table']([4.4, 2.6, 0.06]);
    const tiles = ['inlay-warm', 'inlay-cyan', 'inlay-pale', 'tile-f'] as const;
    expect(tiles.map((name) => triangles(parts.filter((p) => p.finish === name)) / 12)).toEqual([
      14, 36, 38, 30,
    ]);
  });

  it('give the reception desk a counter overhanging its front panels, on a set-back plinth', () => {
    const [w, h, d] = [2.2, 1.1, 0.8];
    const parts = HUB_PROPS['reception-desk']([w, h, d]);
    const nose = finish(parts, 'steel');
    expect(nose.max.z).toBeCloseTo(d / 2, 6);
    expect(nose.max.y).toBeCloseTo(h / 2, 6);
    expect(finish(parts, 'body').max.z).toBeCloseTo(d / 2 - 0.03, 6);
    expect(finish(parts, 'body').min.y).toBeCloseTo(-h / 2 + 0.1, 6); // panels over the plinth
    expect(finish(parts, 'trim').min.y).toBeCloseTo(-h / 2, 6);
  });
});
