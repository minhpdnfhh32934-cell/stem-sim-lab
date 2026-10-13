import type { Locale } from '@/app/i18n';

/** One entry of the voice list in Settings → Giọng nói. */
export interface VoiceChoice {
  uri: string;
  label: string;
}

type VoiceLike = Pick<SpeechSynthesisVoice, 'voiceURI' | 'name' | 'lang'>;

/** "en_US" → "en-US" (some engines use underscores). */
function tag(lang: string): string {
  return lang.replace(/_/g, '-');
}

/** The language name in the learner's language ("en-US" → "Tiếng Anh (Mỹ)"), else the code. */
export function languageName(lang: string, locale: Locale): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(tag(lang));
    if (!name) return lang;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return lang;
  }
}

/**
 * The voice name without the language that Windows appends ("Microsoft David - English
 * (United States)" → "Microsoft David"); the language is shown once, in the learner's language.
 */
export function shortVoiceName(name: string): string {
  const cut = name.replace(/\s+-\s+[^-]+\([^)]*\)\s*$/, '').trim();
  return cut || name;
}

/**
 * Vietnamese voices first, then the others sorted by language and name, each labelled
 * "name · language". Other languages read Vietnamese with the wrong tones, so they stay in
 * their own group.
 */
export function voiceChoices(
  voices: readonly VoiceLike[],
  locale: Locale,
): { vietnamese: VoiceChoice[]; others: VoiceChoice[] } {
  const entry = (v: VoiceLike) => {
    const name = shortVoiceName(v.name);
    const language = languageName(v.lang, locale);
    return { uri: v.voiceURI, label: `${name} · ${language}`, name, language };
  };
  const isVietnamese = (v: VoiceLike) => tag(v.lang).toLowerCase().startsWith('vi');
  const strip = ({ uri, label }: VoiceChoice) => ({ uri, label });
  const vietnamese = voices.filter(isVietnamese).map(entry).map(strip);
  const others = voices
    .filter((v) => !isVietnamese(v))
    .map(entry)
    .sort(
      (a, b) =>
        a.language.localeCompare(b.language, locale) || a.name.localeCompare(b.name, locale),
    )
    .map(strip);
  return { vietnamese, others };
}
