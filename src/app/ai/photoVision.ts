import { isTauri } from '@tauri-apps/api/core';
import { modelFor, useAiStore } from '@/ai/aiStore';
import { aiErrorKind } from '@/ai/errorKind';
import { gemmaChatText, gemmaReady } from '@/ai/gemmaTransport';
import { getLocalClient } from '@/ai/local/client';
import { checkFor, useLocalAiStore } from '@/ai/local/localAiStore';
import { getTransport, newRequestId } from '@/ai/transport';
import { translate, type Locale, type MessageKey } from '@/app/i18n';
import type { SettingsSection } from '@/app/workspaceStore';
import { outputIsSafe } from '@/safety/moderation';
import { currentSafety, logIncident } from '@/safety/safetyStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { analysisEngine } from './engineChoice';
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

/** What reading a photographed problem gave: the text for the problem box, or why not. */
export type PhotoReading =
  | { kind: 'text'; text: string }
  /** `section`: the Settings page that helps (null: none does). */
  | { kind: 'error'; message: string; section: SettingsSection | null };

/**
 * Reads a photographed problem (base64) with the AI the learner uses. The safety gates come
 * first, for every path (the in-app Gemma included). Chain: the online API only when it is the
 * learner's AI (browser builds; a chosen Gemma never goes online) → the in-app Gemma → an honest
 * error. With a runtime on this computer chosen, the photo never goes online. The text passes
 * the output filter before it reaches the problem box; analysis (with its own input checks)
 * stays separate. Throws only on an unexpected failure.
 */
export async function readProblemPhoto(base64: string, locale: Locale): Promise<PhotoReading> {
  const error = (key: MessageKey, section: SettingsSection | null = null): PhotoReading => ({
    kind: 'error',
    message: translate(locale, key),
    section,
  });
  const checked = (raw: string): PhotoReading => {
    const text = cleanTranscription(raw);
    if (!text) return error('camera.readFailed');
    if (!outputIsSafe(text)) {
      logIncident('outputUnsafe');
      return error('camera.outputUnsafe');
    }
    return { kind: 'text', text };
  };

  const safety = await currentSafety().catch(() => null);
  if (!safety?.aiAllowed) return error('chat.errors.notAllowed', 'safety');

  const engine = await analysisEngine();
  // The learner chose AI on this computer: the photo stays on this computer.
  const onComputer = engine === 'local' || engine === 'local-missing';
  if (onComputer) {
    const local = await readPhotoOnComputer(engine, base64, locale);
    if (local.kind === 'error') return local;
    // The runtime read it (an empty reading: "chụp lại rõ hơn"); Gemma is not asked too.
    if (local.kind === 'text') return checked(local.text);
  }

  /** Remembers a cloud failure so the final message names the real cause. */
  let cloudIssue: 'badKey' | 'badModel' | null = null;
  // Only the online AI the learner uses reads a photo online. Desktop builds have no cloud
  // image endpoint: straight to the in-app model.
  if (engine === 'cloud' && !isTauri()) {
    try {
      const raw = await transcribeWithCloud(base64, locale);
      if (raw.trim() !== '') return checked(raw);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const status = /^\s*(\d{3})/.exec(message)?.[1];
      if (status === '400' || status === '401' || status === '403') cloudIssue = 'badKey';
      else if (status === '404') cloudIssue = 'badModel';
    }
  }

  const chat = useChatStore.getState();
  if (!(await gemmaReady(chat.gemmaModel))) {
    if (onComputer) return error('camera.localNoVision', 'runtimes');
    if (engine === 'gemma' || engine === 'gemma-missing') return error('camera.needGemma', 'local');
    if (cloudIssue === 'badKey') return error('camera.badKey', 'ai');
    if (cloudIssue === 'badModel') return error('camera.badModel', 'ai');
    return error('camera.needVision');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const answer = await gemmaChatText({
    model: chat.gemmaModel,
    system: PHOTO_SYSTEM[locale],
    messages: [{ role: 'user', content: 'Đề bài trong ảnh là gì?' }],
    images: [bytes.buffer],
  });
  return checked(answer.content);
}
