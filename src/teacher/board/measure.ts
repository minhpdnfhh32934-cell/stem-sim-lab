/**
 * Browser measurements for the layout engine: handwritten text through a canvas with the board
 * fonts, formulas through a hidden KaTeX render. Fonts are bundled (OFL, Vietnamese glyphs):
 * Patrick Hand for writing, Pangolin for headings.
 */
import '@fontsource/patrick-hand/400.css';
import '@fontsource/pangolin/400.css';
import { loadKatex } from '@/science-card/katex';
import type { Measure } from './layout';

export const HAND_FONT = '"Patrick Hand", "Segoe Print", cursive';
export const HEAD_FONT = '"Pangolin", "Patrick Hand", cursive';

let ctx: CanvasRenderingContext2D | null = null;
let katex: Awaited<ReturnType<typeof loadKatex>> | null = null;
const mathCache = new Map<string, { w: number; h: number }>();

/** Loads the board fonts and KaTeX before the first layout (widths depend on them). */
export async function prepareMeasure(): Promise<void> {
  katex = await loadKatex();
  try {
    await Promise.all([
      document.fonts.load(`30px ${HAND_FONT}`, 'Bảng trắng ẩ ữ'),
      document.fonts.load(`30px ${HEAD_FONT}`, 'Bảng trắng ẩ ữ'),
    ]);
  } catch {
    /* fallback fonts are measured instead */
  }
}

function context(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  try {
    ctx = document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  return ctx;
}

export const browserMeasure: Measure = {
  text(s, px, heading) {
    const c = context();
    if (!c) return s.length * px * 0.5;
    c.font = `${String(px)}px ${heading ? HEAD_FONT : HAND_FONT}`;
    // Letters are drawn one by one with a little wobble: leave a little room.
    return c.measureText(s).width * 1.04;
  },
  math(tex, px) {
    const key = `${String(px)}|${tex}`;
    const hit = mathCache.get(key);
    if (hit) return hit;
    let size = { w: tex.length * px * 0.5, h: px * 1.4 };
    if (katex) {
      const probe = document.createElement('span');
      probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;font-size:${String(px)}px;white-space:nowrap`;
      try {
        probe.innerHTML = katex.default.renderToString(tex, {
          throwOnError: false,
          displayMode: false,
          trust: false,
        });
        document.body.appendChild(probe);
        const r = probe.getBoundingClientRect();
        if (r.width > 0) size = { w: r.width + 4, h: Math.max(r.height, px * 1.2) };
      } finally {
        probe.remove();
      }
    }
    mathCache.set(key, size);
    return size;
  },
};

/** KaTeX HTML for a board formula (empty until KaTeX is loaded). */
export function renderMath(tex: string): string {
  if (!katex) return '';
  return katex.default.renderToString(tex, {
    throwOnError: false,
    displayMode: false,
    trust: false,
  });
}
