import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';
import { elementBySymbol } from '../data/elements';
import type { Mechanism, MechanismFrame } from '../data/reactions';

interface Props {
  mechanism: Mechanism;
  /** Continuous position along the frames: 2.5 = halfway between frame 2 and frame 3. */
  t: number;
  showArrows: boolean;
  labels: boolean;
  ariaLabel: string;
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const radius = (el: string) =>
  Math.max(0.18, ((elementBySymbol(el)?.covalent_radius_pm ?? 75) / 100) * 0.4);
const smooth = (s: number) => s * s * (3 - 2 * s);

interface BondVisual {
  a: number;
  b: number;
  /** Up to three parallel cylinders. */
  meshes: THREE.Mesh[];
}

/**
 * Mechanism player: atoms keep their identity (atom mapping) across key frames; positions
 * between key frames are interpolated (illustrative, labelled in the UI). Bonds that break
 * fade out in the "breaking" colour, bonds that form fade in in the "forming" colour, and
 * partial bonds of transition states are drawn thin and translucent. Curved arrows show
 * the electron flow towards the next key frame.
 */
export function MechanismViewer({ mechanism, t, showArrows, labels, ariaLabel }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const tier = useTierConfig();
  const theme = useResolvedTheme();
  const apiRef = useRef<{ update: (t: number, arrows: boolean, labels: boolean) => void } | null>(
    null,
  );

  useEffect(() => {
    const host = hostRef.current;
    const labelHost = labelRef.current;
    if (!host || !labelHost) return;
    const css = getComputedStyle(document.documentElement);
    const token = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
    const frames = mechanism.frames;

    const renderer = new THREE.WebGLRenderer({ antialias: tier.antialias, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatioCap));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.className = 'mol-viewer__canvas';
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      host.clientWidth / Math.max(1, host.clientHeight),
      0.1,
      300,
    );
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(4, 6, 8);
    camera.add(sun);
    scene.add(camera);

    const disposables: { dispose: () => void }[] = [];
    const seg = Math.max(8, tier.sphereSegments);
    const sphereGeo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, Math.max(6, seg / 2), 1);
    disposables.push(sphereGeo, cylGeo);
    const material = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.05,
        ...opts,
      });
      disposables.push(m);
      return m;
    };

    // Atoms (persistent, keyed by map number)
    const first = frames[0];
    if (!first) return;
    const atomMesh = new Map<number, THREE.Mesh>();
    for (const a of first.atoms) {
      const m = new THREE.Mesh(sphereGeo, material(elementBySymbol(a.el)?.jmol_color ?? '#ff1493'));
      m.scale.setScalar(radius(a.el));
      scene.add(m);
      atomMesh.set(a.map, m);
    }

    // Bonds: union over all frames (+ partial bonds)
    const bondVisuals = new Map<string, BondVisual>();
    const ensureBond = (a: number, b: number) => {
      const k = key(a, b);
      let v = bondVisuals.get(k);
      if (!v) {
        v = {
          a,
          b,
          meshes: [0, 1, 2].map(
            () => new THREE.Mesh(cylGeo, material('#999', { transparent: true })),
          ),
        };
        v.meshes.forEach((m) => {
          scene.add(m);
        });
        bondVisuals.set(k, v);
      }
      return v;
    };
    for (const f of frames) {
      for (const b of f.bonds) ensureBond(b.a, b.b);
      for (const b of f.partial) ensureBond(b.a, b.b);
    }

    const colors = {
      bond: token('--text-faint', '#8a93a5'),
      breaking: token('--chart-4', '#d55e00'),
      forming: token('--chart-3', '#009e73'),
      partial: token('--accent', '#2f62d8'),
      arrow: token('--accent', '#2f62d8'),
    };

    const posOf = (f: MechanismFrame | undefined, map: number): THREE.Vector3 => {
      const a = f?.atoms.find((x) => x.map === map);
      return a ? new THREE.Vector3(a.xyz[0], a.xyz[1], a.xyz[2]) : new THREE.Vector3();
    };
    const orderIn = (f: MechanismFrame | undefined, k: string) =>
      f?.bonds.find((b) => key(b.a, b.b) === k)?.order ?? 0;
    const partialIn = (f: MechanismFrame | undefined, k: string) =>
      f?.partial.some((b) => key(b.a, b.b) === k) ?? false;

    // Arrows (rebuilt when the key frame changes)
    const arrowGroup = new THREE.Group();
    scene.add(arrowGroup);
    const clearArrows = () => {
      for (const c of [...arrowGroup.children]) {
        arrowGroup.remove(c);
        if (c instanceof THREE.Mesh) {
          (c.geometry as THREE.BufferGeometry).dispose();
          (c.material as THREE.Material).dispose();
        }
      }
    };
    const pointOf = (f: MechanismFrame, ids: number[]) => {
      if (ids.length === 1) return posOf(f, ids[0] ?? 0);
      return posOf(f, ids[0] ?? 0)
        .add(posOf(f, ids[1] ?? 0))
        .multiplyScalar(0.5);
    };
    const buildArrows = (f: MechanismFrame) => {
      clearArrows();
      const center = new THREE.Vector3();
      f.atoms.forEach((a) => center.add(new THREE.Vector3(...a.xyz)));
      center.multiplyScalar(1 / Math.max(1, f.atoms.length));
      for (const ar of f.arrows) {
        const p0 = pointOf(f, ar.from);
        const p2 = pointOf(f, ar.to);
        // Lone pair source: start just outside the atom, bulging away from the centre.
        const mid = p0.clone().lerp(p2, 0.5);
        const out = mid.clone().sub(center);
        if (out.lengthSq() < 1e-4) out.set(0, 1, 0);
        const bulge = out.normalize().multiplyScalar(0.55 + 0.25 * p0.distanceTo(p2));
        const p1 = mid.clone().add(bulge);
        const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2.clone().lerp(p1, 0.12));
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.035, 6, false),
          new THREE.MeshBasicMaterial({ color: colors.arrow }),
        );
        arrowGroup.add(tube);
        const end = curve.getPoint(1);
        const dir = curve.getTangent(1).normalize();
        const head = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.3, 10),
          new THREE.MeshBasicMaterial({ color: colors.arrow }),
        );
        head.position.copy(end).addScaledVector(dir, 0.1);
        head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        arrowGroup.add(head);
      }
    };

    // Labels
    labelHost.replaceChildren();
    const labelEls = new Map<number, HTMLSpanElement>();
    for (const a of first.atoms) {
      const el = document.createElement('span');
      el.className = 'mol-viewer__label';
      labelHost.appendChild(el);
      labelEls.set(a.map, el);
    }

    // Camera framing over all frames
    const box = new THREE.Box3();
    for (const f of frames) for (const a of f.atoms) box.expandByPoint(new THREE.Vector3(...a.xyz));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(2, sphere.radius + 0.6);
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.02;
    camera.position.set(sphere.center.x, sphere.center.y + r * 0.15, sphere.center.z + dist);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(sphere.center);
    controls.update();

    const up = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    let current = { t: 0, arrows: true, labels: true };
    let arrowFrame = -1;

    const place = () => {
      const { t: tt } = current;
      const i = Math.max(0, Math.min(frames.length - 1, Math.floor(tt)));
      const s = Math.min(1, Math.max(0, tt - i));
      const A = frames[i];
      const B = frames[Math.min(frames.length - 1, i + 1)];
      const w = smooth(s);
      for (const [map, mesh] of atomMesh) mesh.position.copy(posOf(A, map).lerp(posOf(B, map), w));

      camera.getWorldDirection(up);
      for (const [k, v] of bondVisuals) {
        const pa = atomMesh.get(v.a)?.position;
        const pb = atomMesh.get(v.b)?.position;
        if (!pa || !pb) continue;
        const oA = orderIn(A, k);
        const oB = orderIn(B, k);
        const pA = partialIn(A, k);
        const pB = partialIn(B, k);
        let order = s < 0.5 ? oA || oB : oB || oA;
        let color = colors.bond;
        let opacity = 1;
        let thin = false;
        if (oA && !oB) {
          // Breaking: shown in the breaking colour at the key frame, fading out.
          color = colors.breaking;
          opacity = 1 - w;
          order = oA;
        } else if (!oA && oB) {
          color = colors.forming;
          opacity = Math.max(0.12, w);
          order = oB;
        }
        if (!oA && !oB) {
          const vis = pA && pB ? 1 : pA ? 1 - w : pB ? w : 0;
          order = vis > 0 ? 1 : 0;
          color = colors.partial;
          opacity = 0.55 * vis;
          thin = true;
        }
        const dir = tmp.subVectors(pb, pa);
        const len = dir.length();
        const axis = dir.clone().normalize();
        const off = axis.clone().cross(up).normalize();
        v.meshes.forEach((m, n) => {
          const visible = n < order && opacity > 0.02;
          m.visible = visible;
          if (!visible) return;
          const shift = order === 1 ? 0 : order === 2 ? (n === 0 ? -0.08 : 0.08) : (n - 1) * 0.14;
          const rad = thin ? 0.035 : order === 1 ? 0.075 : 0.05;
          m.scale.set(rad, len, rad);
          m.position.copy(pa).addScaledVector(dir, 0.5).addScaledVector(off, shift);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
          const mm = m.material as THREE.MeshStandardMaterial;
          mm.color.set(color);
          mm.opacity = opacity;
          mm.transparent = opacity < 1;
          mm.depthWrite = opacity >= 1;
        });
      }

      const atKey = s === 0 ? i : -1;
      if (current.arrows && atKey >= 0 && A && A.arrows.length) {
        if (arrowFrame !== atKey) {
          buildArrows(A);
          arrowFrame = atKey;
        }
        arrowGroup.visible = true;
      } else {
        arrowGroup.visible = false;
      }

      const near = s < 0.5 ? A : B;
      for (const [map, el] of labelEls) {
        const a = near?.atoms.find((x) => x.map === map);
        if (!a) continue;
        const charge = a.charge
          ? (Math.abs(a.charge) > 1 ? String(Math.abs(a.charge)) : '') + (a.charge > 0 ? '+' : '−')
          : '';
        // Transition-state fragments are written without charges/radical dots (partial bonds).
        const dot = a.radical && near?.kind !== 'ts' ? '•' : '';
        el.textContent = `${a.el}${near?.kind === 'ts' ? '' : charge}${dot}`;
        el.hidden = !current.labels || (a.el === 'H' && !a.charge && !dot);
      }
    };

    const placeLabels = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const [map, el] of labelEls) {
        if (el.hidden) continue;
        const m = atomMesh.get(map);
        if (!m) continue;
        tmp.copy(m.position).project(camera);
        el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
      }
    };

    let raf = 0;
    const render = () => {
      raf = 0;
      place();
      renderer.render(scene, camera);
      placeLabels();
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };
    controls.addEventListener('change', request);
    apiRef.current = {
      update: (tt, arrows, lbl) => {
        current = { t: tt, arrows, labels: lbl };
        request();
      },
    };
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

    return () => {
      apiRef.current = null;
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      controls.dispose();
      clearArrows();
      disposables.forEach((d) => {
        d.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelHost.replaceChildren();
    };
  }, [mechanism, tier, theme]);

  useEffect(() => {
    apiRef.current?.update(t, showArrows, labels);
  }, [t, showArrows, labels, mechanism, tier, theme]);

  return (
    <div className="mol-viewer" role="img" aria-label={ariaLabel}>
      <div ref={hostRef} className="mol-viewer__gl" />
      <div ref={labelRef} className="mol-viewer__labels" aria-hidden="true" />
    </div>
  );
}
