import type { WorldBounds } from '../types';

/**
 * 2D camera: world coordinates in metres (y up) ↔ screen CSS pixels (y down).
 */
export class Camera {
  /** World point at the centre of the screen. */
  cx = 0;
  cy = 0;
  /** Pixels per metre. */
  scale = 50;
  width = 800;
  height = 600;

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  toScreen(x: number, y: number): { sx: number; sy: number } {
    return {
      sx: this.width / 2 + (x - this.cx) * this.scale,
      sy: this.height / 2 - (y - this.cy) * this.scale,
    };
  }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.cx + (sx - this.width / 2) / this.scale,
      y: this.cy - (sy - this.height / 2) / this.scale,
    };
  }

  /** Frames `b` with `padding` CSS pixels of margin on every side. */
  fit(b: WorldBounds, padding = 48): void {
    const w = Math.max(b.xMax - b.xMin, 1e-6);
    const h = Math.max(b.yMax - b.yMin, 1e-6);
    const sx = (this.width - 2 * padding) / w;
    const sy = (this.height - 2 * padding) / h;
    this.scale = Math.max(1e-6, Math.min(sx, sy));
    this.cx = (b.xMin + b.xMax) / 2;
    this.cy = (b.yMin + b.yMax) / 2;
  }

  /** Zooms by `factor` keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.toWorld(sx, sy);
    this.scale = Math.min(1e7, Math.max(1e-4, this.scale * factor));
    const after = this.toWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
  }

  panPixels(dx: number, dy: number): void {
    this.cx -= dx / this.scale;
    this.cy += dy / this.scale;
  }

  /** Visible world rectangle. */
  visible(): WorldBounds {
    const a = this.toWorld(0, this.height);
    const b = this.toWorld(this.width, 0);
    return { xMin: a.x, yMin: a.y, xMax: b.x, yMax: b.y };
  }
}

/** "Nice" grid spacing (1, 2, 5 × 10ⁿ) so that lines are about `targetPx` apart. */
export function niceStep(pxPerUnit: number, targetPx = 80): number {
  const raw = targetPx / pxPerUnit;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const nice = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return nice * p;
}
