import { act, fireEvent, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIERS } from '@/perf/tiers';
import { quality3d } from './quality3d';
import type { RendererFactory } from './renderer';
import { fakeRenderer, withReducedMotion } from './testing';
import { CAMERA_MOVE_MS, useThreeHost, type ThreeHost } from './useThreeHost';
import * as THREE from 'three';

const frames: FrameRequestCallback[] = [];
let now = 1000;

beforeEach(() => {
  frames.length = 0;
  now = 1000;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function flush(dt = 16) {
  now += dt;
  const due = frames.splice(0);
  act(() => {
    for (const cb of due) cb(now);
  });
}

/** Receives the host after each render. */
interface Out {
  host: ThreeHost | null;
  set: (h: ThreeHost | null) => void;
}
const outBox = (): Out => {
  const o: Out = {
    host: null,
    set: (h) => {
      o.host = h;
    },
  };
  return o;
};

function Host(props: { factory: RendererFactory; onFail?: () => void; out: Out }) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useThreeHost(ref, {
    createRenderer: props.factory,
    quality: quality3d('medium', TIERS.medium),
    fov: 40,
    canvasClass: 'test-canvas',
    onFail: props.onFail ?? (() => undefined),
    debug: (h) => {
      const un = (window.__simlab3d ??= {});
      un.test = { frames: () => h.frames };
      return () => {
        delete window.__simlab3d?.test;
      };
    },
  });
  const { out } = props;
  useEffect(() => {
    out.set(host.current);
  });
  return <div ref={ref} data-testid="host" />;
}

describe('useThreeHost', () => {
  it('creates the renderer once, draws on demand, frees everything on unmount', () => {
    const { factory, made } = fakeRenderer();
    const out = outBox();
    const view = render(<Host factory={factory} out={out} />);
    const h = out.host;
    if (!h) throw new Error('no host');
    expect(made).toHaveLength(1);
    expect(view.container.querySelector('canvas.test-canvas')).not.toBeNull();
    expect(window.__simlab3d?.test).toBeDefined();
    h.setScene(new THREE.Scene());
    h.request();
    h.request();
    expect(frames).toHaveLength(1);
    flush();
    expect(made[0]?.render).toHaveBeenCalledTimes(1);
    // Nothing moves: no further frame is asked for.
    expect(frames).toHaveLength(0);
    view.unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(made[0]?.forceContextLoss).toHaveBeenCalled();
    expect(made[0]?.domElement.isConnected).toBe(false);
    expect(window.__simlab3d?.test).toBeUndefined();
  });

  it('a renderer that cannot start reports the failure', () => {
    const onFail = vi.fn();
    const failing: RendererFactory = () => {
      throw new Error('no WebGL');
    };
    render(<Host factory={failing} onFail={onFail} out={outBox()} />);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('a lost GPU context is reported (never retried)', () => {
    const onFail = vi.fn();
    const { factory, made } = fakeRenderer();
    render(<Host factory={factory} onFail={onFail} out={outBox()} />);
    fireEvent(made[0]!.domElement, new Event('webglcontextlost', { cancelable: true }));
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(1);
  });

  it('camera moves glide over CAMERA_MOVE_MS, and are instant with reduced motion', () => {
    const { factory } = fakeRenderer();
    const out = outBox();
    render(<Host factory={factory} out={out} />);
    const h = out.host!;
    h.setScene(new THREE.Scene());
    h.place({ target: [0, 0, 0], position: [0, 0, 10], min: 2, max: 50 });
    flush();
    h.place({ target: [0, 0, 0], position: [10, 0, 0], min: 2, max: 50 }, { animate: true });
    flush(CAMERA_MOVE_MS / 2);
    const mid = h.camera.position.clone();
    expect(mid.x).toBeGreaterThan(0.5);
    expect(mid.z).toBeGreaterThan(0.5);
    expect(mid.length()).toBeCloseTo(10, 6);
    flush(CAMERA_MOVE_MS);
    expect(h.camera.position.x).toBeCloseTo(10, 6);
    expect(h.camera.position.z).toBeCloseTo(0, 6);
    expect(h.moving()).toBe(false);
    const restore = withReducedMotion();
    try {
      h.place({ target: [0, 0, 0], position: [0, 10, 0.001], min: 2, max: 50 }, { animate: true });
      expect(h.camera.position.y).toBeCloseTo(10, 3);
      expect(h.moving()).toBe(false);
    } finally {
      restore();
    }
  });

  it('arrow keys orbit the camera around its target', () => {
    const { factory } = fakeRenderer();
    const out = outBox();
    const view = render(<Host factory={factory} out={out} />);
    const h = out.host!;
    h.setScene(new THREE.Scene());
    h.place({ target: [0, 0, 0], position: [0, 0, 10], min: 2, max: 50 });
    fireEvent.keyDown(view.getByTestId('host'), { key: 'ArrowLeft' });
    for (let k = 0; k < 60; k++) flush();
    expect(Math.abs(h.camera.position.x)).toBeGreaterThan(0.5);
    expect(h.camera.position.length()).toBeCloseTo(10, 6);
  });
});
