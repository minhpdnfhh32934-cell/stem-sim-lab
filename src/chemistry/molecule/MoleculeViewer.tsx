import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';
import { elementBySymbol } from '../data/elements';
import {
  bondPolarity,
  deltaEn,
  lonePairDirections,
  lonePairs,
  neighbors,
  polarity,
  type Molecule,
  type Vec3,
} from '../data/molecules';

/** Qualitative partial charge sign per atom from the electronegativity differences. */
function partialSigns(m: Molecule): ('+' | '−' | '')[] {
  const acc = m.atoms.map(() => 0);
  for (const b of m.bonds) {
    const xa = elementBySymbol(m.atoms[b.a]?.el ?? '')?.en_pauling ?? null;
    const xb = elementBySymbol(m.atoms[b.b]?.el ?? '')?.en_pauling ?? null;
    if (xa === null || xb === null) continue;
    acc[b.a] = (acc[b.a] ?? 0) + (xa - xb);
    acc[b.b] = (acc[b.b] ?? 0) + (xb - xa);
  }
  return acc.map((d) => (d >= 0.4 ? '−' : d <= -0.4 ? '+' : ''));
}

export interface ViewerOptions {
  lonePairs: boolean;
  labels: boolean;
  dipole: boolean;
  /** Atom indices highlighted (picked). */
  selectedAtoms: number[];
  selectedBond: number | null;
  /** Colour bonds by Δχ type instead of grey. */
  polarityColors?: boolean;
}

interface Props extends ViewerOptions {
  molecule: Molecule;
  onPickAtom?: (index: number, additive: boolean) => void;
  onPickBond?: (index: number) => void;
  ariaLabel: string;
}

const BOND_R = 0.075;

/** Ball radius: scaled covalent radius (Cordero), so H is visibly smaller than Cl. */
function atomRadius(el: string): number {
  const r = elementBySymbol(el)?.covalent_radius_pm ?? 75;
  return Math.max(0.18, (r / 100) * 0.42);
}

function atomColor(el: string): string {
  return elementBySymbol(el)?.jmol_color ?? '#ff1493';
}

/**
 * Three.js ball-and-stick viewer: rotate (drag), zoom (wheel), pan (right drag); click an
 * atom or bond to pick it, Shift+click to pick up to three atoms for measurements.
 * Renders on demand only (no idle GPU use on weak laptops).
 */
export function MoleculeViewer(props: Props) {
  const { molecule, lonePairs: showLp, labels, dipole, selectedAtoms, selectedBond } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const tier = useTierConfig();
  const theme = useResolvedTheme();
  const polarityColors = props.polarityColors ?? false;
  // Keeps the camera when only the selection or display options change.
  const viewRef = useRef<{ id: string; pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const cbRef = useRef({ atom: props.onPickAtom, bond: props.onPickBond });
  useEffect(() => {
    cbRef.current = { atom: props.onPickAtom, bond: props.onPickBond };
  });

  useEffect(() => {
    const host = hostRef.current;
    const labelHost = labelRef.current;
    if (!host || !labelHost) return;
    const css = getComputedStyle(document.documentElement);
    const token = (n: string) => css.getPropertyValue(n).trim();

    const renderer = new THREE.WebGLRenderer({
      antialias: tier.antialias,
      alpha: true,
      // Keeps the last frame readable for "Xuất ảnh PNG" (views render on demand only).
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.className = 'mol-viewer__canvas';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      host.clientWidth / Math.max(1, host.clientHeight),
      0.1,
      200,
    );
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(4, 6, 8);
    camera.add(sun);
    scene.add(camera);

    const disposables: { dispose: () => void }[] = [];
    const seg = Math.max(8, tier.sphereSegments);
    const sphereGeo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    const cylGeo = new THREE.CylinderGeometry(BOND_R, BOND_R, 1, Math.max(6, seg / 2), 1);
    disposables.push(sphereGeo, cylGeo);
    const matCache = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const key = `${color}|${JSON.stringify(opts)}`;
      let m = matCache.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, ...opts });
        matCache.set(key, m);
        disposables.push(m);
      }
      return m;
    };

    const group = new THREE.Group();
    scene.add(group);
    const pickables: THREE.Object3D[] = [];
    const v = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

    // Atoms
    const atomMeshes: THREE.Mesh[] = molecule.atoms.map((a, i) => {
      const mesh = new THREE.Mesh(sphereGeo, mat(atomColor(a.el)));
      mesh.scale.setScalar(atomRadius(a.el));
      mesh.position.copy(v(a.xyz));
      mesh.userData = { atom: i };
      group.add(mesh);
      pickables.push(mesh);
      return mesh;
    });

    // Selection halos
    const halo = mat(token('--accent') || '#2f62d8', {
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    for (const i of selectedAtoms) {
      const a = molecule.atoms[i];
      if (!a) continue;
      const m = new THREE.Mesh(sphereGeo, halo);
      m.scale.setScalar(atomRadius(a.el) * 1.35);
      m.position.copy(v(a.xyz));
      group.add(m);
    }

    // Bonds
    const bondColor = token('--text-faint') || '#8a93a5';
    const cyl = (
      p: THREE.Vector3,
      q: THREE.Vector3,
      material: THREE.Material,
      userData: object,
    ) => {
      const d = new THREE.Vector3().subVectors(q, p);
      const mesh = new THREE.Mesh(cylGeo, material);
      mesh.scale.set(1, d.length(), 1);
      mesh.position.copy(p).addScaledVector(d, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      mesh.userData = userData;
      group.add(mesh);
      pickables.push(mesh);
    };
    molecule.bonds.forEach((b, k) => {
      const A = molecule.atoms[b.a];
      const B = molecule.atoms[b.b];
      if (!A || !B) return;
      const p = v(A.xyz);
      const q = v(B.xyz);
      const dir = new THREE.Vector3().subVectors(q, p).normalize();
      // Offset direction for multiple bonds: in the plane of a neighbouring atom when possible.
      const other =
        neighbors(molecule, b.a).find((j) => j !== b.b) ??
        neighbors(molecule, b.b).find((j) => j !== b.a);
      let off = new THREE.Vector3(0, 0, 1);
      if (other !== undefined) {
        const o = molecule.atoms[other];
        if (o) off = new THREE.Vector3().subVectors(v(o.xyz), p);
      }
      off.sub(dir.clone().multiplyScalar(off.dot(dir)));
      if (off.lengthSq() < 1e-6) off = new THREE.Vector3(1, 0, 0).cross(dir);
      if (off.lengthSq() < 1e-6) off = new THREE.Vector3(0, 1, 0).cross(dir);
      off.normalize();
      const selected = selectedBond === k;
      const color = selected ? token('--accent') || '#2f62d8' : bondColor;
      const material = mat(color);
      // Half bonds in the atom colours read better; keep grey when selected.
      const half = (shift: THREE.Vector3, m1: THREE.Material, m2: THREE.Material) => {
        const pm = p.clone().add(shift);
        const qm = q.clone().add(shift);
        const mid = pm.clone().lerp(qm, 0.5);
        cyl(pm, mid, m1, { bond: k });
        cyl(mid, qm, m2, { bond: k });
      };
      let mA: THREE.Material = selected ? material : mat(atomColor(A.el));
      let mB: THREE.Material = mA === material ? material : mat(atomColor(B.el));
      if (polarityColors && !selected) {
        const d = deltaEn(molecule, b);
        const type = d === null ? 'nonpolar' : bondPolarity(d);
        const c = type === 'ionic' ? '--chart-4' : type === 'polar' ? '--chart-2' : '--text-faint';
        mA = mat(token(c) || bondColor);
        mB = mA;
      }
      const gap = 0.17;
      if (b.aromatic) {
        half(new THREE.Vector3(), mA, mB);
        // Dashed second line for the delocalised π system.
        for (let s = 0.2; s < 0.8; s += 0.2) {
          cyl(
            p
              .clone()
              .lerp(q, s)
              .addScaledVector(off, gap * 0.9),
            p
              .clone()
              .lerp(q, s + 0.1)
              .addScaledVector(off, gap * 0.9),
            material,
            { bond: k },
          );
        }
      } else if (b.order === 1) {
        half(new THREE.Vector3(), mA, mB);
      } else if (b.order === 2) {
        half(off.clone().multiplyScalar(gap / 2), mA, mB);
        half(off.clone().multiplyScalar(-gap / 2), mA, mB);
      } else {
        half(new THREE.Vector3(), mA, mB);
        half(off.clone().multiplyScalar(gap), mA, mB);
        half(off.clone().multiplyScalar(-gap), mA, mB);
      }
    });

    // Lone pairs (qualitative lobes)
    if (showLp) {
      const lpMat = mat(token('--chart-3') || '#009e73', {
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      molecule.atoms.forEach((a, i) => {
        if (a.el === 'H' || lonePairs(molecule, i) === 0) return;
        for (const d of lonePairDirections(molecule, i)) {
          const lobe = new THREE.Mesh(sphereGeo, lpMat);
          lobe.scale.set(0.16, 0.16, 0.3);
          const dir = v(d).normalize();
          lobe.position.copy(v(a.xyz)).addScaledVector(dir, atomRadius(a.el) + 0.28);
          lobe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
          group.add(lobe);
        }
      });
    }

    // Net dipole arrow (towards δ−)
    if (dipole) {
      const pol = polarity(molecule);
      if (pol.verdict === 'polar' || pol.verdict === 'weak') {
        const dir = v(pol.vector).normalize();
        const len = 1.1 + Math.min(1.4, pol.magnitude);
        const start = dir.clone().multiplyScalar(-len / 2);
        const arrow = new THREE.ArrowHelper(
          dir,
          start,
          len,
          token('--chart-4') || '#d55e00',
          0.35,
          0.22,
        );
        group.add(arrow);
        disposables.push({
          dispose: () => {
            arrow.dispose();
          },
        });
      }
    }

    // Frame the camera on the bounding sphere.
    const box = new THREE.Box3().setFromObject(group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(1.2, sphere.radius);
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.05;
    const saved = viewRef.current?.id === molecule.id ? viewRef.current : null;
    if (saved) camera.position.copy(saved.pos);
    else camera.position.set(sphere.center.x, sphere.center.y + r * 0.2, sphere.center.z + dist);
    camera.lookAt(saved?.target ?? sphere.center);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(saved?.target ?? sphere.center);
    controls.minDistance = r * 0.8;
    controls.maxDistance = dist * 4;
    controls.update();

    // HTML labels, positioned after each render.
    labelHost.replaceChildren();
    const signs = polarityColors ? partialSigns(molecule) : [];
    const labelEls = molecule.atoms.map((a, i) => {
      const el = document.createElement('span');
      el.className = 'mol-viewer__label';
      const delta = signs[i] ? ` δ${signs[i]}` : '';
      el.textContent = `${a.charge ? `${a.el}${a.charge > 0 ? '+' : '−'}` : a.el}${delta}`;
      el.hidden = !labels || (a.el === 'H' && molecule.atoms.length > 12);
      labelHost.appendChild(el);
      return el;
    });
    const tmp = new THREE.Vector3();
    const placeLabels = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      atomMeshes.forEach((m, i) => {
        const el = labelEls[i];
        if (!el || el.hidden) return;
        tmp.copy(m.position).project(camera);
        el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
        el.style.opacity = tmp.z < 1 ? '1' : '0';
      });
    };

    let frame = 0;
    const render = () => {
      frame = 0;
      renderer.render(scene, camera);
      placeLabels();
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    controls.addEventListener('change', request);
    request();

    // Picking (a click without a drag)
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      down = null;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      const data = hit?.object.userData as { atom?: number; bond?: number } | undefined;
      if (data?.atom !== undefined) cbRef.current.atom?.(data.atom, e.shiftKey || e.ctrlKey);
      else if (data?.bond !== undefined) cbRef.current.bond?.(data.bond);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

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

    return () => {
      viewRef.current = {
        id: molecule.id,
        pos: camera.position.clone(),
        target: controls.target.clone(),
      };
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      disposables.forEach((d) => {
        d.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelHost.replaceChildren();
    };
  }, [molecule, showLp, labels, dipole, selectedAtoms, selectedBond, polarityColors, tier, theme]);

  return (
    <div className="mol-viewer" role="img" aria-label={props.ariaLabel}>
      <div ref={hostRef} className="mol-viewer__gl" />
      <div ref={labelRef} className="mol-viewer__labels" aria-hidden="true" />
    </div>
  );
}
