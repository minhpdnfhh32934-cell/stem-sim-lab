import type { SimulationModel } from '../SimulationModel';
import { buoyancyModel } from './buoyancy';
import { cellEmfModel } from './cellEmf';
import { rcCircuitModel } from './rcCircuit';
import { resonanceTubeModel } from './resonanceTube';
import { standingWaveModel } from './standingWave';
import { doubleSlitModel } from './doubleSlit';
import { rippleTankModel } from './rippleTank';
import { pointChargesModel } from './pointCharges';
import { soundFrequencyModel } from './soundFrequency';
import { resonanceModel } from './resonance';
import { latentHeatModel, specificHeatModel } from './calorimetry';
import { boyleModel, charlesModel } from './gasLaws';
import { currentBalanceModel, inductionModel } from './magnetism';
import { decayCounterModel } from './decayCounter';
import { liquidPressureModel } from './liquidPressure';
import { leverModel } from './lever';
import { concurrentForcesModel } from './concurrentForces';
import { circuitModel } from './circuit';
import { circularModel } from './circular';
import { collisionModel } from './collision';
import { dilutionModel } from './dilution';
import { energyTrackModel } from './energy';
import { enzymeModel } from './enzyme';
import { freeFallModel } from './freeFall';
import { heatingModel } from './heating';
import { inclineModel } from './incline';
import { kineticsModel } from './kinetics';
import { thinLensModel } from './lens';
import { microscopeModel } from './microscope';
import { osmosisModel } from './osmosis';
import { pendulumModel } from './pendulum';
import { photogateSpeedModel } from './photogateSpeed';
import { airTrackCartModel } from './airTrackCart';
import { atwoodModel } from './atwood';
import { photosynthesisModel } from './photosynthesis';
import { powerModel } from './power';
import { projectileModel } from './projectile';
import { reflectionModel } from './reflection';
import { refractionModel } from './refraction';
import { solubilityModel } from './solubility';
import { springModel } from './spring';
import { titrationModel } from './titration';
import { transpirationModel } from './transpiration';
import { seedRespirationModel } from './seedRespiration';
import { geneticsModel } from './genetics';
import { markRecaptureModel } from './markRecapture';
import { foodTestsModel } from './foodTests';
import { phModel } from './ph';
import { precipitationModel } from './precipitation';
import { separationModel } from './separation';

/** Every model experiments can reference by id. Add new models here. */
import { neutralisationModel } from './neutralisation';
import { no2EquilibriumModel } from './no2Equilibrium';
import { galvanicCellModel } from './galvanicCell';
import { electrolysisModel } from './electrolysis';
import { halogensModel } from './halogens';
import { corrosionModel } from './corrosion';
import { saponificationModel } from './saponification';
import { gasSpeedsModel } from './gasSpeeds';
import { collisionTheoryModel } from './collisionTheory';
import { atomicStructureModel } from './atomicStructure';
import { orbitalsModel } from './orbitals';
import { moleculeShapesModel } from './moleculeShapes';
import { balancingModel } from './balancing';
import { cellDivisionModel } from './cellDivision';
import { proteinSynthesisModel } from './proteinSynthesis';
import { populationGeneticsModel } from './populationGenetics';
import { logisticGrowthModel, predatorPreyModel } from './populationDynamics';
import { agarDiffusionModel } from './agarDiffusion';
import { plasmolysisModel } from './plasmolysis';
import { fermentationModel } from './fermentation';
import { heartRateModel } from './heartRate';
import { tropismModel } from './tropism';
import { dnaExtractionModel } from './dnaExtraction';
import { karyotypeModel } from './karyotype';
import { acGeneratorModel } from './acGenerator';
export const BUILT_IN_MODELS: readonly SimulationModel[] = [
  acGeneratorModel,
  karyotypeModel,
  dnaExtractionModel,
  tropismModel,
  heartRateModel,
  fermentationModel,
  plasmolysisModel,
  agarDiffusionModel,
  predatorPreyModel,
  logisticGrowthModel,
  populationGeneticsModel,
  proteinSynthesisModel,
  cellDivisionModel,
  balancingModel,
  moleculeShapesModel,
  orbitalsModel,
  atomicStructureModel,
  collisionTheoryModel,
  gasSpeedsModel,
  saponificationModel,
  corrosionModel,
  halogensModel,
  electrolysisModel,
  galvanicCellModel,
  no2EquilibriumModel,
  neutralisationModel,
  phModel,
  precipitationModel,
  separationModel,
  freeFallModel,
  projectileModel,
  pendulumModel,
  springModel,
  circuitModel,
  refractionModel,
  inclineModel,
  titrationModel,
  kineticsModel,
  heatingModel,
  osmosisModel,
  enzymeModel,
  photosynthesisModel,
  microscopeModel,
  energyTrackModel,
  collisionModel,
  circularModel,
  buoyancyModel,
  powerModel,
  reflectionModel,
  thinLensModel,
  photogateSpeedModel,
  airTrackCartModel,
  atwoodModel,
  transpirationModel,
  solubilityModel,
  cellEmfModel,
  rcCircuitModel,
  resonanceTubeModel,
  standingWaveModel,
  doubleSlitModel,
  rippleTankModel,
  pointChargesModel,
  soundFrequencyModel,
  resonanceModel,
  specificHeatModel,
  latentHeatModel,
  boyleModel,
  charlesModel,
  currentBalanceModel,
  inductionModel,
  decayCounterModel,
  liquidPressureModel,
  leverModel,
  concurrentForcesModel,
  dilutionModel,
  seedRespirationModel,
  geneticsModel,
  markRecaptureModel,
  foodTestsModel,
];
