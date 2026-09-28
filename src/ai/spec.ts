import { z } from 'zod';
import { unitsFor } from '@/core/units';
import type { PhysicsScene } from '@/physics/types';

/**
 * SceneSpec: the ONLY thing the LLM produces for the simulation (MASTER_PROMPT §2.1, §3.2).
 * It is extracted in two small steps, which suits small local models:
 *   1. classify the problem into one supported topic;
 *   2. extract the stated quantities for that topic's parameters.
 * The LLM never computes: every value must be quoted from the problem.
 */

export const UNSUPPORTED = 'unsupported';

export const ClassificationSchema = z.object({
  topic: z.string(),
  reason: z.string(),
  unsupported_parts: z.array(z.string()),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const QuantitySchema = z.object({
  key: z.string(),
  value: z.number(),
  unit: z.string(),
  /** Exact fragment of the problem that states this value. */
  quote: z.string(),
});
export type Quantity = z.infer<typeof QuantitySchema>;

export const ExtractionSchema = z.object({
  quantities: z.array(QuantitySchema),
  questions: z.array(z.string()),
  assumptions: z.array(z.string()),
  unsupported_parts: z.array(z.string()),
  clarifications: z.array(z.string()),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** Full spec as stored/confirmed (after code-side validation and defaults). */
export interface SceneSpec {
  domain: 'physics';
  topic: string;
  params: Record<string, { value: number; unit: string; source: 'problem' | 'default' | 'user' }>;
  questions: string[];
  assumptions: string[];
  unsupported_parts: string[];
}

export function classificationJsonSchema(topics: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['topic', 'reason', 'unsupported_parts'],
    properties: {
      topic: { type: 'string', enum: [...topics, UNSUPPORTED] },
      reason: { type: 'string' },
      unsupported_parts: { type: 'array', items: { type: 'string' } },
    },
  };
}

/** Units the AI may use for one parameter (display units of its dimension). */
export function allowedUnits(scene: PhysicsScene, key: string): string[] {
  const def = scene.params.find((d) => d.key === key);
  if (!def) return [];
  if (def.kind !== 'number') return ['1'];
  if (def.unit === 'deg') return ['deg', 'rad'];
  if (!def.dim) return ['1'];
  return unitsFor(def.dim);
}

export function extractionJsonSchema(scene: PhysicsScene, questionIds: string[]) {
  const keys = scene.params.map((d) => d.key);
  const units = [...new Set(keys.flatMap((k) => allowedUnits(scene, k)))];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['quantities', 'questions', 'assumptions', 'unsupported_parts', 'clarifications'],
    properties: {
      quantities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'value', 'unit', 'quote'],
          properties: {
            key: { type: 'string', enum: keys },
            value: { type: 'number' },
            unit: { type: 'string', enum: units },
            quote: { type: 'string' },
          },
        },
      },
      questions: { type: 'array', items: { type: 'string', enum: questionIds } },
      assumptions: { type: 'array', items: { type: 'string' } },
      unsupported_parts: { type: 'array', items: { type: 'string' } },
      clarifications: { type: 'array', items: { type: 'string' } },
    },
  };
}

/** Parses LLM output text as JSON and validates it; returns a readable error otherwise. */
export function parseJson<T>(
  schema: z.ZodType<T>,
  text: string,
): { ok: true; value: T } | { ok: false; error: string } {
  let raw: unknown;
  try {
    // Some models wrap JSON in ```json fences despite instructions.
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '');
    raw = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = schema.safeParse(raw);
  return r.success ? { ok: true, value: r.data } : { ok: false, error: z.prettifyError(r.error) };
}
