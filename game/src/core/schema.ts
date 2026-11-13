import { z } from 'zod';
import type { Vec3 } from './math';

/** Stable content id: lowercase words joined by '-' or '.', e.g. `free-fall`, `lab.bench-01`. */
export const IdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/, 'must be lowercase words joined by "-" or "."');

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]) as z.ZodType<Vec3>;

export const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'must be a #rrggbb colour');

/** Turns a Zod error into "path: message" lines that point at the offending data. */
export function formatIssues(error: z.ZodError, prefix = ''): string[] {
  return error.issues.map((issue) => {
    const path = [prefix, ...issue.path.map(String)].filter(Boolean).join('.');
    return `${path || '(root)'}: ${issue.message}`;
  });
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });
