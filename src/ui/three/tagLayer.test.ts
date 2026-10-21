import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TagLayer } from './tagLayer';

describe('TagLayer: the boxes of the tags shown', () => {
  it('one box per tag shown this frame, around its point, at least its cells wide', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const layer = new TagLayer(host);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    const safe = { left: 0, top: 0, right: 400, bottom: 400 };
    layer.begin(camera, 400, 400, safe);
    expect(layer.add('5′', 0, 0, 0, 'tick')).toBe(true);
    expect(layer.add('Met', 2, 0, 0, 'word', 4)).toBe(true);
    // Same cell as the first: not shown, so no box.
    expect(layer.add('A', 0, 0, 0, 'letter')).toBe(false);
    layer.end();
    const [a, b, ...rest] = layer.rects();
    expect(rest).toEqual([]);
    expect((a!.left + a!.right) / 2).toBeCloseTo(200, 5);
    expect((a!.top + a!.bottom) / 2).toBeCloseTo(200, 5);
    expect(a!.right - a!.left).toBeGreaterThanOrEqual(10);
    expect(b!.right - b!.left).toBeGreaterThanOrEqual(40);
    expect(b!.left).toBeGreaterThan(a!.right - 10);
    // A new frame starts empty; a cleared layer has none.
    layer.begin(camera, 400, 400, safe);
    layer.add('5′', 0, 0, 0, 'tick');
    layer.end();
    expect(layer.rects()).toHaveLength(1);
    layer.clear();
    expect(layer.rects()).toEqual([]);
    layer.dispose();
    host.remove();
  });
});
