import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LabelLayer } from './labelLayer';

describe('LabelLayer: one tag look', () => {
  it('anchors are 7 px rings in the role colour; parts behind the subject dim', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const layer = new LabelLayer(host);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    const safe = { left: 0, top: 0, right: 400, bottom: 400 };
    layer.update(
      [
        { id: 'a', text: 'Màng tế bào', point: [0.5, 0.5, 0], color: '#16804a' },
        { id: 'b', text: 'Nhân con', point: [-0.5, -0.5, 0], behind: true },
      ],
      camera,
      400,
      400,
      safe,
      6,
    );
    const dots = [...host.querySelectorAll<SVGCircleElement>('.three-label__dot')];
    const lines = [...host.querySelectorAll<SVGLineElement>('.three-label__line')];
    expect(dots.map((d) => d.getAttribute('r'))).toEqual(['3.5', '3.5']);
    expect(dots[0]?.style.getPropertyValue('--label-anchor')).toBe('#16804a');
    // No colour given: the stylesheet's muted default (never a black dot).
    expect(dots[1]?.style.getPropertyValue('--label-anchor')).toBe('');
    expect(dots[0]?.classList.contains('is-behind')).toBe(false);
    expect(dots[1]?.classList.contains('is-behind')).toBe(true);
    expect(lines[1]?.classList.contains('is-behind')).toBe(true);
    // The part comes to the front: the dimming goes.
    layer.update(
      [{ id: 'b', text: 'Nhân con', point: [-0.5, -0.5, 0] }],
      camera,
      400,
      400,
      safe,
      6,
    );
    expect(host.querySelector('.three-label__dot')?.classList.contains('is-behind')).toBe(false);
    layer.dispose();
    host.remove();
  });

  it('a label box keeps clear of the screen boxes it is given (tags drawn over the picture)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const layer = new LabelLayer(host);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    const safe = { left: 0, top: 0, right: 400, bottom: 400 };
    const item = { id: 'a', text: 'mARN', point: [0, 0, 0] as const };
    const x = () => {
      const m = /translate\(([\d.]+)px/.exec(
        host.querySelector<HTMLElement>('.three-label')!.style.transform,
      );
      return Number(m?.[1]);
    };
    // Alone, the label stands just right of its part (200 px) …
    layer.update([item], camera, 400, 400, safe, 6);
    expect(x()).toBeCloseTo(228, 5);
    // … and past a tag that sits there.
    layer.update([item], camera, 400, 400, safe, 6, {
      rects: [{ left: 220, top: 190, right: 300, bottom: 210 }],
    });
    expect(x()).toBeGreaterThanOrEqual(300);
    layer.dispose();
    host.remove();
  });
});
