/** Types of build.mjs (the version history generator), for tests/release-notes.test.ts. */
export declare const OUTPUT_FILES: Readonly<{
  history: 'docs/VERSION_HISTORY.md';
  changelog: 'docs/CHANGELOG.md';
  html: 'release-notes/google-docs.html';
}>;
export declare const DOC_TITLE: string;
export declare const SECTIONS: readonly string[];
export declare const CHANGELOG_SECTIONS: readonly string[];
export declare const STATUS_LABEL: Readonly<
  Record<'released' | 'merged-not-released' | 'in-review' | 'development' | 'unverified', string>
>;
export declare function viDate(iso: string): string;
export declare function viDateTime(iso: string): string;
export declare function isoDay(iso: string): string;
export declare function render(
  data: unknown,
): Record<
  'docs/VERSION_HISTORY.md' | 'docs/CHANGELOG.md' | 'release-notes/google-docs.html',
  string
>;
