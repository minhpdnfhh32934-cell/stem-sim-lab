import type { LocalizedText } from '@/core/data/dataset';
import { fromSI, unitLabel } from '@/core/units';
import { loadScene } from '@/physics/registry';
import type { PhysicsScene } from '@/physics/types';
import { bindingProblems } from '../biology/model';
import { speciesKey } from '../chemistry/library';
import { targetMatchesLibrary } from '../chemistry/evidence';
import { checkBinding, controlRange, poeById } from '../physics/comparison';
import { validateScenario, type ScenarioBinding, type StudioScenario } from '../scenario';
import { chemistryReagents, chemistryTargets, editableParams, presetFor } from './choices';

/** A problem shown to the teacher; `code` is a key under `studio.authoring.errors`. */
export type IssueCode =
  | 'titleRequired'
  | 'objectiveRequired'
  | 'conclusionRequired'
  | 'questionRequired'
  | 'enLines'
  | 'minChars'
  | 'sourceUrl'
  | 'controlsRequired'
  | 'initialNumber'
  | 'initialRange'
  | 'unknownParam'
  | 'notPreset'
  | 'sceneMissing'
  | 'binding'
  | 'inventorySize'
  | 'reagentNotAllowed'
  | 'targetInInventory'
  | 'targetNotAllowed'
  | 'targetMismatch'
  | 'partsSize'
  | 'bioUnknownPart'
  | 'bioWrongCell'
  | 'bioNoAnswer'
  | 'schema'
  | 'badJson'
  | 'notScenarioFile'
  | 'tooLarge'
  | 'readFailed'
  | 'lessonTooLarge'
  | 'textTooLong'
  | 'listTooLong'
  | 'tooMany'
  | 'storageFull';

export interface AuthorIssue {
  code: IssueCode;
  params?: Record<string, string | number | LocalizedText>;
}

function safeKey(formula: string): string | null {
  try {
    return speciesKey(formula);
  } catch {
    return null;
  }
}

function physicsIssues(s: StudioScenario, scene: PhysicsScene | null): AuthorIssue[] {
  const b = s.binding;
  if (b.kind !== 'physics') return [];
  if (!presetFor(b)) return [{ code: 'notPreset' }];
  if (!scene || scene.id !== b.scene) return [{ code: 'sceneMissing' }];
  const out: AuthorIssue[] = checkBinding(scene, b).map((detail) => ({
    code: 'binding',
    params: { detail },
  }));
  const poe = poeById(b.poe);
  const editable = editableParams(scene);
  for (const key of b.controls) {
    if (!editable.some((d) => d.key === key)) out.push({ code: 'unknownParam', params: { key } });
  }
  for (const [key, value] of Object.entries(s.initial)) {
    const def = editable.find((d) => d.key === key);
    if (!def || !poe) {
      out.push({ code: 'unknownParam', params: { key } });
      continue;
    }
    if (!Number.isFinite(value)) {
      out.push({ code: 'initialNumber', params: { param: def.label } });
      continue;
    }
    const [lo, hi] = controlRange(scene, poe, key);
    // Relative slack only absorbs unit-conversion rounding (e.g. km → m), not real excess.
    const eps = 1e-9 * Math.max(1, Math.abs(lo), Math.abs(hi));
    if (value < lo - eps || value > hi + eps) {
      const unit = def.unit ?? '1';
      out.push({
        code: 'initialRange',
        params: {
          param: def.label,
          min: fromSI(lo, unit),
          max: fromSI(hi, unit),
          unit: def.unit ? unitLabel(def.unit) : '',
        },
      });
    }
  }
  return out;
}

function chemistryIssues(b: Extract<ScenarioBinding, { kind: 'chemistry' }>): AuthorIssue[] {
  const out: AuthorIssue[] = [];
  const allowed = new Set(chemistryReagents().map(safeKey));
  for (const formula of b.inventory) {
    const key = safeKey(formula);
    if (key === null || !allowed.has(key)) {
      out.push({ code: 'reagentNotAllowed', params: { formula } });
    }
  }
  if (!chemistryTargets().some((r) => r.id === b.reaction)) out.push({ code: 'targetNotAllowed' });
  else if (!targetMatchesLibrary(b)) out.push({ code: 'targetMismatch' });
  return out;
}

const BIO_CODES = {
  unknownPart: 'bioUnknownPart',
  wrongCell: 'bioWrongCell',
  noAnswer: 'bioNoAnswer',
} as const;

/**
 * Checks a schema-valid scenario against the engines and data it names. `scene` is the loaded
 * physics scene (ignored for other subjects). Empty = the scenario runs in its studio.
 */
export function checkScenario(s: StudioScenario, scene: PhysicsScene | null): AuthorIssue[] {
  const b = s.binding;
  if (b.kind === 'physics') return physicsIssues(s, scene);
  if (b.kind === 'chemistry') return chemistryIssues(b);
  return bindingProblems(b).map((p) => ({ code: BIO_CODES[p] }));
}

export type Verified =
  { ok: true; scenario: StudioScenario } | { ok: false; issues: AuthorIssue[] };

/** Schema + engine check of untrusted input (an imported file, a stored record). */
export async function verifyScenario(input: unknown): Promise<Verified> {
  const r = validateScenario(input);
  if (!r.ok) {
    return {
      ok: false,
      issues: r.errors.map((detail) => ({ code: 'schema', params: { detail } })),
    };
  }
  let scene: PhysicsScene | null = null;
  if (r.scenario.binding.kind === 'physics') {
    scene = await loadScene(r.scenario.binding.scene).catch(() => null);
  }
  const issues = checkScenario(r.scenario, scene);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, scenario: r.scenario };
}
