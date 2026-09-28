import type vi from './locales/vi';

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

type Source = typeof vi;

/** Same tree shape as the Vietnamese source, with every leaf widened to `string`. */
type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };
export type Messages = DeepStrings<Source>;

/** Union of every valid dotted key, e.g. `"topbar.analyze"`. Typos fail to compile. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Source>;

export type MessageParams = Record<string, string | number>;
