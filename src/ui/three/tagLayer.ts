/**
 * Small text tags over a 3D canvas (letters of bases, short names, position numbers): a pool of
 * page-drawn elements placed after each frame at projected points (sharp at any zoom). Tags are
 * added in priority order; a tag whose screen cells are taken, or that is off the safe area or
 * behind the camera, is skipped, so tags never overlap. Hidden from screen readers like the name
 * labels (the view describes the picture itself). Once the pool has grown, a frame allocates
 * nothing.
 */
import * as THREE from 'three';
import type { Rect } from './labels';

/** Looks of a tag (CSS modifier): a base letter, a short word, a position number. */
export type TagVariant = 'letter' | 'word' | 'tick';

/** Screen cell (px): one letter per cell. */
const CELL = 10;

interface Node {
  el: HTMLSpanElement;
  text: string;
  variant: TagVariant | '';
}

export class TagLayer {
  readonly el: HTMLDivElement;
  private readonly nodes: Node[] = [];
  private used = 0;
  private grid = new Uint8Array(0);
  private cols = 0;
  private rows = 0;
  private width = 1;
  private height = 1;
  private safe: Rect = { left: 0, top: 0, right: 1, bottom: 1 };
  private readonly vp = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();

  constructor(host: HTMLElement, className = '') {
    this.el = document.createElement('div');
    this.el.className = `three-tags ${className}`.trim();
    this.el.setAttribute('aria-hidden', 'true');
    host.appendChild(this.el);
  }

  /** Starts a frame: the camera, the canvas size (px) and the area tags may use. */
  begin(camera: THREE.Camera, width: number, height: number, safe: Rect): void {
    camera.updateMatrixWorld();
    this.vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.safe = safe;
    const cols = Math.ceil(this.width / CELL);
    const rows = Math.ceil(this.height / CELL);
    if (cols * rows !== this.grid.length) this.grid = new Uint8Array(cols * rows);
    else this.grid.fill(0);
    this.cols = cols;
    this.rows = rows;
    this.used = 0;
  }

  /** Screen point (px) of a world point, or null behind the camera. */
  private project(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 | null {
    out.set(x, y, z).applyMatrix4(this.vp);
    if (out.z < -1 || out.z > 1) return null;
    out.set(((out.x + 1) / 2) * this.width, ((1 - out.y) / 2) * this.height, 0);
    return out;
  }

  /** Pixels between two world points on screen now (0 when one is behind the camera). */
  spacing(a: readonly number[], b: readonly number[]): number {
    const p = this.project(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, this.v);
    if (!p) return 0;
    const px = p.x;
    const py = p.y;
    const q = this.project(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, this.w);
    return q ? Math.hypot(q.x - px, q.y - py) : 0;
  }

  /**
   * Places a tag at a world point if its cells are free (`cells` wide). Returns whether it was
   * shown.
   */
  add(text: string, x: number, y: number, z: number, variant: TagVariant, cells = 1): boolean {
    const p = this.project(x, y, z, this.v);
    if (!p) return false;
    const s = this.safe;
    if (p.x < s.left || p.x > s.right || p.y < s.top || p.y > s.bottom) return false;
    const cy = Math.floor(p.y / CELL);
    const c0 = Math.floor(p.x / CELL) - Math.floor((cells - 1) / 2);
    if (cy < 0 || cy >= this.rows) return false;
    for (let c = c0; c < c0 + cells; c++) {
      if (c < 0 || c >= this.cols) return false;
      if (this.grid[cy * this.cols + c]) return false;
    }
    for (let c = c0; c < c0 + cells; c++) this.grid[cy * this.cols + c] = 1;
    const n = this.node();
    if (n.text !== text) {
      n.text = text;
      n.el.textContent = text;
    }
    if (n.variant !== variant) {
      n.variant = variant;
      n.el.className = `three-tag three-tag--${variant}`;
    }
    n.el.hidden = false;
    n.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
    return true;
  }

  private node(): Node {
    let n = this.nodes[this.used];
    if (!n) {
      const el = document.createElement('span');
      this.el.appendChild(el);
      n = { el, text: '', variant: '' };
      this.nodes.push(n);
    }
    this.used++;
    return n;
  }

  /** Ends a frame: tags not added this frame are hidden. */
  end(): void {
    for (let i = this.used; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n && !n.el.hidden) n.el.hidden = true;
    }
  }

  /** Texts shown now (tests). */
  shown(): string[] {
    return this.nodes.filter((n) => !n.el.hidden).map((n) => n.text);
  }

  clear(): void {
    this.used = 0;
    this.end();
  }

  dispose(): void {
    this.nodes.length = 0;
    this.el.remove();
  }
}
