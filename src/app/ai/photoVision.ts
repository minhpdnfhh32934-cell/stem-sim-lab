import { modelFor, useAiStore } from '@/ai/aiStore';
import { getTransport } from '@/ai/transport';

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

export function cleanTranscription(text: string): string | null {
  const cleaned = text.trim();
  if (!cleaned || cleaned.includes(PHOTO_UNREADABLE)) return null;
  return cleaned.slice(0, 4000);
}
