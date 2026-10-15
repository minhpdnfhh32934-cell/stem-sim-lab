import { describe, expect, it } from 'vitest';
import { CROP_MAX, CROP_MIN, CROP_PAD, cropSvg } from './selectionImage';

/**
 * The picture of a circled area without text (item 2) is plain SVG built from the board model:
 * the learner's strokes and the drawings' own SVG, never the written words or KaTeX.
 */
describe('the picture of a circled area', () => {
  const colors = { background: '#fdfcf7', student: '#7a3fc2' };

  it('frames the circled area with a margin, the strokes in board units', () => {
    const crop = cropSvg({
      bbox: { x: 400, y: 300, w: 200, h: 100 },
      strokes: [
        {
          points: [
            [410, 310],
            [500, 380],
          ],
        },
      ],
      figures: [],
      colors,
    });
    expect(crop.svg).toContain(
      `viewBox="${String(400 - CROP_PAD)} ${String(300 - CROP_PAD)} ${String(200 + 2 * CROP_PAD)} ${String(100 + 2 * CROP_PAD)}"`,
    );
    expect(crop.svg).toContain('<polyline points="410,310 500,380"');
    expect(crop.svg).toContain('stroke="#7a3fc2"');
    expect(crop.svg).toContain('fill="#fdfcf7"');
    // A small area is enlarged so the model can see it; the ratio stays.
    expect(Math.max(crop.w, crop.h)).toBe(CROP_MIN);
    expect(crop.w / crop.h).toBeCloseTo(232 / 132, 1);
  });

  it('a large area is made smaller; drawings are placed at their box', () => {
    const crop = cropSvg({
      bbox: { x: 0, y: 0, w: 1200, h: 3000 },
      strokes: [],
      figures: [{ box: { x: 860, y: 140, w: 300, h: 200 }, markup: '<svg width="300"></svg>' }],
      colors,
    });
    expect(Math.max(crop.w, crop.h)).toBe(CROP_MAX);
    expect(crop.svg).toContain('<g transform="translate(860 140)"><svg width="300"></svg></g>');
  });

  it('only plain colour values reach the picture', () => {
    const crop = cropSvg({
      bbox: { x: 0, y: 0, w: 100, h: 100 },
      strokes: [
        {
          points: [
            [1, 1],
            [2, 2],
          ],
        },
      ],
      figures: [],
      colors: { background: '"/><script>x</script>', student: 'url(javascript:x)"' },
    });
    expect(crop.svg).not.toContain('<script');
    expect(crop.svg).toContain('fill="#ffffff"');
    expect(crop.svg).toContain('stroke="#7a3fc2"');
  });
});
