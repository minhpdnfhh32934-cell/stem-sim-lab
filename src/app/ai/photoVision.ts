import { modelFor, useAiStore } from '@/ai/aiStore';
import { getLocalClient } from '@/ai/local/client';
import { checkFor, useLocalAiStore } from '@/ai/local/localAiStore';
import { getTransport, newRequestId } from '@/ai/transport';

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

export function cleanTranscription(text: string): string | null {
  const cleaned = text.trim();
  if (!cleaned || cleaned.includes(PHOTO_UNREADABLE)) return null;
  return cleaned.slice(0, 4000);
}
