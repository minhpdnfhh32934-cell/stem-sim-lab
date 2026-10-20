/**
 * Pictures for local models that read them (the learner circles part of the board and asks about
 * it): the web-side twin of src-tauri/src/ai/local/vision.rs, with the same rules, checked before
 * anything is sent:
 *
 * - at most `MAX_IMAGES` picture in a whole question, only in the learner's own turns;
 * - PNG or JPEG bytes as plain base64 (no `data:` prefix, no spaces, canonical padding),
 *   recognised by their first bytes, at most `MAX_IMAGE_BYTES` once decoded;
 * - only when the caller asks for it (`vision: true`), else `no-vision`;
 * - only when the runtime itself says the model reads pictures (Ollama `capabilities` "vision",
 *   LM Studio type `vlm`, llama.cpp `modalities.vision`): `no-vision` when it says no,
 *   `vision-unverified` when it cannot tell. A picture is never sent on a guess.
 *
 * Cloud requests stay text only (`ChatMessage` has no picture).
 */
import { AiError } from '../types';
import {
  BAD_IMAGE,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  NO_VISION,
  VISION_UNVERIFIED,
  type Cap,
  type LocalChatRequest,
} from './types';

export type ImageFormat = 'png' | 'jpeg';

/** Longest base64 text of a picture of `MAX_IMAGE_BYTES` (checked before decoding). */
const MAX_BASE64_LEN = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Standard base64 with padding, nothing else (as Rust's `STANDARD` engine). */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

/** The unused bits before the padding are zero (Rust refuses other trailing bits too). */
function canonicalEnd(b64: string): boolean {
  if (b64.endsWith('==')) return (ALPHABET.indexOf(b64.charAt(b64.length - 3)) & 0x0f) === 0;
  if (b64.endsWith('=')) return (ALPHABET.indexOf(b64.charAt(b64.length - 2)) & 0x03) === 0;
  return true;
}

/** The bytes of standard base64, or null when it is not. */
function decodeBase64(b64: string): Uint8Array | null {
  if (!BASE64.test(b64) || !canonicalEnd(b64)) return null;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function startsWith(bytes: Uint8Array, sig: readonly number[]): boolean {
  return bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);
}

/** The format of a picture, by its first bytes. */
export function imageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, PNG)) return 'png';
  if (startsWith(bytes, JPEG)) return 'jpeg';
  return null;
}

function bad(why: string): AiError {
  return new AiError('notAllowed', `${BAD_IMAGE}: ${why}`);
}

/** One picture: base64 of PNG or JPEG bytes, at most `MAX_IMAGE_BYTES`. */
export function checkImage(b64: string): ImageFormat {
  if (b64.length > MAX_BASE64_LEN) throw bad('over 2 MB');
  const bytes = decodeBase64(b64);
  if (bytes === null) throw bad('not base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw bad('over 2 MB');
  const format = imageFormat(bytes);
  if (format === null) throw bad('not PNG or JPEG');
  return format;
}

/** The pictures of a question, checked before any request: how many there are. */
export function checkRequest(req: LocalChatRequest): number {
  let count = 0;
  for (const m of req.messages) {
    const images = m.images ?? [];
    if (images.length === 0) continue;
    if (req.vision !== true) throw new AiError('notAllowed', NO_VISION);
    // Only user and assistant turns come from the page: anything but an answer is the learner's.
    if (m.role === 'assistant') throw bad("picture outside the learner's turn");
    count += images.length;
    if (count > MAX_IMAGES) throw bad('more than one picture');
    for (const image of images) checkImage(image);
  }
  return count;
}

/** Whether the model may get a picture, from what its runtime says about it. */
export function allowVision(vision: Cap): void {
  if (vision === 'no') throw new AiError('notAllowed', NO_VISION);
  if (vision === 'unverified') throw new AiError('notAllowed', VISION_UNVERIFIED);
}

/** `data:image/png;base64,…` of a checked picture (the OpenAI-style `image_url`). */
export function dataUrl(b64: string): string {
  // 12 base64 characters are 9 bytes, enough for both signatures.
  const head = decodeBase64(b64.slice(0, 12));
  const mime = head !== null && imageFormat(head) === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${b64}`;
}
