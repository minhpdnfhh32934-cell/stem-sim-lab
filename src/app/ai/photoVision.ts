import { modelFor, useAiStore } from '@/ai/aiStore';
import { aiErrorKind } from '@/ai/errorKind';
import { getLocalClient } from '@/ai/local/client';
import { checkFor, useLocalAiStore } from '@/ai/local/localAiStore';
import { getTransport, newRequestId } from '@/ai/transport';
import { translate, type Locale } from '@/app/i18n';
import type { SettingsSection } from '@/app/workspaceStore';
import { localFailure, localFailureText } from './localRuntime';

/** Sentinel the reader must return when the photo has no readable problem. */
export const PHOTO_UNREADABLE = 'KHONG_DOC_DUOC';

export const PHOTO_SYSTEM = {
  vi: 'Đọc nguyên văn đề bài trong ảnh (Vật lý, Hóa học hoặc Sinh học). Chỉ trả về văn bản đề, không giải thích thêm. Nếu ảnh không phải đề bài hoặc không đọc được, trả về đúng chuỗi KHONG_DOC_DUOC.',
  en: 'Transcribe the problem text in the photo (Physics, Chemistry or Biology). Return only the problem text, no explanation. If it is not a problem or is unreadable, return exactly KHONG_DOC_DUOC.',
} as const;

/**
 * Reads a photographed problem through the configured cloud API (browser and
 * localhost only: the desktop gateway has no image endpoint, so desktop builds
 * always use the local model). Throws when unavailable — callers fall back to
 * the local model, then to an honest error.
 */
export async function transcribeWithCloud(base64: string, locale: 'vi' | 'en'): Promise<string> {
  const ai = useAiStore.getState();
  if (ai.provider === 'off') throw new Error('vision:unavailable');
  const transport = getTransport();
  if (!transport.transcribePhoto) throw new Error('vision:unavailable');
  const text = await transport.transcribePhoto({
    provider: ai.provider,
    model: modelFor(ai.models, ai.provider),
    system: PHOTO_SYSTEM[locale],
    base64,
    timeoutSecs: ai.timeoutSecs,
  });
  return text.trim();
}

/**
 * Reads a photographed problem with the runtime chosen on this computer (Settings → AI trên máy
 * khác), only when its check on this computer saw that the model reads pictures. Null when it
 * cannot: the caller then says so plainly and never sends the photo online instead. A failure of
 * the runtime throws.
 */
export async function transcribeWithLocalRuntime(
  base64: string,
  locale: 'vi' | 'en',
): Promise<string | null> {
  const store = useLocalAiStore.getState();
  const selection = store.selected;
  if (!selection || checkFor(store, selection)?.capabilities.vision !== 'yes') return null;
  const answer = await getLocalClient().chat({
    requestId: newRequestId(),
    kind: selection.kind,
    baseUrl: selection.baseUrl,
    model: selection.model,
    system: PHOTO_SYSTEM[locale],
    messages: [{ role: 'user', content: 'Đề bài trong ảnh là gì?', images: [base64] }],
    vision: true,
    temperature: 0,
    maxTokens: 1024,
  });
  return answer.content.trim();
}

/** What the AI on this computer did with a photo (the photo never goes online from here). */
export type LocalPhotoReading =
  | { kind: 'text'; text: string }
  /**
   * The chosen model was not seen reading pictures on this computer: nothing was sent to it. The
   * in-app Gemma may still read it, else the learner is told what reading a photo needs.
   */
  | { kind: 'noVision' }
  /** Nothing to read with (no runtime and model picked) or the runtime failed: why, and where. */
  | { kind: 'error'; message: string; section: SettingsSection | null };

/**
 * A photo with the local runtime engine chosen (`local`, or `local-missing` when no runtime and
 * model are picked). Each cause has its own sentence: no runtime picked, a runtime that did not
 * answer (not running, stalled, model missing… — one request, never retried), or a model not seen
 * reading pictures here. Nothing ever goes online.
 */
export async function readPhotoOnComputer(
  engine: 'local' | 'local-missing',
  base64: string,
  locale: Locale,
): Promise<LocalPhotoReading> {
  const selection = useLocalAiStore.getState().selected;
  if (engine === 'local-missing' || !selection) {
    return {
      kind: 'error',
      message: translate(locale, 'camera.localNotSelected'),
      section: 'runtimes',
    };
  }
  try {
    const text = await transcribeWithLocalRuntime(base64, locale);
    return text === null ? { kind: 'noVision' } : { kind: 'text', text };
  } catch (e) {
    // The runtime's own words stay in the console for troubleshooting.
    console.warn('[photo-local]', e instanceof Error ? e.message : String(e));
    // The runtime itself says the model does not read pictures: the same as a model not seen
    // reading them here (asking it again cannot help).
    const kind = aiErrorKind(e);
    if (kind === 'localNoVision' || kind === 'localVisionUnverified') return { kind: 'noVision' };
    // A picture it refused, a window too small for it…: a sentence that says what helps.
    const failure = localFailure(e, 'photo');
    return {
      kind: 'error',
      message: localFailureText(locale, failure, selection.kind),
      section: failure.section,
    };
  }
}

export function cleanTranscription(text: string): string | null {
  const cleaned = text.trim();
  if (!cleaned || cleaned.includes(PHOTO_UNREADABLE)) return null;
  return cleaned.slice(0, 4000);
}
