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

  it('screen points: toScreen ≡ add; addAt places on screen; a solid tag keeps later ones off', () => {
    const host = document.createElement('div');
    const layer = new TagLayer(host);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    const safe = { left: 0, top: 0, right: 400, bottom: 400 };
    layer.begin(camera, 400, 400, safe);
    const at = [0, 0];
    expect(layer.toScreen(0, 0, 0, at)).toBe(true);
    expect(at[0]).toBeCloseTo(200, 5);
    expect(at[1]).toBeCloseTo(200, 5);
    expect(layer.toScreen(0, 0, 20, at)).toBe(false);
    // Off the safe area or not a number: not shown.
    expect(layer.addAt('x', 450, 100, 'word')).toBe(false);
    expect(layer.addAt('x', Number.NaN, 100, 'word')).toBe(false);
    // A plain tag takes only its middle row: one just below it still fits.
    expect(layer.addAt('AB', 100, 105, 'word', 3)).toBe(true);
    expect(layer.addAt('Ab', 100, 117, 'word', 3)).toBe(true);
    // A solid tag takes every row its box covers: the same offset below it is refused.
    expect(layer.addAt('aB', 300, 105, 'word', 3, { solid: true })).toBe(true);
    expect(layer.addAt('ab', 300, 117, 'word', 3)).toBe(false);
    expect(layer.addAt('ab', 300, 135, 'word', 3)).toBe(true);
    // Right-aligned on its point: the box ends there.
    expect(layer.addAt('ab · 1/4', 200, 300, 'word', 8, { end: true })).toBe(true);
    const box = layer.rects().at(-1);
    expect(box?.right).toBeCloseTo(202, 5);
    expect(box?.left).toBeLessThanOrEqual(200 - 80);
    // Its cells lie left of the point: a tag just right of it still fits.
    expect(layer.addAt('x', 205, 300, 'word')).toBe(true);
    layer.end();
    expect(layer.shown()).toEqual(['AB', 'Ab', 'aB', 'ab', 'ab · 1/4', 'x']);
    layer.dispose();
  });
});
