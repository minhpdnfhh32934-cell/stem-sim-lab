import { describe, expect, it } from 'vitest';
import { AiError } from '../types';
import {
  BAD_IMAGE,
  MAX_IMAGE_BYTES,
  NO_VISION,
  VISION_UNVERIFIED,
  type LocalChatMessage,
  type LocalChatRequest,
} from './types';
import { allowVision, checkImage, checkRequest, dataUrl } from './vision';

/** Pictures for local models: the same rules as src-tauri/src/ai/local/vision.rs. */
const PNG_HEAD = '\x89PNG\r\n\x1a\n';
const png = btoa(`${PNG_HEAD}\0\0\0\rIHDR picture`);
const jpeg = btoa('\xff\xd8\xff\xe0\0\x10JFIF\0 picture');

function bytesOf(n: number, head: string): string {
  // `n` bytes starting with `head`, as base64 (built in parts: btoa of a 2 MB string is fine).
  return btoa(head + '\0'.repeat(n - head.length));
}

function req(messages: LocalChatMessage[], vision: boolean): LocalChatRequest {
  return {
    requestId: 'r',
    kind: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'm',
    system: 's',
    messages,
    vision,
  };
}

const asking = (images: string[]): LocalChatMessage => ({
  role: 'user',
  content: 'Chỗ em khoanh là gì?',
  images,
});

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (e) {
    expect(e).toBeInstanceOf(AiError);
    expect((e as AiError).code).toBe('notAllowed');
    return (e as AiError).message;
  }
  throw new Error('not refused');
}

describe('pictures for local models', () => {
  it('recognises PNG and JPEG by their first bytes', () => {
    expect(checkImage(png)).toBe('png');
    expect(checkImage(jpeg)).toBe('jpeg');
    expect(dataUrl(png)).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
    expect(dataUrl(jpeg)).toMatch(/^data:image\/jpeg;base64,\/9j\//);
    // A GIF, a text, a data URL, spaces, non-canonical padding: refused.
    for (const not of [
      btoa('GIF89a picture bytes'),
      btoa('plain text, not a picture'),
      `data:image/png;base64,${png}`,
      `${png} `,
      '@@@@',
      'iVBORw0KGgp=',
    ]) {
      expect(
        refusal(() => checkImage(not)),
        not,
      ).toMatch(new RegExp(`^${BAD_IMAGE}`));
    }
  });

  it('refuses a picture over 2 MB, and accepts exactly 2 MB', () => {
    expect(refusal(() => checkImage(bytesOf(MAX_IMAGE_BYTES + 1, PNG_HEAD)))).toBe(
      `${BAD_IMAGE}: over 2 MB`,
    );
    expect(checkImage(bytesOf(MAX_IMAGE_BYTES, PNG_HEAD))).toBe('png');
    expect(refusal(() => checkImage('A'.repeat(4 * 1024 * 1024)))).toBe(`${BAD_IMAGE}: over 2 MB`);
  });

  it('allows at most one picture, only when asked for, only in the learner turn', () => {
    expect(checkRequest(req([asking([])], false))).toBe(0);
    expect(checkRequest(req([{ role: 'user', content: 'x' }], false))).toBe(0);
    expect(checkRequest(req([asking([png])], true))).toBe(1);
    expect(refusal(() => checkRequest(req([asking([png])], false)))).toBe(NO_VISION);
    for (const messages of [[asking([png, jpeg])], [asking([png]), asking([jpeg])]]) {
      expect(refusal(() => checkRequest(req(messages, true)))).toBe(
        `${BAD_IMAGE}: more than one picture`,
      );
    }
    const answer: LocalChatMessage = { role: 'assistant', content: 'Đây', images: [png] };
    expect(refusal(() => checkRequest(req([answer], true)))).toMatch(new RegExp(`^${BAD_IMAGE}`));
    expect(refusal(() => checkRequest(req([asking(['eA=='])], true)))).toMatch(
      new RegExp(`^${BAD_IMAGE}`),
    );
  });

  it('sends a picture only to a model its runtime says reads pictures', () => {
    expect(() => {
      allowVision('yes');
    }).not.toThrow();
    expect(
      refusal(() => {
        allowVision('no');
      }),
    ).toBe(NO_VISION);
    expect(
      refusal(() => {
        allowVision('unverified');
      }),
    ).toBe(VISION_UNVERIFIED);
  });
});
