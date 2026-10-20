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
}

const SVG = 'http://www.w3.org/2000/svg';

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
      dot.setAttribute('r', '2.5');
      this.svg.append(line, dot);
      this.el.appendChild(box);
      n = { box, line, dot, text: '', w: 0, h: 0 };
      this.nodes.set(item.id, n);
    }
    if (n.text !== item.text || n.w === 0) {
      n.text = item.text;
      n.box.textContent = item.text;
      n.box.hidden = false;
      n.w = n.box.offsetWidth;
      n.h = n.box.offsetHeight;
    }
    return n;
  }

  /**
   * Shows `items` (in priority order) for this camera on a canvas of `width` × `height` px,
   * inside `safe` (px, canvas coordinates); at most `cap` labels.
   */
  update(
    items: readonly LabelItem[],
    camera: THREE.Camera,
    width: number,
    height: number,
    safe: Rect,
    cap: number,
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
    const placed = new Map(layoutLabels(anchors, safe, { cap }).map((p) => [p.id, p]));
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
