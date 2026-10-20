import type { CellType } from '@/biology/division/mitosis3d/timeline';
import type { Reaction } from '@/chemistry/data/reactions';
import type { PhysicsScene } from '@/physics/types';
import { biologyParts, type PhysicsPreset } from './choices';
import type { AuthorDraft } from './draft';

/**
 * Binding edits of the form. Each one only picks among engine-derived choices
 * (`choices.ts`); `check.ts` still verifies the result before it is saved.
 */

export function withPreset(d: AuthorDraft, p: PhysicsPreset): AuthorDraft {
  const t = p.template;
  return {
    ...d,
    base: { ...d.base, topic: t.topic, models: t.models, tools: t.tools, steps: t.steps },
    binding: structuredClone(p.binding),
    initial: { ...t.initial },
  };
}

/** Lets the learner change a parameter (it then needs a start value: the scene default). */
export function withControl(
  d: AuthorDraft,
  scene: PhysicsScene,
  key: string,
  on: boolean,
): AuthorDraft {
  const b = d.binding;
  if (b.kind !== 'physics') return d;
  const controls = on
    ? [...b.controls.filter((c) => c !== key), key]
    : b.controls.filter((c) => c !== key);
  const initial = { ...d.initial };
  if (on && initial[key] === undefined) {
    const v = scene.defaults[key];
    if (v !== undefined) initial[key] = v;
  }
  return { ...d, binding: { ...b, controls }, initial };
}

/** Start value in SI; null returns a non-control parameter to the scene default. */
export function withInitial(d: AuthorDraft, key: string, valueSI: number | null): AuthorDraft {
  const b = d.binding;
  if (b.kind !== 'physics') return d;
  if (valueSI === null && !b.controls.includes(key)) {
    return {
      ...d,
      initial: Object.fromEntries(Object.entries(d.initial).filter(([k]) => k !== key)),
    };
  }
  return { ...d, initial: { ...d.initial, [key]: valueSI ?? Number.NaN } };
}

export function withReagent(d: AuthorDraft, formula: string, on: boolean): AuthorDraft {
  const b = d.binding;
  if (b.kind !== 'chemistry') return d;
  // The two target solutions stay on the rack: the lesson is about them.
  if (!on && b.target.includes(formula)) return d;
  const inventory = on
    ? [...b.inventory.filter((f) => f !== formula), formula]
    : b.inventory.filter((f) => f !== formula);
  return { ...d, binding: { ...b, inventory } };
}

/** The target mix is a library record; its starting substances join the rack. */
export function withTarget(d: AuthorDraft, r: Reaction): AuthorDraft {
  const b = d.binding;
  const [first, second] = r.reactants;
  if (b.kind !== 'chemistry' || !first || !second) return d;
  const inventory = [...b.inventory];
  for (const f of [first.formula, second.formula]) if (!inventory.includes(f)) inventory.push(f);
  return {
    ...d,
    binding: { ...b, reaction: r.id, target: [first.formula, second.formula], inventory },
  };
}

/** Which target solution the procedure adds first. */
export function withSwappedTarget(d: AuthorDraft): AuthorDraft {
  const b = d.binding;
  if (b.kind !== 'chemistry') return d;
  return { ...d, binding: { ...b, target: [b.target[1], b.target[0]] } };
}

export function withCellType(d: AuthorDraft, cellType: CellType): AuthorDraft {
  const b = d.binding;
  if (b.kind !== 'biology') return d;
  const known = biologyParts(cellType);
  return {
    ...d,
    binding: { ...b, cellType, parts: b.parts.filter((p) => (known as string[]).includes(p)) },
  };
}

export function withPairs(d: AuthorDraft, pairs: number): AuthorDraft {
  const b = d.binding;
  if (b.kind !== 'biology') return d;
  return { ...d, binding: { ...b, pairs } };
}

export function withPart(d: AuthorDraft, part: string, on: boolean): AuthorDraft {
  const b = d.binding;
  if (b.kind !== 'biology') return d;
  const parts = on
    ? [...b.parts.filter((p) => p !== part), part]
    : b.parts.filter((p) => p !== part);
  return { ...d, binding: { ...b, parts } };
}
