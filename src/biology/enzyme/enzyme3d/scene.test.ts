import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TagLayer } from '@/ui/three/tagLayer';
import { expectDisposes } from '@/ui/three/testing';
import type { Inhibition } from '../enzyme';
import {
  ENZYMES_DRAWN,
  enzymeModel3d,
  formsOf,
  frameAt,
  type EnzymeInputs,
  type EnzymeModel3D,
} from './binding';
import { ALLO_DIR, ENZYME_PLACES, I_PLACES, SP_PLACES } from './layout';
import { ROLES } from '../../view3d/palette';
import {
  ENZYME_RELIEF,
  ENZYME_SEEDS,
  PRODUCT_EASE_S,
  buildEnzymeScene,
  enzymeGeometry,
  enzymeRadiusAt,
  enzymeReliefMask,
  type EnzymeScene,
} from './scene';

const KINDS: Inhibition[] = ['none', 'competitive', 'noncompetitive', 'uncompetitive'];
const token = () => '#808080';
const inputs = (over: Partial<EnzymeInputs> = {}): EnzymeInputs => ({
  vmax: 10,
  km: 2,
  kind: 'competitive',
  inhibitor: 2,
  ki: 1,
  s0: 10,
  view: 'rate',
  ...over,
});
const build = (m: EnzymeModel3D, tier: 'medium' | 'high' = 'medium'): EnzymeScene =>
  buildEnzymeScene({ tier, segments: tier === 'high' ? 24 : 16, kind: m.p.kind, token });

/** A ray from the front (+z) straight onto a point. */
const frontRay = (p: readonly number[]) =>
  new THREE.Raycaster(new THREE.Vector3(p[0], p[1], 40), new THREE.Vector3(0, 0, -1));

describe('3D enzyme scene', () => {
  it('draws each enzyme in the model’s form: substrate in ES/ESI pockets, inhibitor where its type binds', () => {
    for (const kind of KINDS) {
      const m = enzymeModel3d(inputs({ kind }));
      const sc = build(m);
      for (const S of [0, 0.4, 2, 6, 13, m.sTop]) {
        const f = frameAt(m, S);
        sc.setFrame(f);
        const d = sc.drawn();
        const tag = `${kind} S=${String(S)}`;
        expect(d.forms, tag).toEqual(formsOf(f.counts));
        expect(d.boundSubstrate, tag).toBe(f.counts.ES + f.counts.ESI);
        expect(d.inhibitorInSite, tag).toBe(kind === 'competitive' ? f.counts.EI : 0);
        expect(d.inhibitorElsewhere, tag).toBe(
          kind === 'noncompetitive' || kind === 'uncompetitive' ? f.counts.EI + f.counts.ESI : 0,
        );
        expect(d.otherSites, tag).toBe(
          kind === 'noncompetitive'
            ? ENZYMES_DRAWN
            : kind === 'uncompetitive'
              ? f.counts.ES + f.counts.ESI
              : 0,
        );
        expect(d.particles, tag).toEqual(f.particles);
      }
      sc.dispose();
    }
  });

  it('time view: the substrate and product particles drawn always add up to [S]₀’s', () => {
    for (const kind of KINDS) {
      const m = enzymeModel3d(inputs({ kind, view: 'time', s0: 7.5 }));
      const sc = build(m);
      for (let i = 0; i <= 20; i++) {
        const f = frameAt(m, (i / 20) * m.tEnd);
        sc.setFrame(f);
        const p = sc.drawn().particles;
        expect(p.S + p.P, `${kind} step ${String(i)}`).toBe(m.pool0);
        expect(p).toEqual(f.particles);
      }
      sc.dispose();
    }
  });

  it('competitive inhibition at high [S]: almost every enzyme holds substrate in its pocket', () => {
    const m = enzymeModel3d(inputs({ kind: 'competitive', inhibitor: 20, km: 0.1 }));
    const sc = build(m);
    sc.setFrame(frameAt(m, m.sTop));
    expect(m.sTop / m.app.km).toBeGreaterThan(9);
    // [S] = 20 mM, Km_app = 2,1 mM: v/Vmax = 0,905 → 22 of 24.
    expect(sc.drawn().boundSubstrate).toBe(Math.round(24 * (20 / (2.1 + 20))));
    const hi = enzymeModel3d(inputs({ kind: 'competitive', inhibitor: 2, km: 0.1 }));
    sc.setFrame(frameAt(hi, hi.sTop));
    expect(sc.drawn().boundSubstrate).toBeGreaterThanOrEqual(ENZYMES_DRAWN - 1);
    expect(sc.drawn().inhibitorInSite).toBeLessThanOrEqual(1);
    sc.dispose();
  });

  it('the enzyme has an active-site pocket (cartoon) and, when asked, a second site', () => {
    expect(enzymeRadiusAt(0, 1, 0, false)).toBeLessThan(0.7);
    expect(enzymeRadiusAt(1, 0, 0, false)).toBeGreaterThan(0.9);
    const s = [-0.95, -0.2, 0.25];
    const l = Math.hypot(...s);
    const at = (other: boolean) => enzymeRadiusAt(s[0]! / l, s[1]! / l, s[2]! / l, other);
    expect(at(true)).toBeLessThan(at(false));
  });

  it('the surface lumps never reach the pocket or the second site (bound particles keep seats)', () => {
    const allo = ALLO_DIR;
    expect(enzymeReliefMask(0, 1, 0, true)).toBe(0);
    expect(enzymeReliefMask(allo[0], allo[1], allo[2], true)).toBe(0);
    expect(enzymeReliefMask(0, -1, 0, false)).toBe(1);
    for (const other of [false, true]) {
      const g = enzymeGeometry(16, other);
      const pos = g.getAttribute('position');
      const col = g.getAttribute('color');
      const v = new THREE.Vector3();
      let lumpy = 0;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const r = v.length();
        v.normalize();
        const plain = enzymeRadiusAt(v.x, v.y, v.z, other);
        const mask = enzymeReliefMask(v.x, v.y, v.z, other);
        // Lumps at most ±7 % of the radius, and only where the mask allows them.
        expect(Math.abs(r / plain - 1)).toBeLessThanOrEqual(ENZYME_RELIEF.amplitude * mask + 1e-6);
        if (Math.abs(r / plain - 1) > 0.005) lumpy++;
        // Valleys and hollows are shaded darker, never lighter than the plain colour.
        expect(col.getX(i)).toBeLessThanOrEqual(1);
      }
      expect(lumpy).toBeGreaterThan(pos.count / 4);
      g.dispose();
    }
  });

  it('picking: an enzyme (or what it holds) names the enzyme; a particle names its pool place', () => {
    const m = enzymeModel3d(inputs({ kind: 'none', view: 'rate' }));
    const sc = build(m);
    sc.setFrame(frameAt(m, 0));
    // Front-row enzymes, nothing in front of them without particles.
    const front = ENZYME_PLACES.map((e, k) => ({ e, k })).filter(({ e }) => e.center[2] > 0);
    for (const { e, k } of front)
      expect(sc.pick(frontRay(e.center))).toEqual({ kind: 'enzyme', index: k });
    // A substrate particle of the pool.
    sc.setFrame(frameAt(m, m.sTop));
    const n = sc.drawn().particles.S;
    expect(n).toBeGreaterThan(0);
    const hit = SP_PLACES.slice(0, n).findIndex((p) => {
      const got = sc.pick(frontRay(p));
      return got?.kind === 'particle';
    });
    expect(hit).toBeGreaterThanOrEqual(0);
    const p = SP_PLACES[hit] ?? [0, 0, 0];
    const sel = sc.pick(frontRay(p));
    expect(sel?.kind).toBe('particle');
    expect(sel && sel.kind === 'particle' ? sel.pool : null).toBe('sp');
    expect(sc.focusPoint({ kind: 'particle', pool: 'sp', index: n + 5 })).toBeNull();
    expect(sc.focusPoint({ kind: 'particle', pool: 'i', index: 0 })).toBeNull();
    sc.dispose();
    // Inhibitor pool.
    const mi = enzymeModel3d(inputs({ kind: 'competitive' }));
    const si = build(mi);
    si.setFrame(frameAt(mi, 0));
    expect(si.focusPoint({ kind: 'particle', pool: 'i', index: 0 })).toEqual(I_PLACES[0]);
    si.dispose();
  });

  it('only the picked enzyme names its form (the chip and legend give the rest); labels anchor the parts shown', () => {
    const m = enzymeModel3d(inputs({ kind: 'uncompetitive' }));
    const sc = build(m);
    const f = frameAt(m, 6);
    sc.setFrame(f);
    const host = document.createElement('div');
    const layer = new TagLayer(host);
    const seen: string[] = [];
    const add = layer.add.bind(layer);
    layer.add = (text, ...rest) => {
      seen.push(text);
      return add(text, ...rest);
    };
    const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    cam.position.set(0, 0, 40);
    const frameTags = () => {
      seen.length = 0;
      layer.begin(cam, 800, 600, { left: 0, top: 0, right: 800, bottom: 600 });
      sc.tags(layer, (form) => form);
      layer.end();
      return [...seen];
    };
    expect(frameTags()).toEqual([]);
    const forms = formsOf(f.counts);
    for (const index of [0, 5, 17]) {
      sc.setSelection({ kind: 'enzyme', index });
      expect(frameTags()).toEqual([forms[index]]);
    }
    sc.setSelection({ kind: 'particle', pool: 'sp', index: 0 });
    expect(frameTags()).toEqual([]);
    const ids = sc.labelAnchors().map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['complex', 'substrate', 'inhibitor', 'otherSite']));
    layer.dispose();
    sc.dispose();
  });

  it('the quality tier changes only how things are drawn, never a count', () => {
    for (const kind of KINDS) {
      const m = enzymeModel3d(inputs({ kind }));
      const f = frameAt(m, 3);
      const a = build(m, 'medium');
      const b = build(m, 'high');
      a.setFrame(f);
      b.setFrame(f);
      expect(b.drawn()).toEqual(a.drawn());
      a.dispose();
      b.dispose();
    }
  });

  it('frees every geometry and material on dispose', () => {
    for (const kind of KINDS)
      expectDisposes(
        () => {
          const m = enzymeModel3d(inputs({ kind, view: 'time' }));
          const sc = build(m);
          sc.setFrame(frameAt(m, m.tEnd / 3));
          sc.setPhase(2.5);
          sc.setSelection({ kind: 'enzyme', index: 3 });
          return sc;
        },
        (sc) => {
          sc.dispose();
          expect(sc.scene.children).toHaveLength(0);
        },
      );
  });

  it('draw budget: one call per instanced set, never one per enzyme or particle', () => {
    const m = enzymeModel3d(inputs({ kind: 'noncompetitive', view: 'time', s0: 100 }));
    const sc = build(m);
    sc.setFrame(frameAt(m, m.tEnd / 2));
    sc.setSelection({ kind: 'enzyme', index: 0 });
    const stats = sc.drawStats();
    // Measured 2026-10-21 (CPU count, no GPU) after the tank pass (glass walls with an inner
    // face, liquid and its surface, a base, three enzyme shapes, pocket rings, an outline on the
    // picked enzyme): 18 calls, about 81 000 triangles on Medium (High: about 183 000); was 11
    // calls, 73 000. A bigger change must update this budget on purpose.
    expect(stats.calls).toBeLessThanOrEqual(18);
    expect(stats.triangles).toBeLessThan(85_000);
    let instances = 0;
    sc.scene.traverse((o) => {
      if (o instanceof THREE.InstancedMesh && o.visible) instances += o.count;
    });
    // Medium's 3D instance budget is 600 (quality3d: 4000 × 15 %).
    expect(instances).toBeLessThanOrEqual(600);
    sc.dispose();
  });

  it('an occupied active site wears a thin ring in its ligand’s role colour; free sites none', () => {
    const tokens: Record<string, string> = {
      [ROLES.substrate.token]: '#00ff00',
      [ROLES.inhibitor.token]: '#ff0000',
      '--text-muted': '#777777',
    };
    for (const kind of KINDS) {
      const m = enzymeModel3d(inputs({ kind }));
      const sc = buildEnzymeScene({
        tier: 'medium',
        segments: 16,
        kind,
        token: (n) => tokens[n] ?? '#808080',
      });
      const f = frameAt(m, 4);
      sc.setFrame(f);
      const thin = (o: THREE.Object3D): o is THREE.InstancedMesh =>
        o instanceof THREE.InstancedMesh &&
        o.geometry instanceof THREE.TorusGeometry &&
        o.geometry.parameters.tube < 0.1;
      let lips: THREE.InstancedMesh | null = null;
      sc.scene.traverse((o) => {
        if (thin(o)) lips = o;
      });
      const mesh = lips as unknown as THREE.InstancedMesh;
      const occupied = f.counts.ES + f.counts.ESI + (kind === 'competitive' ? f.counts.EI : 0);
      expect(mesh.visible ? mesh.count : 0, kind).toBe(occupied);
      const c = new THREE.Color();
      const colours = new Set<string>();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getColorAt(i, c);
        colours.add(`#${c.getHexString()}`);
      }
      const want = new Set<string>();
      if (f.counts.ES + f.counts.ESI > 0) want.add('#00ff00');
      if (kind === 'competitive' && f.counts.EI > 0) want.add('#ff0000');
      expect(colours, kind).toEqual(want);
      sc.dispose();
    }
  });

  it('three seeded enzyme shapes, every pocket at the same place (bound particles keep seats)', () => {
    const shapes = ENZYME_SEEDS.map((seed) => enzymeGeometry(16, false, seed));
    const top = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position');
      let best = -Infinity;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        if (Math.hypot(x, z) < 1e-6) best = Math.max(best, p.getY(i));
      }
      return best;
    };
    const signature = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position');
      let sum = 0;
      for (let i = 0; i < p.count; i++) sum += Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
      return sum.toFixed(4);
    };
    expect(new Set(shapes.map(signature)).size).toBe(3);
    for (const g of shapes) expect(top(g)).toBeCloseTo(enzymeRadiusAt(0, 1, 0, false), 6);
    for (const g of shapes) g.dispose();
    const m = enzymeModel3d(inputs({ kind: 'none' }));
    const sc = build(m);
    sc.setFrame(frameAt(m, 0));
    let drawn = 0;
    let sets = 0;
    sc.scene.traverse((o) => {
      const g = o instanceof THREE.InstancedMesh ? (o.geometry as THREE.BufferGeometry) : null;
      if (o instanceof THREE.InstancedMesh && g?.getAttribute('color') && o.visible) {
        drawn += o.count;
        sets++;
      }
    });
    expect(sets).toBe(3);
    expect(drawn).toBe(ENZYMES_DRAWN);
    sc.dispose();
  });

  it('a new product leaves a substrate-holding pocket while playing; never when scrubbed', () => {
    const m = enzymeModel3d(inputs({ kind: 'none', view: 'time' }));
    const sc = build(m);
    const f1 = frameAt(m, m.tEnd / 4);
    const f2 = frameAt(m, m.tEnd / 3);
    expect(f2.particles.P).toBeGreaterThan(f1.particles.P);
    const productAt = (j: number) => {
      let mesh: THREE.InstancedMesh | null = null;
      sc.scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh && o.count === f2.particles.P && o.visible) mesh = o;
      });
      const mat = new THREE.Matrix4();
      (mesh as unknown as THREE.InstancedMesh).getMatrixAt(j, mat);
      return new THREE.Vector3().setFromMatrixPosition(mat);
    };
    const place = (k: number) => new THREE.Vector3(...(SP_PLACES[k] ?? [0, 0, 0]));
    // Scrubbed: every product at its own place.
    sc.setFrame(f1);
    sc.setFrame(f2);
    expect(productAt(0).distanceTo(place(f2.particles.S))).toBeLessThan(1e-6);
    // Playing: the newest product starts in a pocket, away from its place, and gets there.
    sc.setFrame(f1);
    sc.setFrame(f2, true);
    const start = productAt(0);
    expect(start.distanceTo(place(f2.particles.S))).toBeGreaterThan(0.5);
    const nearest = Math.min(
      ...ENZYME_PLACES.map((e) => start.distanceTo(new THREE.Vector3(...e.center))),
    );
    expect(nearest).toBeLessThan(1.2);
    sc.setPhase(PRODUCT_EASE_S + 0.01);
    expect(productAt(0).distanceTo(place(f2.particles.S))).toBeLessThan(0.3);
    // The oldest products never moved.
    const last = f2.particles.P - 1;
    expect(productAt(last).distanceTo(place(f2.particles.S + last))).toBeLessThan(0.3);
    sc.dispose();
  });
});
