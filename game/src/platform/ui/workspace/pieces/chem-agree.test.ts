import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemDefinitionSchema } from '../../../../gameplay/item';
import { linearCss } from '../../../labVisuals/chemistry';
import { solubilityStation } from '../../../render/bench/solubility-station';
import { titrationStand } from '../../../render/bench/titration-stand';
import { solubilityModel } from '../../../../simulation/models/solubility';
import { byClass, installDom } from '../testing/chemDom';
import { definitionOf, mountPiece, piece, stationView } from '../testing/chemFixtures';
import { CHEM_PIECES } from './chem-pieces';

// The 2D workspace and the 3D bench draw one sample the same: the flask's colour and level in the
// workspace's SVG are the ones the 3D titration stand's mesh gets from the same pose.

const item = ItemDefinitionSchema.parse({
  id: 'titration-stand',
  displayName: 'Titration stand',
  category: 'equipment',
  physical: { massKg: 4 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'titration-stand', top: [-0.16, 0.018, -0.02] },
  visual: { shape: 'box', size: [0.56, 0.76, 0.34], color: '#34465c', material: 'painted' },
});

/** The 3D rig needs a canvas for its burette atlas: a context that draws nothing. */
function stubCanvas() {
  const context = new Proxy<Record<string, unknown>>(
    {},
    {
      get: (t, k) => t[k as string] ?? (() => undefined),
      set: (t, k, v) => ((t[k as string] = v), true),
    },
  );
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
}

const PARAMETERS = { acidVolume: 25, endpointPH: 8.2, flowRate: 0.25, baseConcentration: 0.1 };
const SAMPLES = [
  { volume: 21.3, pH: 8.2 },
  { volume: 3.1, pH: 1.4 },
  { volume: 0, pH: 1.07 },
];

afterEach(() => vi.unstubAllGlobals());

describe('the titration flask in 2D and 3D', () => {
  for (const sample of SAMPLES) {
    it(`agrees at ${sample.volume} mL, pH ${sample.pH}`, () => {
      // 3D: pose the real rig, read what its mesh got.
      stubCanvas();
      const rig = titrationStand.rig!(item);
      const root = new THREE.Group();
      root.add(rig.group);
      rig.pose(
        {
          status: 'running',
          parameters: PARAMETERS,
          sample: { ...sample, inferredAcidConcentration: NaN },
        },
        1 / 60,
      );
      const solution = root.getObjectByName('solution') as THREE.Mesh;
      const colour = (solution.material as THREE.MeshBasicMaterial).color;
      const surface = solution.geometry.getAttribute('position');
      let level3d = -Infinity;
      for (let i = 0; i < surface.count; i++) level3d = Math.max(level3d, surface.getY(i));
      rig.dispose();
      vi.unstubAllGlobals();

      // 2D: the same pose in the workspace flask.
      installDom();
      const m = mountPiece(
        CHEM_PIECES['conical-flask']!,
        piece('conical-flask', [{ variable: 'pH' }, { variable: 'volume' }]),
      );
      m.view.update(
        stationView(definitionOf('acid-base-titration'), {
          status: 'running',
          parameters: PARAMETERS,
          sample,
        }),
      );
      const liquid = byClass(m.root, 'chem-liquid')[0]!;
      expect(Number(liquid.getAttribute('height')) / 1000).toBeCloseTo(level3d, 6);
      expect(liquid.getAttribute('fill')).toBe(linearCss([colour.r, colour.g, colour.b]));
    });
  }
});

describe('the solubility beaker in 2D and 3D', () => {
  const bench = ItemDefinitionSchema.parse({
    id: 'solubility-station',
    displayName: 'Solubility station',
    category: 'equipment',
    physical: { massKg: 6 },
    interactions: ['bench', 'inspect'],
    bench: { model: 'solubility-station', top: [-0.2, 0.08, 0] },
    visual: { shape: 'box', size: [0.8, 0.46, 0.35], color: '#e3e7ea', material: 'painted' },
  });
  const settings = { waterMass: 50, solute: 0, soluteMass: 40, temperature: 20 };
  const sampleAt = (parameters: Record<string, number>, seconds: number) => {
    const state = new Float64Array(solubilityModel.variables.length);
    solubilityModel.init({ stirTime: 900, timeConstant: 60, timeLapse: 30, ...parameters }, state);
    for (let i = Math.round(seconds / 0.02); i > 0; i--)
      solubilityModel.step(state, 0.02, parameters);
    return Object.fromEntries(solubilityModel.variables.map((n, i) => [n, state[i] ?? Number.NaN]));
  };
  // The fullest bed is KCl at 120 g: every grain, so its heap is the 2D heap's full height.
  const fullest = { ...settings, solute: 2, soluteMass: 120, temperature: 80 };

  /** 3D: the grains and the water's height over the floor; 2D: the liquid's and the heap's heights. */
  function both(parameters: Record<string, number>, sample: Record<string, number>) {
    const rig = solubilityStation.rig!(bench);
    const root = new THREE.Group();
    root.add(rig.group);
    rig.pose({ status: 'running', parameters, sample }, 1 / 60);
    const bed = root.getObjectByName('bed') as THREE.InstancedMesh;
    const water = root.getObjectByName('water') as THREE.Mesh;
    const grains = bed.count;
    const level3d = water.scale.y;
    rig.dispose();
    installDom();
    const m = mountPiece(
      CHEM_PIECES.beaker!,
      piece('beaker', [{ variable: 'undissolved' }, { variable: 'dissolved' }]),
    );
    m.view.update(
      stationView(definitionOf('acid-base-titration'), { status: 'running', parameters, sample }),
    );
    const height = (name: string) =>
      Number(byClass(m.root, name)[0]!.getAttribute('height')) / 1000;
    return { grains, level3d, level2d: height('chem-liquid'), heap: height('chem-solid') };
  }

  it('draws the same water level and the same share of the fullest bed', () => {
    const top = both(fullest, sampleAt(fullest, 0.1));
    expect(top.grains).toBe(80);
    for (const [seconds, parameters] of [
      [5, settings],
      [29, settings],
    ] as const) {
      const sample = sampleAt(parameters, seconds);
      const got = both(parameters, sample);
      expect(got.grains).toBeGreaterThan(0);
      expect(got.level2d).toBeCloseTo(got.level3d, 6);
      expect(got.heap / top.heap).toBeCloseTo(got.grains / top.grains, 6);
    }
  });
});
