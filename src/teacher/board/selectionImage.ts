/**
 * A picture of the circled area, for an AI that reads pictures on this computer only
 * (pictureReader.ts): made only when the circled part holds no text (a drawing without labels,
 * the learner's own handwriting). Text and formulas are always sent as text, never in a picture.
 *
 * The picture is plain SVG built from the board's model: the learner's strokes (board units) and
 * the drawings' own SVG with their colours written in (the page's CSS does not reach an image).
 * KaTeX and the written words are never rasterised. The SVG becomes a PNG through a `blob:` URL
 * and an OffscreenCanvas (the CSP allows `img-src blob:`). Checked in Chromium
 * (tests/e2e/board-picture.spec.ts); not yet in the desktop app's WebView2 (a canvas tainted by an SVG image would make it fail: then the learner is told and
 * nothing is sent).
 */
import { BOARD_W, type Box } from './layout';
import type { BoardSelection, Point } from './selection';

/** Space kept around the circled area (board units). */
export const CROP_PAD = 16;
/** Longest side of the picture (px): enough to read, far under the 2 MB limit of a picture. */
export const CROP_MAX = 1024;
/** Shortest long side (px): a small area is enlarged so the model can see it. */
export const CROP_MIN = 384;

export interface CropColors {
  background: string;
  student: string;
}

export interface CropInput {
  /** The circled area (board units). */
  bbox: Box;
  /** The learner's strokes on that face (board units). */
  strokes: readonly { points: readonly Point[] }[];
  /** Drawings in the area: their box and their own SVG (colours inlined). */
  figures: readonly { box: Box; markup: string }[];
  colors: CropColors;
}

/** Only plain colour values reach the SVG (they come from the page's CSS, still checked). */
function safeColor(value: string, fallback: string): string {
  const v = value.trim();
  return /^[#a-zA-Z0-9(),.%\s-]{1,64}$/.test(v) ? v : fallback;
}

const n = (v: number) => (Math.round(v * 10) / 10).toString();

/** The SVG of the circled area and its size in px (pure: tested without a browser). */
export function cropSvg(input: CropInput): { svg: string; w: number; h: number } {
  const x0 = Math.max(0, input.bbox.x - CROP_PAD);
  const y0 = Math.max(0, input.bbox.y - CROP_PAD);
  const x1 = Math.min(BOARD_W, input.bbox.x + input.bbox.w + CROP_PAD);
  const y1 = input.bbox.y + input.bbox.h + CROP_PAD;
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);
  const long = Math.max(bw, bh);
  const k = long > CROP_MAX ? CROP_MAX / long : long < CROP_MIN ? CROP_MIN / long : 1;
  const w = Math.max(1, Math.round(bw * k));
  const h = Math.max(1, Math.round(bh * k));
  const background = safeColor(input.colors.background, '#ffffff');
  const student = safeColor(input.colors.student, '#7a3fc2');
  const figures = input.figures
    .map((f) => `<g transform="translate(${n(f.box.x)} ${n(f.box.y)})">${f.markup}</g>`)
    .join('');
  const strokes = input.strokes
    .filter((s) => s.points.length > 1)
    .map(
      (s) =>
        `<polyline points="${s.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${student}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(w)}" height="${String(h)}" viewBox="${n(x0)} ${n(y0)} ${n(bw)} ${n(bh)}">` +
    `<rect x="${n(x0)}" y="${n(y0)}" width="${n(bw)}" height="${n(bh)}" fill="${background}"/>` +
    `${figures}${strokes}</svg>`;
  return { svg, w, h };
}

/** Style properties written into a drawing's SVG (the page's CSS does not reach an image). */
const INLINE = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'font-family',
  'font-size',
  'font-weight',
  'opacity',
] as const;

/** A drawing's SVG as shown, with its colours written in (null when it is not an SVG drawing). */
export function figureMarkup(id: string, root: ParentNode = document): string | null {
  const host = [...root.querySelectorAll<HTMLElement>('.board__drawing[data-draw-id]')].find(
    (el) => el.dataset.drawId === id,
  );
  const svg = host?.querySelector('svg');
  if (!svg) return null;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll('*')];
  const to = [copy, ...copy.querySelectorAll('*')];
  from.forEach((el, i) => {
    const target = to[i];
    if (!target) return;
    const style = getComputedStyle(el);
    const inline = INLINE.map((p) => `${p}:${style.getPropertyValue(p)}`).join(';');
    // Drawn whole: the "draw itself in" dash animation is not part of the picture.
    target.setAttribute('style', `${inline};stroke-dasharray:none;stroke-dashoffset:0`);
    target.removeAttribute('class');
  });
  const out = new XMLSerializer().serializeToString(copy);
  // The serializer declares the SVG namespace of an element made in it; declaring it again
  // repeats the attribute (invalid XML: the picture would not load).
  return /^<svg\b[^>]*\sxmlns="/u.test(out)
    ? out
    : out.replace(/^<svg\b/u, '<svg xmlns="http://www.w3.org/2000/svg"');
}

/** The SVG as PNG bytes (blob: URL → image → OffscreenCanvas). */
export async function svgToPng(svg: string, w: number, h: number): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, 0, 0, w, h);
    const png = await canvas.convertToBlob({ type: 'image/png' });
    return await png.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The page's board colours (CSS variables), for the picture. */
function boardColors(): CropColors {
  const node = document.querySelector('.board__viewport') ?? document.documentElement;
  const style = getComputedStyle(node);
  return {
    background: style.getPropertyValue('--board-bg') || '#ffffff',
    student: style.getPropertyValue('--board-student') || '#7a3fc2',
  };
}

/**
 * The PNG of a selection that holds no text: its drawings and the learner's strokes on its face.
 * Null when there is nothing to show or the picture could not be made (the learner is told).
 */
export async function selectionPicture(
  selection: BoardSelection,
  strokes: readonly { face: number; points: readonly Point[] }[],
): Promise<ArrayBuffer | null> {
  if (selection.status !== 'picture') return null;
  try {
    const figures = selection.figures.flatMap((id) => {
      const host = [
        ...document.querySelectorAll<HTMLElement>('.board__drawing[data-draw-id]'),
      ].find((el) => el.dataset.drawId === id);
      const markup = figureMarkup(id);
      if (!host || !markup) return [];
      const box = {
        x: parseFloat(host.style.left) || 0,
        y: parseFloat(host.style.top) || 0,
        w: parseFloat(host.style.width) || 0,
        h: parseFloat(host.style.height) || 0,
      };
      return [{ box, markup }];
    });
    const own = strokes.filter((s) => s.face === selection.face);
    if (figures.length === 0 && own.length === 0) return null;
    const crop = cropSvg({ bbox: selection.bbox, strokes: own, figures, colors: boardColors() });
    return await svgToPng(crop.svg, crop.w, crop.h);
  } catch (e) {
    console.warn('[board-picture]', e instanceof Error ? e.message : String(e));
    return null;
  }
}
