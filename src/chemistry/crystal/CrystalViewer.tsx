import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';
import { elementBySymbol } from '../data/elements';
import type { SiteKind, UnitCell, Vec3 } from './lattice';

/** Drawn sphere radius (units of a): sized to read the picture, not to scale. */
const DRAWN_RADIUS: Record<SiteKind, number> = { M: 0.16, Na: 0.12, Cl: 0.19 };

/**
 * One unit cell in 3D: a sphere per site, the cell's edges, orbit with the mouse or the arrow keys
 * (OrbitControls). Rendered on demand; everything is freed when the cell changes or on unmount.
 */
export function CrystalViewer({
  cell,
  label,
  onFail,
}: {
  cell: UnitCell;
  label: string;
  onFail: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tier = useTierConfig();
  const theme = useResolvedTheme();
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: tier.antialias,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      failRef.current();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      host.clientWidth / Math.max(1, host.clientHeight),
      0.05,
      100,
    );
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 5, 6);
    camera.add(sun);
    scene.add(camera);

    // The c axis of the hexagonal prism (z) is drawn upwards (three.js y).
    const v = (p: Vec3) => new THREE.Vector3(p[0], p[2], p[1]);
    const box = new THREE.Box3();
    for (const s of cell.sites) box.expandByPoint(v(s.p));
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();

    const seg = Math.max(12, tier.sphereSegments);
    const sphere = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    const materials = new Map<SiteKind, THREE.MeshStandardMaterial>();
    const colour = (k: SiteKind) =>
      k === 'M' ? token('--chart-2', '#3b82c4') : (elementBySymbol(k)?.jmol_color ?? '#888888');
    const group = new THREE.Group();
    group.position.copy(centre).negate();
    scene.add(group);
    for (const s of cell.sites) {
      let m = materials.get(s.kind);
      if (!m) {
        m = new THREE.MeshStandardMaterial({
          color: colour(s.kind),
          roughness: 0.45,
          metalness: 0.1,
        });
        materials.set(s.kind, m);
      }
      const mesh = new THREE.Mesh(sphere, m);
      mesh.scale.setScalar(DRAWN_RADIUS[s.kind]);
      mesh.position.copy(v(s.p));
      group.add(mesh);
    }
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(
      cell.edges.flatMap(([a, b]) => [v(a), v(b)]),
    );
    const edgeMat = new THREE.LineBasicMaterial({ color: token('--text-muted', '#5b6470') });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    const dist = size * 1.9;
    camera.position.set(dist * 0.55, dist * 0.45, dist * 0.7);
    camera.lookAt(0, 0, 0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = size * 0.6;
    controls.maxDistance = dist * 3;
    controls.listenToKeyEvents(host);
    controls.update();

    let frame = 0;
    const render = () => {
      frame = 0;
      renderer.render(scene, camera);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    controls.addEventListener('change', request);
    request();
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      request();
    });
    ro.observe(host);
    const lost = (e: Event) => {
      e.preventDefault();
      failRef.current();
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      controls.dispose();
      sphere.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      for (const m of materials.values()) m.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [cell, tier, theme]);

  // Keyboard users turn the cell with the arrow keys (OrbitControls listens on this element).
  return (
    <div ref={hostRef} className="crystal-viewer" role="img" aria-label={label} tabIndex={0} />
  );
}
