import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LAYER, assignLayers } from '@/ui/three/layers';
import { buildMitosisScene, type ScenePalette } from '../division/mitosis3d/scene';
import { buildTimeline } from '../division/mitosis3d/timeline';
import { buildEnzymeScene } from '../enzyme/enzyme3d/scene';

const PALETTE: ScenePalette = {
  maternal: '#d55e00',
  paternal: '#0072b2',
  centromere: '#172033',
  membrane: '#16804a',
  envelope: '#56b4e9',
  nucleolus: '#5b4a86',
  wall: '#e69f00',
  spindle: '#8d99ab',
  centrosome: '#cc79a7',
  plate: '#e69f00',
  ring: '#f0e442',
  highlight: '#ffd23f',
};

/** Meshes whose material is see-through but which would still be in the AO pass. */
function leaks(root: THREE.Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => {
    const m = (o as Partial<THREE.Mesh>).material;
    if (!m) return;
    const see = Array.isArray(m) ? m.some((x) => x.transparent) : m.transparent;
    if (see && o.layers.isEnabled(LAYER.OPAQUE)) out.push(o.name || o.type);
  });
  return out;
}

describe('render layers of real lesson scenes (what the host does on setScene)', () => {
  it('mitosis: every see-through part (membrane, envelope, spindle haze) is off the AO layer', () => {
    for (const type of ['animal', 'plant'] as const) {
      const tl = buildTimeline(2, type);
      const ms = buildMitosisScene(tl, PALETTE, { segments: 16 });
      for (const t of [0, 0.3, 0.6, 0.95]) {
        ms.update(tl.stateAt(t * tl.total));
        // Parts that fade in become see-through: the host re-assigns every frame with AO on.
        assignLayers(ms.scene);
        expect(leaks(ms.scene), `${type} @ ${String(t)}`).toEqual([]);
      }
      ms.dispose();
    }
  });

  it('enzyme kinetics: the reaction volume glass is off the AO layer', () => {
    const sc = buildEnzymeScene({
      tier: 'high',
      segments: 24,
      kind: 'competitive',
      token: () => '#808080',
    });
    assignLayers(sc.kit.scene);
    expect(leaks(sc.kit.scene)).toEqual([]);
    sc.dispose();
  });
});
