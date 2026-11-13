import type * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { airTrack } from './air-track';
import { buoyancyRig } from './buoyancy-rig';
import { circuitBoard } from './circuit-board';
import { colorimeter } from './colorimeter';
import { neutralisationCup } from './neutralisation-cup';
import { no2Syringe } from './no2-syringe';
import { galvanicCell } from './galvanic-cell';
import { electrolysisCell } from './electrolysis-cell';
import { halogenRack } from './halogen-rack';
import { rustingTubes } from './rusting-tubes';
import { soapPot } from './soap-pot';
import { gasBox } from './gas-box';
import { reactionBox } from './reaction-box';
import { bohrAtom } from './bohr-atom';
import { orbitalCloud } from './orbital-cloud';
import { moleculeModel } from './molecule-model';
import { atomBalance } from './atom-balance';
import { dividingCell } from './dividing-cell';
import { geneBoard } from './gene-board';
import { beetleTray } from './beetle-tray';
import { cultureFlask, meadow } from './population-benches';
import { agarCubes } from './agar-cubes';
import { plantCell } from './plant-cell';
import { dnaTube, heartModel, karyogram, seedlingBox, yeastFlask } from './annex-benches';
import { acGenerator } from './ac-generator';
import { demoBoard } from './demoBoard';
import { phMeterStation } from './ph-meter-station';
import { precipitationRack } from './precipitation-rack';
import { separationBench } from './separation-bench';
import { dilutionColorimeter } from './dilution-colorimeter';
import { digitalMicroscope } from './digital-microscope';
import { energyTrack } from './energy-track';
import { cellBoard, rcBoard } from './meter-boards';
import { iceFunnels, joulemeterCalorimeter } from './thermal-benches';
import { boyleSyringe, gasColumn } from './gas-benches';
import { currentBalance, inductionCoil } from './magnet-benches';
import { decayCounterBench } from './decay-counter-bench';
import { resonanceTubeRig } from './resonance-tube-rig';
import { stringVibrator } from './string-vibrator';
import { doubleSlitBench } from './double-slit-bench';
import { rippleTankBench } from './ripple-tank-bench';
import { fieldDisplay } from './field-display';
import { oscilloscopeBench } from './oscilloscope-bench';
import { resonanceRig } from './resonance-rig';
import { leverBalance } from './lever-balance';
import { forceBoard } from './force-board';
import { gasSyringeRig } from './gas-syringe-rig';
import { hotPlate } from './hot-plate';
import { inclineRamp } from './incline-ramp';
import { mirrorBoard } from './mirror-board';
import { opticalBench } from './optical-bench';
import { osmosisRack } from './osmosis-rack';
import { photogateRail } from './photogate-rail';
import { airTrackPulley } from './air-track-pulley';
import { atwoodMachine } from './atwood-machine';
import { pondweedLamp } from './pondweed-lamp';
import { potometer } from './potometer';
import { respirometer } from './respirometer';
import { seedTray } from './seed-tray';
import { beanJar } from './bean-jar';
import { foodTestRack } from './food-test-rack';
import { powerBoard } from './power-board';
import { pressureTank } from './pressure-tank';
import { rayOpticsBoard } from './ray-optics-board';
import { solubilityStation } from './solubility-station';
import { retortStand, titrationStand } from './titration-stand';
import { whirlingApparatus } from './whirling-apparatus';

/*
 * Bench apparatus models by render key (an item's `bench.model`): one file each beside this one,
 * and one line in BENCH_MODELS. WorldRenderer draws a bench's frame as its entity's view (the
 * item's box stays its collider and aim box); ExperimentView adds its rig and poses it every frame
 * from the station. A key without a model draws the item's plain box, and WorldRenderer warns once.
 *
 * Conventions, as hookeModel and towerModel: built on an `Assembly`, in the item's frame (origin
 * at the centre of its box; `bench.top`, from its base centre, is where the rig stands); painted
 * parts share the entity material they are given (focus shows on them) and never free it; own
 * materials take their look from LOOKS; repeated parts are `copies` (one draw); parts smaller than
 * a shadow-map texel cast no shadow; `pose` only assigns — it allocates nothing and skips what has
 * not changed. Every model has a test: it frees all it made, poses in place, and fits its room
 * (`apparatusExtents.test.ts`).
 */

/** The fixed parts of a bench apparatus, built once per entity view. */
export interface BenchFrame {
  /** The entity's mesh takes it: focus and the active glow show on it. */
  readonly body: THREE.BufferGeometry;
  /** The other fixed parts, in the item's frame. */
  readonly parts: THREE.Object3D;
  /** Frees everything it made, never the entity material it was given. */
  dispose(): void;
}

/** What moves: posed from its station every frame, `dt` s after the last pose. */
export interface BenchRig {
  /** In the item's frame: ExperimentView adds it to the entity's view group. */
  readonly group: THREE.Object3D;
  pose(p: BenchPose, dt: number): void;
  dispose(): void;
}

export interface BenchModel {
  frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame;
  /** The parts drawn from the run, for an apparatus that has any. */
  rig?(item: ItemDefinition): BenchRig;
  /** The model variables its rig reads from the pose (checked against each bench's model). */
  readonly reads?: readonly string[];
  /**
   * Its rig's largest pose, for a variable of `reads` whose largest value is not 1 (the default):
   * apparatusExtents.test.ts draws the rig there.
   */
  readonly fullScale?: Readonly<Record<string, number>>;
}

export const BENCH_MODELS: Readonly<Record<string, BenchModel>> = {
  'demo-board': demoBoard,
  'ac-generator': acGenerator,
  karyogram: karyogram,
  'dna-tube': dnaTube,
  'seedling-box': seedlingBox,
  'heart-model': heartModel,
  'yeast-flask': yeastFlask,
  'plant-cell': plantCell,
  'agar-cubes': agarCubes,
  meadow: meadow,
  'culture-flask': cultureFlask,
  'beetle-tray': beetleTray,
  'gene-board': geneBoard,
  'dividing-cell': dividingCell,
  'atom-balance': atomBalance,
  'molecule-model': moleculeModel,
  'orbital-cloud': orbitalCloud,
  'bohr-atom': bohrAtom,
  'reaction-box': reactionBox,
  'gas-box': gasBox,
  'soap-pot': soapPot,
  'rusting-tubes': rustingTubes,
  'halogen-rack': halogenRack,
  'electrolysis-cell': electrolysisCell,
  'galvanic-cell': galvanicCell,
  'no2-syringe': no2Syringe,
  'neutralisation-cup': neutralisationCup,
  'ph-meter-station': phMeterStation,
  'precipitation-rack': precipitationRack,
  'separation-bench': separationBench,
  'circuit-board': circuitBoard,
  'ray-optics-board': rayOpticsBoard,
  'incline-ramp': inclineRamp,
  'titration-stand': titrationStand,
  'retort-stand': retortStand,
  colorimeter,
  'dilution-colorimeter': dilutionColorimeter,
  'hot-plate': hotPlate,
  'osmosis-rack': osmosisRack,
  'gas-syringe-rig': gasSyringeRig,
  'pondweed-lamp': pondweedLamp,
  'digital-microscope': digitalMicroscope,
  'energy-track': energyTrack,
  'air-track': airTrack,
  'whirling-apparatus': whirlingApparatus,
  'buoyancy-rig': buoyancyRig,
  'power-board': powerBoard,
  'mirror-board': mirrorBoard,
  'optical-bench': opticalBench,
  'photogate-rail': photogateRail,
  'air-track-pulley': airTrackPulley,
  'atwood-machine': atwoodMachine,
  potometer,
  'solubility-station': solubilityStation,
  'cell-board': cellBoard,
  'joulemeter-calorimeter': joulemeterCalorimeter,
  'ice-funnels': iceFunnels,
  'boyle-syringe': boyleSyringe,
  'gas-column': gasColumn,
  'current-balance': currentBalance,
  'induction-coil': inductionCoil,
  'decay-counter': decayCounterBench,
  'rc-board': rcBoard,
  'resonance-tube-rig': resonanceTubeRig,
  'string-vibrator': stringVibrator,
  'double-slit-bench': doubleSlitBench,
  'ripple-tank-bench': rippleTankBench,
  'field-display': fieldDisplay,
  'oscilloscope-bench': oscilloscopeBench,
  'resonance-rig': resonanceRig,
  'pressure-tank': pressureTank,
  'lever-balance': leverBalance,
  'force-board': forceBoard,
  respirometer,
  'seed-tray': seedTray,
  'bean-jar': beanJar,
  'food-test-rack': foodTestRack,
};

/** The model registered under `key`, or undefined: never an Object.prototype member. */
export const benchModel = (key: string): BenchModel | undefined =>
  Object.hasOwn(BENCH_MODELS, key) ? BENCH_MODELS[key] : undefined;
