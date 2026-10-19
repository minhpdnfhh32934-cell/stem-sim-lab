/**
 * Test helpers for the 3D views (imported by tests only; jsdom has no WebGL): a fake renderer
 * with spies, a stand-in for `THREE.WebGLRenderer` to use in `vi.mock('three')`, a check that a
 * scene frees everything it created, a ray through a point of the screen, and reduced motion.
 */
import * as THREE from 'three';
import { expect, vi } from 'vitest';
import type { RendererFactory, RendererLike } from './renderer';

/** A renderer that draws nothing; every method is a spy. `made` lists the renderers created. */
export function fakeRenderer(): { factory: RendererFactory; made: RendererLike[] } {
  const made: RendererLike[] = [];
  const factory: RendererFactory = () => {
    const r: RendererLike = {
      domElement: document.createElement('canvas'),
      localClippingEnabled: false,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
      info: {
        memory: { geometries: 0, textures: 0 },
        programs: [],
        render: { calls: 0, triangles: 0 },
      },
    };
    made.push(r);
    return r;
  };
  return { factory, made };
}

/**
 * A stand-in for `THREE.WebGLRenderer` (use inside `vi.mock('three', …)`): a view that creates
 * its own renderer gets this one in jsdom.
 */
export function mockWebGLRenderer(): new (params?: THREE.WebGLRendererParameters) => RendererLike {
  return function WebGLRenderer(): RendererLike {
    return {
      domElement: document.createElement('canvas'),
      localClippingEnabled: false,
      setPixelRatio: () => undefined,
      setSize: () => undefined,
      render: () => undefined,
      dispose: () => undefined,
      info: {
        memory: { geometries: 0, textures: 0 },
        programs: [],
        render: { calls: 0, triangles: 0 },
      },
    };
  } as unknown as new (params?: THREE.WebGLRendererParameters) => RendererLike;
}

/** three.js numbers every material (`Material.id`, documented, missing from @types/three). */
const materialId = (m: unknown) => (m as THREE.Material & { readonly id: number }).id;

/**
 * Builds something with `build` and checks that `dispose` (its own teardown) frees every
 * geometry, material and texture created in between.
 */
export function expectDisposes<T>(build: () => T, dispose: (built: T) => void): void {
  const geo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const mat = vi.spyOn(THREE.Material.prototype, 'dispose');
  const tex = vi.spyOn(THREE.Texture.prototype, 'dispose');
  const next = () => ({
    geometry: new THREE.BufferGeometry().id,
    material: materialId(new THREE.Material()),
    texture: new THREE.Texture().id,
  });
  const start = next();
  const built = build();
  const end = next();
  dispose(built);
  const between = (a: number, b: number) => Array.from({ length: b - a - 1 }, (_, k) => a + 1 + k);
  const freed = {
    geometry: new Set(geo.mock.contexts.map((g) => (g as THREE.BufferGeometry).id)),
    material: new Set(mat.mock.contexts.map(materialId)),
    texture: new Set(tex.mock.contexts.map((t) => (t as THREE.Texture).id)),
  };
  for (const kind of ['geometry', 'material', 'texture'] as const) {
    expect(
      between(start[kind], end[kind]).filter((id) => !freed[kind].has(id)),
      `${kind} not freed`,
    ).toEqual([]);
  }
  geo.mockRestore();
  mat.mockRestore();
  tex.mockRestore();
}

/** A raycaster through a point of the screen (normalised device coordinates) of a camera. */
export function rayAt(camera: THREE.Camera, x: number, y: number): THREE.Raycaster {
  camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x, y), camera);
  return ray;
}

/** Makes `prefers-reduced-motion: reduce` match until the returned function is called. */
export function withReducedMotion(): () => void {
  // jsdom has no matchMedia: the original may be missing.
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  return () => {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}
