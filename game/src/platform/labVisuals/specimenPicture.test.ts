import { describe, expect, it } from 'vitest';
import { SPECIMENS } from '../../simulation/models/microscope';
import {
  blurLevel,
  CELLS,
  createFieldPainter,
  drawnStructures,
  fieldIsLive,
  hasDetail,
  NOSEPIECE,
  paintCells,
  paintOverlay,
  PATCH_INK,
  PATCH_SHAPE,
  pixelsPerMicron,
  scaleBar,
  sequence,
  type Ctx,
} from './specimenPicture';

/** Counts every call and property write on a context stand-in. */
function stub() {
  const ops = { calls: 0, sets: 0 };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : () => ops.calls++),
    set: (t, k: string, v) => ((t[k] = v), ops.sets++, true),
  }) as unknown as Ctx;
  return { ctx, ops };
}

describe('specimen picture', () => {
  it('is deterministic', () => {
    const a = sequence(7);
    const b = sequence(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('blur and scale bar', () => {
    expect(blurLevel(1)).toBe(0);
    expect(blurLevel(0.0001)).toBe(9);
    expect(scaleBar(400)).toBe(100);
    expect(scaleBar(10)).toBe(10);
  });

  it('draws bounded operation counts for every slide at 512 and 1000 px', () => {
    for (const size of [512, 1000]) {
      const h = Math.round(size * 0.5625);
      const r = h * 0.47; // the renderer's field circle
      for (let specimen = 0; specimen < 3; specimen++) {
        const L = SPECIMENS[specimen]?.length ?? 100;
        for (const fov of [30, 300, 4500]) {
          // 4500 um: the widest field the 4x objective shows
          const scale = Math.max((2 * r) / fov, 2 / L); // the renderer's clamp
          const { ctx, ops } = stub();
          paintCells(ctx, r, specimen, 1, scale, 0.8);
          const again = stub();
          paintCells(again.ctx, r, specimen, 1, scale, 0.8);
          expect(again.ops).toEqual(ops); // same picture every time
          expect(ops.calls).toBeGreaterThan(0);
          expect(ops.calls).toBeLessThan(20_000); // measured worst case: about 9,000
        }
      }
      const { ctx, ops } = stub();
      paintOverlay(ctx, size, Math.round(size * 0.5625), r, 400, 100);
      expect(ops.calls).toBe(10); // 2 fillText, beginPath, 6 path segments, stroke
    }
  });
});

/** A context stand-in that records every call and every property write, in order. */
function recorder() {
  const log: [string, unknown[]][] = [];
  const sets: [string, unknown][] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get: (t, k: string) =>
      k in t
        ? t[k]
        : (...args: unknown[]) => {
            log.push([k, args]);
          },
    set: (t, k: string, v) => {
      t[k] = v;
      sets.push([k, v]);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log, sets };
}

describe('the field painter', () => {
  const image = {} as CanvasImageSource;
  const make = () => {
    const screen = recorder();
    const buffer = recorder();
    const paint = createFieldPainter({
      screen: screen.ctx,
      buffer: buffer.ctx,
      bufferImage: image,
      width: 512,
      height: 288,
    });
    return { screen, buffer, paint };
  };
  const names = (r: ReturnType<typeof recorder>) => r.log.map(([name]) => name);

  it('shows standby grey without a run, and draws it once', () => {
    const { screen, buffer, paint } = make();
    expect(paint(false, NaN, NaN, NaN, NaN, NaN, 0)).toBe(true);
    expect(screen.sets.find(([k]) => k === 'fillStyle')?.[1]).toBe('#2a2e33');
    expect(names(screen)).toEqual(['fillRect']);
    expect(buffer.log).toEqual([]);
    expect(paint(false, NaN, NaN, NaN, NaN, NaN, 0)).toBe(false);
  });

  it('composites the sharp picture through the blur, then the field stop and the overlay', () => {
    const { screen, buffer, paint } = make();
    expect(paint(true, 0, 1, 1800, 100, 0.8, 4)).toBe(true);
    expect(buffer.log.length).toBeGreaterThan(10); // the cells
    expect(names(screen)).toContain('drawImage');
    expect(screen.log.find(([name]) => name === 'drawImage')?.[1][0]).toBe(image);
    expect(screen.sets.filter(([k]) => k === 'filter').map(([, v]) => v)).toContain('blur(5px)');
    expect(screen.sets.filter(([k]) => k === 'filter').at(-1)?.[1]).toBe('none');
    expect(names(screen).filter((n) => n === 'fillText')).toHaveLength(2); // magnification, scale bar
  });

  it('draws nothing again for what it already shows', () => {
    const { screen, buffer, paint } = make();
    paint(true, 0, 1, 1800, 100, 0.8, 4);
    const [s, b] = [screen.log.length, buffer.log.length];
    expect(paint(true, 0, 1, 1800, 100, 0.8, 4)).toBe(false);
    expect([screen.log.length, buffer.log.length]).toEqual([s, b]);
  });

  it('repaints only the overlay for a new magnification and only the blur for a new level', () => {
    const { screen, buffer, paint } = make();
    paint(true, 0, 1, 1800, 100, 0.8, 4);
    const b = buffer.log.length;
    expect(paint(true, 0, 1, 1800, 400, 0.8, 4)).toBe(true);
    expect(paint(true, 0, 1, 1800, 400, 0.8, 6)).toBe(true);
    expect(buffer.log.length).toBe(b); // the sharp picture is kept
    expect(screen.log.length).toBeGreaterThan(0);
    expect(paint(true, 1, 1, 1800, 400, 0.8, 6)).toBe(true); // a new slide: the picture again
    expect(buffer.log.length).toBeGreaterThan(b);
  });

  it('goes back to standby when the run is reset', () => {
    const { screen, paint } = make();
    paint(true, 0, 1, 1800, 100, 0.8, 4);
    expect(paint(false, NaN, NaN, NaN, NaN, NaN, 0)).toBe(true);
    expect(screen.sets.filter(([k]) => k === 'fillStyle').at(-1)?.[1]).toBe('#2a2e33');
  });

  it('is live while a run exists with a field and a sharpness', () => {
    expect(fieldIsLive(true, 1800, 0.5)).toBe(true);
    expect([
      fieldIsLive(false, 1800, 0.5),
      fieldIsLive(true, 0, 0.5),
      fieldIsLive(true, 1800, NaN),
    ]).toEqual([false, false, false]);
  });
});

describe('what the picture draws', () => {
  const r = 300;
  const at = (specimen: number, fov: number) =>
    drawnStructures(specimen, pixelsPerMicron(r, fov, specimen));

  it('shares the nosepiece and the patch tables with the 3D bench', () => {
    expect(NOSEPIECE.map((lens) => lens.magnification)).toEqual([4, 10, 40]);
    expect(PATCH_INK).toHaveLength(CELLS.length);
    expect(PATCH_SHAPE).toHaveLength(CELLS.length);
  });

  it("names the cheek outline a membrane, the plant cells' a wall", () => {
    expect(at(1, 450)).toContain('membrane');
    expect(at(1, 450)).not.toContain('wall');
    expect(at(0, 450)).toContain('wall');
    expect(at(2, 450)).toContain('wall');
    for (const fov of [450, 1800, 4500]) expect(at(0, fov)).not.toContain('membrane');
  });

  it('draws nuclei in onion and cheek cells and chloroplasts in Elodea only when the cells are big enough', () => {
    expect(at(0, 450)).toEqual(['wall', 'cytoplasm', 'nucleus']);
    expect(at(1, 450)).toEqual(['membrane', 'cytoplasm', 'nucleus']);
    expect(at(2, 450)).toEqual(['wall', 'cytoplasm', 'chloroplast']);
    expect(at(2, 4500)).toEqual(['wall']); // one green fill at the widest field
    expect(at(0, 1e6)).toEqual(['wall', 'cytoplasm']); // too small for a nucleus
  });

  it("never labels a vacuole, a plant cell's membrane or an animal organelle", () => {
    const all = new Set<string>();
    for (const s of [0, 1, 2])
      for (const fov of [30, 450, 1800, 4500, 1e6]) at(s, fov).forEach((x) => all.add(x));
    expect([...all].sort()).toEqual(['chloroplast', 'cytoplasm', 'membrane', 'nucleus', 'wall']);
    expect(at(0, 450)).not.toContain('chloroplast');
    expect(at(1, 450)).not.toContain('chloroplast');
  });

  it('draws a nucleus exactly when it lists one (onion: an ellipse per cell)', () => {
    for (const fov of [450, 1e6]) {
      const px = pixelsPerMicron(r, fov, 0);
      const { ctx, log } = recorder();
      paintCells(ctx, r, 0, 1, px, 0.8);
      const ellipses = log.filter(([name]) => name === 'ellipse').length;
      expect(ellipses > 0).toBe(drawnStructures(0, px).includes('nucleus'));
      expect(hasDetail(0, px)).toBe(fov === 450);
    }
  });
});
