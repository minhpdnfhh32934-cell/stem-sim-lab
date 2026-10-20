import type { Route } from '@playwright/test';

/**
 * Fake online providers for the end-to-end tests (no real API is ever called). A question to
 * AI Teacher streams when the transport can (Gemini `:streamGenerateContent?alt=sse`, Groq and
 * Claude `"stream": true`), while Think's draft and review, "Phân tích đề" and the summary of older
 * turns ask for the whole answer. These helpers answer in whichever form the request asked for,
 * as the provider would.
 */

/** Server-sent events: one `data:` line per JSON value, a blank line after each. */
export function sse(events: unknown[], done = false): string {
  return (
    events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + (done ? 'data: [DONE]\n\n' : '')
  );
}

/** Where a text is cut in two pieces for a stream (inside a tag or a word, on purpose). */
function halves(text: string): [string, string] {
  const cut = Math.floor(text.length / 2);
  return [text.slice(0, cut), text.slice(cut)];
}

/** The request asked for a streamed Gemini answer. */
export function isGeminiStream(route: Route): boolean {
  return route.request().url().includes(':streamGenerateContent?alt=sse');
}

/** A Gemini answer: streamed in two events, or whole, as the request asked. */
export function fulfillGemini(
  route: Route,
  text: string,
  finishReason = 'STOP',
  modelVersion = 'gemini-test',
): Promise<void> {
  const answer = (t: string, finish?: string) => ({
    candidates: [
      {
        content: { role: 'model', parts: [{ text: t }] },
        ...(finish ? { finishReason: finish } : {}),
      },
    ],
    modelVersion,
  });
  if (isGeminiStream(route)) {
    const [a, b] = halves(text);
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sse([answer(a), answer(b, finishReason)]),
    });
  }
  return route.fulfill({ json: answer(text, finishReason) });
}

/** The request asked for a streamed Groq (OpenAI-compatible) answer. */
export function isGroqStream(route: Route): boolean {
  const body = route.request().postDataJSON() as { stream?: unknown } | null;
  return body?.stream === true;
}

/** A Groq answer: streamed in two chunks and `[DONE]`, or whole, as the request asked. */
export function fulfillGroq(
  route: Route,
  text: string,
  finishReason = 'stop',
  model = 'qwen-test',
): Promise<void> {
  if (isGroqStream(route)) {
    const [a, b] = halves(text);
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sse(
        [
          { model, choices: [{ index: 0, delta: { content: a } }] },
          { model, choices: [{ index: 0, delta: { content: b }, finish_reason: finishReason }] },
        ],
        true,
      ),
    });
  }
  return route.fulfill({
    json: { model, choices: [{ message: { content: text }, finish_reason: finishReason }] },
  });
}

/** Gemini's answer when the free quota is used up (the shape of Google's 429 body). */
export function geminiQuota(route: Route): Promise<void> {
  return route.fulfill({
    status: 429,
    json: {
      error: {
        code: 429,
        message: 'You exceeded your current quota.',
        status: 'RESOURCE_EXHAUSTED',
        details: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }],
      },
    },
  });
}

/** Groq's answer when its rate limit is reached. */
export function groqQuota(route: Route): Promise<void> {
  return route.fulfill({
    status: 429,
    json: {
      error: {
        message: 'Rate limit reached for model qwen-test.',
        type: 'tokens',
        code: 'rate_limit_exceeded',
      },
    },
  });
}
