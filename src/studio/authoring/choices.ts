import { componentsFor, type ComponentId } from '@/biology/division/mitosis3d/components';
import type { CellType } from '@/biology/division/mitosis3d/timeline';
import { REACTIONS, type Reaction } from '@/chemistry/data/reactions';
import type { ParamDef, PhysicsScene } from '@/physics/types';
import type { PhysicsBinding, StudioScenario, StudioSubject } from '../scenario';
import { builtInScenarios } from '../scenarios';
import { speciesKey } from '../chemistry/library';

/**
 * What a teacher may pick in the authoring studio. Every choice comes from an engine or a data
 * table, so an authored scenario names only things the studios can run.
 */

/** The built-in scenario a new scenario of `subject` starts from (tools, steps, models). */
export function templateFor(subject: StudioSubject): StudioScenario | undefined {
  return builtInScenarios().find((s) => s.subject === subject);
}

/**
 * Physics: a scene's engine reads (`measures`, graph, tMax) are only trusted as a set that a
 * built-in scenario already runs; a teacher changes controls, start values and text, not the
 * mapping between `solve()` answers and engine output.
 */
export interface PhysicsPreset {
  template: StudioScenario;
  binding: PhysicsBinding;
}

export function physicsPresets(): PhysicsPreset[] {
  const out: PhysicsPreset[] = [];
  for (const s of builtInScenarios()) {
    if (s.binding.kind === 'physics') out.push({ template: s, binding: s.binding });
  }
  return out;
}

/** The part of a physics binding that must equal a preset (everything but the controls). */
export function presetKey(b: PhysicsBinding): string {
  return JSON.stringify([b.scene, b.poe, b.measures, b.graph, b.tMax]);
}

export function presetFor(b: PhysicsBinding): PhysicsPreset | undefined {
  const key = presetKey(b);
  return physicsPresets().find((p) => presetKey(p.binding) === key);
}

/** Scene parameters a teacher may set: numbers only; g always comes from Settings. */
export function editableParams(scene: PhysicsScene): ParamDef[] {
  return scene.params.filter((d) => d.kind === 'number' && !(scene.usesGravity && d.key === 'g'));
}

/**
 * Chemistry: the bench's POE question is "precipitate or not", and only a library record
 * classified as a precipitation confirms an answer. Targets are those records; the rack offers
 * their starting substances (the library's own aqueous mixes), so a wrong pair on the bench
 * shows another record or "not in the verified database".
 */
export function chemistryTargets(library: readonly Reaction[] = REACTIONS): Reaction[] {
  return library.filter((r) => r.category === 'precipitation' && r.reactants.length === 2);
}

export function chemistryReagents(library: readonly Reaction[] = REACTIONS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of chemistryTargets(library)) {
    for (const t of r.reactants) {
      const key = speciesKey(t.formula);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(t.formula);
      }
    }
  }
  return out;
}

/** Biology: the 3D mitosis model draws 2n = 2…8 and knows these parts for each cell type. */
export const BIO_PAIRS = [1, 2, 3, 4] as const;
export const BIO_CELL_TYPES: readonly CellType[] = ['animal', 'plant'];

export function biologyParts(cellType: CellType): ComponentId[] {
  return componentsFor(cellType);
}
