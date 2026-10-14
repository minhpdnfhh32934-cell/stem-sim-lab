// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NOTE_CATEGORIES,
  parseReleaseNotes,
  releaseNotesSchema,
  type ReleaseEntry,
} from '@/app/whatsnew/releaseNotes';
import { compareVersions } from '@/app/whatsnew/version';
import {
  CHANGELOG_SECTIONS,
  DOC_TITLE,
  OUTPUT_FILES,
  SECTIONS,
  STATUS_LABEL,
  isoDay,
  render,
  viDate,
  viDateTime,
} from '../scripts/release-notes/build.mjs';

/**
 * release-notes/versions.json is the one source of the version history (README in that folder):
 * the in-app "Có gì mới" box, docs/VERSION_HISTORY.md, docs/CHANGELOG.md and the Google Docs HTML
 * are all made from it. These checks keep it honest: nothing released without evidence, nothing
 * unreleased described as released, both languages complete, no secrets or personal paths.
 */
const root = resolve(import.meta.dirname, '..');
const text = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
const raw = text('release-notes/versions.json');
const data = JSON.parse(raw) as unknown;
const pkg = JSON.parse(text('package.json')) as { version: string };

function notes() {
  const parsed = parseReleaseNotes(data);
  if (!parsed) throw new Error('release-notes/versions.json does not match the schema');
  return parsed;
}

/** Milliseconds of an ISO value; a bare date counts as midnight in Vietnam (UTC+7). */
const ms = (iso: string) =>
  Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00+07:00` : iso);

describe('release-notes/versions.json', () => {
  it('matches the schema (types, ISO dates, at most 5 highlights, nothing unknown)', () => {
    const result = releaseNotesSchema.safeParse(data);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it('lists every version from 0.1.0 to the current one once, newest first', () => {
    const versions = notes().versions.map((v) => v.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 1; i < versions.length; i++) {
      expect(compareVersions(versions[i - 1]!, versions[i]!)).toBeGreaterThan(0);
    }
    expect(versions[versions.length - 1]).toBe('0.1.0');
    // The bundled data describes the version the app reports (package.json = web part).
    expect(versions[0]).toBe(pkg.version);
  });

  it('every released version has its tag, GitHub Release, release date and evidence', () => {
    const { repository, versions } = notes();
    const released = versions.filter((v) => v.status === 'released');
    expect(released.length).toBeGreaterThan(0);
    for (const v of released) {
      const tag = `v${v.version}`;
      expect(v.refs.tag, v.version).toBe(tag);
      expect(v.refs.releaseUrl, v.version).toBe(`${repository}/releases/tag/${tag}`);
      expect(v.refs.tagSha, v.version).toMatch(/^[0-9a-f]{40}$/);
      expect(v.dates.released, v.version).not.toBeNull();
      expect(
        v.evidence.some((e) => e.includes(tag) && e.includes('published_at')),
        `${v.version}: evidence names the GitHub Release and its published_at`,
      ).toBe(true);
    }
  });

  it('no unreleased version carries a release date, tag or release link', () => {
    for (const v of notes().versions.filter((x) => x.status !== 'released')) {
      expect(v.dates.released, v.version).toBeNull();
      expect(v.refs.tag, v.version).toBeNull();
      expect(v.refs.tagSha, v.version).toBeNull();
      expect(v.refs.releaseUrl, v.version).toBeNull();
      // Why it is not (or not yet) released is written down.
      expect(v.statusNote, v.version).toBeTruthy();
    }
  });

  it('unverified and development versions are never offered to learners as release notes', () => {
    for (const v of notes().versions) {
      if (v.status === 'unverified' || v.status === 'development') {
        expect(v.notesReady, v.version).toBe(false);
      }
    }
  });

  it('dates are in order: first commit ≤ last commit, build ≤ release, start ≤ first commit', () => {
    for (const { version, dates } of notes().versions) {
      const pairs: [string | null, string | null][] = [
        [dates.devStart, dates.firstCommit],
        [dates.firstCommit, dates.lastCommit],
        [dates.built, dates.released],
      ];
      for (const [a, b] of pairs) {
        if (a && b) expect(ms(a), `${version}: ${a} ≤ ${b}`).toBeLessThanOrEqual(ms(b));
      }
    }
  });

  it('every note is written in both languages (equal vi and en lists, nothing empty)', () => {
    const both = (v: ReleaseEntry) => [
      v.publicNotes.summary,
      ...NOTE_CATEGORIES.flatMap((c) => v.publicNotes[c]),
      ...v.learnerHighlights,
    ];
    for (const v of notes().versions) {
      const items = both(v);
      const vi = items.map((i) => i.vi.trim()).filter(Boolean);
      const en = items.map((i) => i.en.trim()).filter(Boolean);
      expect(vi.length, v.version).toBe(items.length);
      expect(en.length, v.version).toBe(vi.length);
      // A translation is not the Vietnamese text copied over.
      for (const i of items) expect(i.en, `${v.version}: ${i.vi}`).not.toBe(i.vi);
    }
  });

  it('security notes stay generic (no attack recipes for issues that may still be open)', () => {
    const risky = /exploit|khai thác|tấn công|attack|bypass|vượt qua|lấy trộm|steal/i;
    for (const v of notes().versions) {
      for (const item of [...v.publicNotes.security, ...v.publicNotes.knownIssues]) {
        expect(`${item.vi} ${item.en}`, v.version).not.toMatch(risky);
      }
    }
  });

  it('contains no secrets, e-mail addresses or personal paths', () => {
    expect(secretsOrPaths(raw)).toEqual([]);
    // The check itself catches what it is meant to catch.
    expect(secretsOrPaths('C:\\Users\\someone\\x D:\\Downloads\\y.zip')).toHaveLength(2);
    expect(secretsOrPaths('key AIza' + 'x'.repeat(35))).toHaveLength(1);
    expect(secretsOrPaths('mail someone@example.com')).toHaveLength(1);
  });

  it('the parser refuses broken data instead of crashing', () => {
    expect(parseReleaseNotes(null)).toBeNull();
    expect(parseReleaseNotes({ versions: 'no' })).toBeNull();
    const copy = JSON.parse(raw) as { versions: { learnerHighlights: unknown[] }[] };
    copy.versions[0]!.learnerHighlights = Array.from({ length: 6 }, () => ({
      area: 'ui',
      vi: 'a',
      en: 'b',
    }));
    expect(parseReleaseNotes(copy)).toBeNull();
  });
});

describe('documents generated from versions.json (scripts/release-notes/build.mjs)', () => {
  const out = render(data);
  const history = out[OUTPUT_FILES.history];
  const changelog = out[OUTPUT_FILES.changelog];
  const html = out[OUTPUT_FILES.html];

  it('are up to date on disk (run `npm run release-notes` after editing versions.json)', () => {
    for (const path of Object.values(OUTPUT_FILES)) {
      expect(text(path), `${path} is stale: npm run release-notes`).toBe(out[path]);
    }
  });

  it('show times in Vietnam (UTC+7) and bare dates as they are', () => {
    expect(viDate('2026-10-05T03:07:21Z')).toBe('05/10/2026');
    expect(viDateTime('2026-10-13T19:05:41Z')).toBe('14/10/2026 02:05');
    expect(viDateTime('2026-10-12T18:43:51+07:00')).toBe('12/10/2026 18:43');
    expect(isoDay('2026-10-13T19:05:41Z')).toBe('2026-10-14');
    expect(viDateTime('2026-10-09')).toBe('09/10/2026');
  });

  it('VERSION_HISTORY.md has exactly the sections I–VIII, in order', () => {
    expect(history.startsWith(`# ${DOC_TITLE}\n`)).toBe(true);
    const h2 = history.split('\n').filter((l) => l.startsWith('## '));
    expect(h2).toEqual(SECTIONS.map((s) => `## ${s}`));
  });

  it('the Google Docs HTML carries the same title, sections and versions', () => {
    expect(html).toContain(`<title>${DOC_TITLE.replace('&', '&amp;')}</title>`);
    const h2 = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(h2).toEqual(SECTIONS);
    const mdH3 = history.split('\n').filter((l) => l.startsWith('### ')).length;
    expect([...html.matchAll(/<h3>/g)]).toHaveLength(mdH3);
    expect([...html.matchAll(/<table>/g)].length).toBe(
      history.split('\n').filter((l) => /^\| -/.test(l)).length,
    );
    for (const v of notes().versions) expect(html).toContain(`<h3>${v.version} (`);
  });

  it('the timeline calls only real GitHub Releases "released", with their verified date', () => {
    const timeline = history.split(`## ${SECTIONS[1]!}`)[1]!.split('\n## ')[0]!;
    for (const v of notes().versions) {
      const row = timeline.split('\n').find((l) => l.startsWith(`| ${v.version} |`));
      expect(row, v.version).toBeDefined();
      const cells = row!.split(' | ');
      expect(cells[1], v.version).toBe(STATUS_LABEL[v.status]);
      if (v.status === 'released') {
        expect(cells[2], v.version).toBe(`${viDate(v.dates.released!)} (đã xác minh)`);
      } else {
        expect(cells[2], v.version).toBe('Chưa phát hành');
        expect(row, v.version).not.toContain(STATUS_LABEL.released);
      }
    }
  });

  it('every missing date is shown as "Chưa xác minh được", never filled in', () => {
    const nulls = notes().versions.flatMap((v) =>
      Object.values(v.dates).filter((d) => d === null),
    ).length;
    expect(history.split('| Chưa xác minh được | — |').length - 1).toBe(nulls);
  });

  it('CHANGELOG.md: newest first, Keep a Changelog sections, a date only for real releases', () => {
    const headings = changelog.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toHaveLength(notes().versions.length);
    notes().versions.forEach((v, i) => {
      const h = headings[i]!;
      expect(h, v.version).toContain(v.version);
      if (v.status === 'released') {
        expect(h).toBe(`## [${v.version}] - ${isoDay(v.dates.released!)}`);
      } else {
        expect(h, v.version).toContain(STATUS_LABEL[v.status]);
        expect(h, v.version).not.toMatch(/\d{4}-\d{2}-\d{2}/);
        expect(h, v.version).not.toContain(STATUS_LABEL.released);
      }
    });
    const sections = new Set(
      changelog
        .split('\n')
        .filter((l) => l.startsWith('### '))
        .map((l) => l.slice(4)),
    );
    for (const s of sections) expect(CHANGELOG_SECTIONS).toContain(s);
    for (const v of notes().versions.filter((x) => x.status === 'released')) {
      expect(changelog).toContain(`[${v.version}]: ${v.refs.releaseUrl!}`);
    }
  });

  it('contain no secrets, e-mail addresses or personal paths', () => {
    for (const [path, content] of Object.entries(out)) {
      expect(secretsOrPaths(content), path).toEqual([]);
    }
  });
});

/** Things that must never be published: keys, tokens, private keys, e-mails, local paths. */
function secretsOrPaths(content: string): string[] {
  const patterns: [string, RegExp][] = [
    ['Windows path', /\b[A-Za-z]:\\[^\s"']+/g],
    ['home path', /(?:\/Users\/|\/home\/|C:\/Users\/)[^\s"']+/gi],
    ['Google key', /AIza[0-9A-Za-z_-]{30,}/g],
    ['Anthropic key', /sk-ant-[0-9A-Za-z_-]+/g],
    ['Groq key', /gsk_[0-9A-Za-z]{20,}/g],
    ['GitHub token', /gh[pousr]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,}/g],
    ['HuggingFace token', /hf_[0-9A-Za-z]{20,}/g],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
    ['e-mail', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g],
  ];
  return patterns.flatMap(([name, re]) => [...content.matchAll(re)].map((m) => `${name}: ${m[0]}`));
}
