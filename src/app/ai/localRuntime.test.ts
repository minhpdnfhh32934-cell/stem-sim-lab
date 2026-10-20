import { describe, expect, it } from 'vitest';
import { AiError } from '@/ai/types';
import { localFailure, type LocalUse } from './localRuntime';

/** One sentence per failure of a runtime on this computer, with the Settings page that helps. */
describe('localFailure', () => {
  // HTTP 413, and a runtime's own words for a full window (llama.cpp, LM Studio).
  const tooBig = [
    new AiError('http', '413 Payload Too Large'),
    new AiError('http', 'local-failed: 400: the request exceeds the available context size'),
  ];

  it('a question too long for the window: AI Teacher can shorten what it sends (Trí nhớ)', () => {
    for (const e of tooBig) {
      expect(localFailure(e)).toEqual({
        key: 'chat.errors.localContext',
        section: 'memory',
        retry: false,
      });
    }
  });

  it.each(['photo', 'explain', 'analysis'] as const)(
    'one %s too long for the window: only a model with a larger one helps',
    (use: LocalUse) => {
      for (const e of tooBig) {
        expect(localFailure(e, use)).toEqual({
          key: 'chat.errors.localContextTask',
          section: 'runtimes',
          retry: false,
        });
      }
    },
  );

  it.each(['reasoningOnly', 'empty answer (length)', 'empty answer (stop)', 'missing content'])(
    'a model that wrote no answer (%s) is said as such, for every use',
    (message) => {
      for (const use of ['chat', 'photo', 'explain', 'analysis'] as const) {
        expect(localFailure(new AiError('badResponse', message), use)).toEqual({
          key: 'chat.errors.localNoAnswer',
          section: 'runtimes',
          retry: true,
        });
      }
    },
  );

  it('a picture refused by the runtime: the photo sentence, only for a photo', () => {
    expect(localFailure(new AiError('notAllowed', 'no-vision'), 'photo')).toEqual({
      key: 'camera.localNoVision',
      section: 'runtimes',
      retry: false,
    });
    expect(localFailure(new AiError('notAllowed', 'bad-image: over 2 MB'), 'photo')).toEqual({
      key: 'camera.readFailed',
      section: null,
      retry: false,
    });
    // No picture is sent anywhere else: there it is an unexpected runtime error.
    expect(localFailure(new AiError('notAllowed', 'no-vision'), 'chat').key).toBe(
      'chat.errors.localFailed',
    );
  });

  it('the runtime’s own failures keep their sentences', () => {
    expect(localFailure(new AiError('network', 'local-unreachable: refused'), 'photo')).toEqual({
      key: 'chat.errors.localDown',
      section: 'runtimes',
      retry: true,
    });
    expect(localFailure(new AiError('http', 'local-failed: 500: boom')).key).toBe(
      'chat.errors.localFailed',
    );
  });
});
