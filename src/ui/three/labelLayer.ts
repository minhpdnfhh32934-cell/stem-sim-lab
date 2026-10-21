/**
 * The page-drawn layer of name labels over a 3D canvas (DOM adapter of `labels.ts`): sharp text
 * at any zoom, leader lines in one SVG, positions recomputed after each frame. The layer is
 * hidden from screen readers (`aria-hidden`): the canvas has its own description and the parts
 * list is the accessible way to the same names.
 */
import * as THREE from 'three';
import { layoutLabels, type LabelAnchor, type Rect } from './labels';

export interface LabelItem {
  id: string;
  text: string;
  /** World position of the part the label names. */
  point: readonly [number, number, number];
  /** Fill of the anchor ring: the part's role colour (CSS colour; default muted text). */
  color?: string;
  /** The part is behind the subject now: anchor and leader dim to 45 %. */
  behind?: boolean;
}

/** World points whose screen bounds give a rectangle (a chromosome's or a cell's extent). */
export type Hull = readonly (readonly [number, number, number])[];

/** What the labels keep clear of (world space; projected for each frame). */
export interface LabelObstacles {
  /** Data a label box never covers (the chromosomes). */
  avoid?: readonly Hull[];
  /** Separate subjects (cells): a leader never crosses one that does not hold its part. */
  regions?: readonly Hull[];
  /** Screen boxes (px, canvas coordinates) a label box never covers (tags over the picture). */
  rects?: readonly Rect[];
  /** Pixels a label box keeps inside the safe area (clear of the stage's edge). */
  edge?: number;
}

const SVG = 'http://www.w3.org/2000/svg';
const corner = new THREE.Vector3();
const toCorner = new THREE.Vector3();
const lookDir = new THREE.Vector3();

/**
 * Screen bounds (px) of a hull's points seen from `camera` on a `width` × `height` canvas; null
 * when the hull is empty or a point is behind the camera (no reliable projection).
 */
export function screenRect(
  hull: Hull,
  camera: THREE.Camera,
  width: number,
  height: number,
): Rect | null {
  if (hull.length === 0) return null;
  camera.updateMatrixWorld();
  camera.getWorldDirection(lookDir);
  const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const p of hull) {
    corner.set(p[0], p[1], p[2]);
    if (toCorner.copy(corner).sub(camera.position).dot(lookDir) <= 0) return null;
    corner.project(camera);
    const x = ((corner.x + 1) / 2) * width;
    const y = ((1 - corner.y) / 2) * height;
    r.left = Math.min(r.left, x);
    r.right = Math.max(r.right, x);
    r.top = Math.min(r.top, y);
    r.bottom = Math.max(r.bottom, y);
  }
  return r;
}

export class LabelLayer {
  readonly el: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly nodes = new Map<
    string,
    {
      box: HTMLDivElement;
      line: SVGLineElement;
      dot: SVGCircleElement;
      text: string;
      color: string;
      behind: boolean;
      /** Size of the box, measured once per text (no layout reads on every frame). */
      w: number;
      h: number;
    }
  >();
  private readonly v = new THREE.Vector3();
  private readonly toPart = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  /** `className`: extra classes of the layer (it always has `three-labels`). */
  constructor(host: HTMLElement, className = '') {
    this.el = document.createElement('div');
    this.el.className = `three-labels ${className}`.trim();
    this.el.setAttribute('aria-hidden', 'true');
    this.svg = document.createElementNS(SVG, 'svg');
    this.svg.setAttribute('class', 'three-labels__lines');
    this.el.appendChild(this.svg);
    host.appendChild(this.el);
  }

  private node(item: LabelItem) {
    let n = this.nodes.get(item.id);
    if (!n) {
      const box = document.createElement('div');
      box.className = 'three-label';
      const line = document.createElementNS(SVG, 'line');
      line.setAttribute('class', 'three-label__line');
      const dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('class', 'three-label__dot');
      // A 7 px ring (style guide): filled with the role colour, a panel-coloured border.
      dot.setAttribute('r', '3.5');
      this.svg.append(line, dot);
      this.el.appendChild(box);
      n = { box, line, dot, text: '', color: '', behind: false, w: 0, h: 0 };
      this.nodes.set(item.id, n);
    }
    if (n.text !== item.text || n.w === 0) {
      n.text = item.text;
      n.box.textContent = item.text;
      n.box.hidden = false;
      n.w = n.box.offsetWidth;
      n.h = n.box.offsetHeight;
    }
    const color = item.color ?? '';
    if (n.color !== color) {
      n.color = color;
      if (color) n.dot.style.setProperty('--label-anchor', color);
      else n.dot.style.removeProperty('--label-anchor');
    }
    const behind = item.behind ?? false;
    if (n.behind !== behind) {
      n.behind = behind;
      n.dot.classList.toggle('is-behind', behind);
      n.line.classList.toggle('is-behind', behind);
    }
    return n;
  }

  /**
   * Shows `items` (in priority order) for this camera on a canvas of `width` × `height` px,
   * inside `safe` (px, canvas coordinates); at most `cap` labels, clear of `obstacles`.
   */
  update(
    items: readonly LabelItem[],
    camera: THREE.Camera,
    width: number,
    height: number,
    safe: Rect,
    cap: number,
    obstacles: LabelObstacles = {},
  ): void {
    const keep = new Set(items.map((i) => i.id));
    for (const [id, n] of this.nodes) {
      if (keep.has(id)) continue;
      n.box.remove();
      n.line.remove();
      n.dot.remove();
      this.nodes.delete(id);
    }
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.look);
    const anchors: LabelAnchor[] = items.map((item) => {
      const n = this.node(item);
      this.v.set(item.point[0], item.point[1], item.point[2]);
      // Behind the camera: no label.
      const ahead = this.toPart.copy(this.v).sub(camera.position).dot(this.look) > 0;
      this.v.project(camera);
      return {
        id: item.id,
        x: ((this.v.x + 1) / 2) * width,
        y: ((1 - this.v.y) / 2) * height,
        visible: ahead,
        w: n.w,
        h: n.h,
      };
    });
    const rects = (hulls: readonly Hull[] | undefined) =>
      (hulls ?? [])
        .map((hull) => screenRect(hull, camera, width, height))
        .filter((r): r is Rect => r !== null);
    const placed = new Map(
      layoutLabels(anchors, safe, {
        cap,
        avoid: [...rects(obstacles.avoid), ...(obstacles.rects ?? [])],
        regions: rects(obstacles.regions),
        edge: obstacles.edge ?? 0,
      }).map((p) => [p.id, p]),
    );
    this.svg.setAttribute('viewBox', `0 0 ${String(width)} ${String(height)}`);
    for (const [id, n] of this.nodes) {
      const p = placed.get(id);
      const on = !!p;
      n.box.hidden = !on;
      n.line.style.display = on ? '' : 'none';
      n.dot.style.display = on ? '' : 'none';
      if (!p) continue;
      n.box.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      n.line.setAttribute('x1', p.ax.toFixed(1));
      n.line.setAttribute('y1', p.ay.toFixed(1));
      n.line.setAttribute('x2', p.lx.toFixed(1));
      n.line.setAttribute('y2', p.ly.toFixed(1));
      n.dot.setAttribute('cx', p.ax.toFixed(1));
      n.dot.setAttribute('cy', p.ay.toFixed(1));
    }
  }

  /** Labels shown now (for tests and the accessible summary). */
  shown(): string[] {
    return [...this.nodes.entries()].filter(([, n]) => !n.box.hidden).map(([id]) => id);
  }

  clear(): void {
    this.update(
      [],
      new THREE.PerspectiveCamera(),
      1,
      1,
      { left: 0, top: 0, right: 1, bottom: 1 },
      0,
    );
  }

  dispose(): void {
    this.nodes.clear();
    this.el.remove();
  }
}
