import { z } from 'zod';
import { compareVersions, isVersion } from './version';

/**
 * Schema of release-notes/versions.json — the single source of SimLab's version history
 * (release-notes/README.md). The app reads the bundled copy (offline) for "Có gì mới" and the
 * "Lịch sử phiên bản" page; scripts/release-notes/build.mjs makes the docs from the same file.
 */

export const RELEASE_STATUSES = [
  'released',
  'merged-not-released',
  'in-review',
  'development',
  'unverified',
] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** Where a version was (or is meant to be) distributed. */
export const RELEASE_CHANNELS = ['none', 'zip', 'github', 'github-web', 'store'] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

/** Areas of a learner highlight (the icon in "Có gì mới"). */
export const HIGHLIGHT_AREAS = [
  'teacher',
  'voice',
  'gemma',
  'bio3d',
  'performance',
  'ui',
  'security',
] as const;
export type HighlightArea = (typeof HIGHLIGHT_AREAS)[number];

/** A note may also be tagged `api` (Gemini/Claude/Groq), used to group the history document. */
export const NOTE_AREAS = [...HIGHLIGHT_AREAS, 'api'] as const;
export type NoteArea = (typeof NOTE_AREAS)[number];

/** Note lists of a version, in the order of Keep a Changelog sections. */
export const NOTE_CATEGORIES = [
  'added',
  'improved',
  'fixed',
  'security',
  'performance',
  'changed',
  'deprecated',
  'knownIssues',
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

/** ISO 8601: a date (`2026-10-09`) or a time with its zone (`…T03:07:21Z`, `…T22:09:05+07:00`). */
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2}))?$/;
const isoDate = z
  .string()
  .regex(ISO)
  .refine((v) => !Number.isNaN(Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v)));

const nonEmpty = z.string().trim().min(1);
const localized = z.strictObject({ vi: nonEmpty, en: nonEmpty });
const note = z.strictObject({ vi: nonEmpty, en: nonEmpty, area: z.enum(NOTE_AREAS).optional() });
const highlight = z.strictObject({ area: z.enum(HIGHLIGHT_AREAS), vi: nonEmpty, en: nonEmpty });
const version = z.string().refine(isVersion, 'not a x.y.z version');

const entry = z.strictObject({
  version,
  status: z.enum(RELEASE_STATUSES),
  /** Why the status is what it is (internal, Vietnamese); required unless released. */
  statusNote: nonEmpty.nullable(),
  channel: z.enum(RELEASE_CHANNELS),
  /** null = no evidence found ("Chưa xác minh được"); never guessed. */
  dates: z.strictObject({
    devStart: isoDate.nullable(),
    firstCommit: isoDate.nullable(),
    lastCommit: isoDate.nullable(),
    merged: isoDate.nullable(),
    built: isoDate.nullable(),
    released: isoDate.nullable(),
    tagged: isoDate.nullable(),
  }),
  /** Where each fact comes from (internal, Vietnamese, short). */
  evidence: z.array(nonEmpty).min(1),
  /** Test results recorded for this version, with their source (internal, Vietnamese). */
  tests: z.array(nonEmpty),
  refs: z.strictObject({
    tag: nonEmpty.nullable(),
    tagSha: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .nullable(),
    releaseUrl: z
      .string()
      .regex(/^https:\/\/github\.com\/[^\s]+\/releases\/tag\/v\d+\.\d+\.\d+$/)
      .nullable(),
    prs: z.array(z.number().int().positive()),
    commits: z.array(z.string().regex(/^[0-9a-f]{7,40}$/)),
    branches: z.array(nonEmpty),
  }),
  publicNotes: z.strictObject({
    summary: localized,
    added: z.array(note),
    improved: z.array(note),
    fixed: z.array(note),
    security: z.array(note),
    performance: z.array(note),
    changed: z.array(note),
    deprecated: z.array(note),
    knownIssues: z.array(note),
  }),
  /** The notes were reviewed for publication: only then does "Có gì mới" show them. */
  notesReady: z.boolean(),
  learnerHighlights: z.array(highlight).max(5),
});

export const releaseNotesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  product: nonEmpty,
  repository: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/),
  /** Day the evidence was last checked. */
  evidenceCheckedAt: isoDate,
  overview: z.array(nonEmpty),
  milestones: z.array(z.strictObject({ date: isoDate, text: nonEmpty, evidence: nonEmpty })),
  /** Points that could not be verified, for the "chưa hoàn thành" section (Vietnamese). */
  openQuestions: z.array(nonEmpty),
  versions: z.array(entry).min(1),
});

export type ReleaseNotes = z.infer<typeof releaseNotesSchema>;
export type ReleaseEntry = ReleaseNotes['versions'][number];
export type ReleaseNote = ReleaseEntry['publicNotes']['added'][number];
export type LearnerHighlight = ReleaseEntry['learnerHighlights'][number];

/**
 * Validates data read from versions.json. Anything broken gives null (the app then shows no
 * "Có gì mới" box instead of crashing); versions come back newest first, one entry each.
 */
export function parseReleaseNotes(data: unknown): ReleaseNotes | null {
  const result = releaseNotesSchema.safeParse(data);
  if (!result.success) return null;
  const seen = new Set<string>();
  const versions = [...result.data.versions]
    .sort((a, b) => compareVersions(b.version, a.version))
    .filter((v) => (seen.has(v.version) ? false : (seen.add(v.version), true)));
  return { ...result.data, versions };
}
