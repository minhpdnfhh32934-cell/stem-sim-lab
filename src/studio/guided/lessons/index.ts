import { validateScenario, type StudioScenario, type StudioSubject } from '../../scenario';
import { hh11b11Separation } from './hh11b11Separation';
import { sh10b03Levels } from './sh10b03Levels';
import { sh10b12Signalling } from './sh10b12Signalling';
import { sh10b13Metabolism } from './sh10b13Metabolism';
import { sh10b14BreakdownSynthesis } from './sh10b14BreakdownSynthesis';
import { sh10b19CellTechnology } from './sh10b19CellTechnology';
import { sh10b20MicrobeDiversity } from './sh10b20MicrobeDiversity';
import { sh10b22MicrobeUses } from './sh10b22MicrobeUses';
import { sh10b25VirusDiseases } from './sh10b25VirusDiseases';
import { sh11b01Metabolism } from './sh11b01Metabolism';
import { sh11b02WaterMinerals } from './sh11b02WaterMinerals';
import { sh11b04Photosynthesis } from './sh11b04Photosynthesis';
import { sh11b06Respiration } from './sh11b06Respiration';
import { sh11b08Digestion } from './sh11b08Digestion';
import { sh11b09AnimalRespiration } from './sh11b09AnimalRespiration';
import { sh11b10Circulation } from './sh11b10Circulation';
import { sh11b12Immunity } from './sh11b12Immunity';
import { sh11b13Excretion } from './sh11b13Excretion';
import { sh11b14Response } from './sh11b14Response';
import { sh11b15PlantResponse } from './sh11b15PlantResponse';
import { sh11b17AnimalResponse } from './sh11b17AnimalResponse';
import { sh11b18Behaviour } from './sh11b18Behaviour';
import { sh11b19Growth } from './sh11b19Growth';
import { sh11b20PlantGrowth } from './sh11b20PlantGrowth';
import { sh11b22AnimalGrowth } from './sh11b22AnimalGrowth';
import { sh11b24Reproduction } from './sh11b24Reproduction';
import { sh11b25PlantReproduction } from './sh11b25PlantReproduction';
import { sh11b27AnimalReproduction } from './sh11b27AnimalReproduction';
import { sh11b28Integration } from './sh11b28Integration';
import { vl12b01Matter } from './vl12b01Matter';
import { vl12b08Gas } from './vl12b08Gas';
import { vl12b14Field } from './vl12b14Field';
import { vl12b18Applications } from './vl12b18Applications';
import { vl12b19EmField } from './vl12b19EmField';
import { vl12b24Industry } from './vl12b24Industry';
import { hh12b02Soap } from './hh12b02Soap';
import { hh12b04Glucose } from './hh12b04Glucose';
import { hh12b05Disaccharides } from './hh12b05Disaccharides';
import { hh12b06Polysaccharides } from './hh12b06Polysaccharides';
import { hh12b10Protein } from './hh12b10Protein';
import { hh12b12Polymer } from './hh12b12Polymer';
import { hh12b13Materials } from './hh12b13Materials';
import { hh12b16Electrolysis } from './hh12b16Electrolysis';
import { hh12b20Extraction } from './hh12b20Extraction';
import { hh12b21Alloys } from './hh12b21Alloys';
import { hh12b22Corrosion } from './hh12b22Corrosion';
import { sh12b01Dna } from './sh12b01Dna';
import { sh12b05GeneTech } from './sh12b05GeneTech';
import { sh12b13HumanGenetics } from './sh12b13HumanGenetics';
import { sh12b15Extranuclear } from './sh12b15Extranuclear';
import { sh12b16GenotypeEnvironment } from './sh12b16GenotypeEnvironment';
import { sh12b20Darwin } from './sh12b20Darwin';
import { sh12b21ModernSynthesis } from './sh12b21ModernSynthesis';
import { sh12b26Community } from './sh12b26Community';
import { sh12b28Ecosystem } from './sh12b28Ecosystem';
import { sh12b30Succession } from './sh12b30Succession';
import { sh12b31Biosphere } from './sh12b31Biosphere';
import { sh12b33Conservation } from './sh12b33Conservation';
import { sh12b34Sustainability } from './sh12b34Sustainability';

/**
 * The descriptive textbook lessons (user decision 14/11/2026, #255). Kept out of
 * `builtInScenarios()` on purpose: they open from their own library topic and from their own group
 * in Science Studio. Each one is validated; an invalid lesson is left out, never shown half-built.
 */
export const GUIDED_LESSONS: readonly unknown[] = [
  sh10b03Levels,
  sh10b12Signalling,
  sh10b13Metabolism,
  sh10b14BreakdownSynthesis,
  sh10b19CellTechnology,
  sh10b20MicrobeDiversity,
  sh10b22MicrobeUses,
  sh10b25VirusDiseases,
  hh11b11Separation,
  sh11b01Metabolism,
  sh11b02WaterMinerals,
  sh11b04Photosynthesis,
  sh11b06Respiration,
  sh11b08Digestion,
  sh11b09AnimalRespiration,
  sh11b10Circulation,
  sh11b12Immunity,
  sh11b13Excretion,
  sh11b14Response,
  sh11b15PlantResponse,
  sh11b17AnimalResponse,
  sh11b18Behaviour,
  sh11b19Growth,
  sh11b20PlantGrowth,
  sh11b22AnimalGrowth,
  sh11b24Reproduction,
  sh11b25PlantReproduction,
  sh11b27AnimalReproduction,
  sh11b28Integration,
  vl12b01Matter,
  vl12b08Gas,
  vl12b14Field,
  vl12b18Applications,
  vl12b19EmField,
  vl12b24Industry,
  hh12b02Soap,
  hh12b04Glucose,
  hh12b05Disaccharides,
  hh12b06Polysaccharides,
  hh12b10Protein,
  hh12b12Polymer,
  hh12b13Materials,
  hh12b16Electrolysis,
  hh12b20Extraction,
  hh12b21Alloys,
  hh12b22Corrosion,
  sh12b01Dna,
  sh12b05GeneTech,
  sh12b13HumanGenetics,
  sh12b15Extranuclear,
  sh12b16GenotypeEnvironment,
  sh12b20Darwin,
  sh12b21ModernSynthesis,
  sh12b26Community,
  sh12b28Ecosystem,
  sh12b30Succession,
  sh12b31Biosphere,
  sh12b33Conservation,
  sh12b34Sustainability,
];

let cache: StudioScenario[] | null = null;

export function guidedScenarios(): StudioScenario[] {
  if (!cache) {
    cache = [];
    for (const raw of GUIDED_LESSONS) {
      const r = validateScenario(raw);
      if (r.ok && r.scenario.binding.kind === 'guided') cache.push(r.scenario);
      else console.error('Invalid guided lesson', r.ok ? 'not a guided binding' : r.errors);
    }
  }
  return cache;
}

export function guidedFor(subject: StudioSubject): StudioScenario[] {
  return guidedScenarios().filter((s) => s.subject === subject);
}

export function guidedForTopic(topic: string): StudioScenario | null {
  return guidedScenarios().find((s) => s.topic === topic) ?? null;
}
