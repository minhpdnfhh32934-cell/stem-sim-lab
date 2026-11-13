import { z } from 'zod';

/** Interface languages; English is the default, and the fallback for any missing text. */
export const LANGUAGES = ['en', 'vi'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/** Each language named in itself, so a reader finds their own whatever is shown. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

/** Values for a text's `{name}` placeholders. */
export type TextParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;

/** The `{name}` placeholders a text fills, sorted: every language of a key must fill the same. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '').sort();
}

/** `text` with each `{name}` replaced by `params[name]`; an unknown one stays as written. */
export function fill(text: string, params: TextParams = {}): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => String(params[name] ?? whole));
}

/** The string fields of `T`: what `Texts.of` translates. */
export type TextField<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends string ? K : never;
}[keyof T] &
  string;

/**
 * Player-facing text in the current language. Interface text is written in English where it is
 * used, under a key its translations are filed by (`src/content/strings.json`); content carries
 * its own translations beside its English (`"vi": { "label": "…" }`).
 */
export interface Texts {
  /** The current language's text for `key`, else `english`; `{name}` filled from `params`. */
  ui(key: string, english: string, params?: TextParams): string;
  /** A content object's text field in the current language, else its English. */
  of<T extends object>(content: T, field: TextField<T>): string;
}

/** Translations of interface text, by language and key (the English is in the code). */
export type Catalogs = Readonly<Partial<Record<Language, Readonly<Record<string, string>>>>>;

/** Texts in whatever language `current` gives at each call, so one instance follows a change. */
export function createTexts(catalogs: Catalogs, current: () => Language): Texts {
  return {
    ui: (key, english, params) => fill(catalogs[current()]?.[key] ?? english, params),
    of: (content, field) => {
      const fields = content as Readonly<Record<string, unknown>>;
      const own = fields[current()] as Readonly<Record<string, unknown>> | undefined;
      const text = own?.[field] ?? fields[field];
      return typeof text === 'string' ? text : '';
    },
  };
}

/** English as written: for code run without a game (tests, tools). */
export const ENGLISH: Texts = createTexts({}, () => DEFAULT_LANGUAGE);

/**
 * Schema fields for a content object's translations of its own text `fields`, beside the
 * English: `"vi": { "label": "…" }`. Each is optional (a missing one shows the English); a field
 * not named here is an error.
 */
export function localized<const K extends string>(...fields: K[]) {
  const text = z.string().min(1).optional();
  const shape = Object.fromEntries(fields.map((f) => [f, text])) as Record<K, typeof text>;
  return { vi: z.strictObject(shape).optional() };
}
