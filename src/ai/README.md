# ai/ — Problem reader (Phase 3)

The LLM **only** (a) extracts a problem into a structured `SceneSpec` JSON and (b) explains, in
words, results the engine already computed. It never computes numbers or invents simulations.

Pipeline: problem text → LLM (Rust `AIProvider`: Gemini by default in the main edition, Claude in both editions) → JSON → Zod validation →
physical consistency checks → "Tôi hiểu đề như sau" confirmation table → engine.

## Streaming and errors

- `transport.ts`: `LlmTransport.chatStream?(req, onText, signal)` streams text answers (never
  JSON-schema ones). Desktop: Rust `ai_chat_stream` through a Tauri `Channel`; browser: SSE read
  in the page (`cloudStream.ts`, `sse.ts`). Streamed text is provisional: `onText` always gets the
  whole text so far, a `reset` event replaces it, and the returned content is final
  (`ShownText` in `types.ts`).
- `thinkFilter.ts`: removes model reasoning (`<think>…`) while a stream arrives, the rule of
  `tests/fixtures/reasoning-strip.json` (shared with Rust).
- `errorKind.ts`: `aiErrorKind(e)` turns any AI error (cloud, local, Rust or page) into a few
  kinds the screens explain in simple words; HTTP rules agree with the quota fallback.

## Local runtimes (`local/`, user decision 2026-10-14)

Ollama, LM Studio, llama.cpp's `llama-server` and other OpenAI-compatible servers on this
computer. Not cloud providers: no key, no daily cap, no retry, never a fallback to the cloud.

- `client.ts`: `getLocalClient()` → `TauriLocalClient` (Rust `local_ai_*` commands; the only way
  in the desktop app) or `FetchLocalClient` (`fetchClient.ts`, browser development and E2E only;
  needs the runtime to allow the page's origin).
- `endpoint.ts` (loopback-only addresses), `stream.ts` (NDJSON/SSE lines) and `runtimes.ts`
  (request builders and parsers) mirror `src-tauri/src/ai/local/` and are tested on the same
  fixtures (`src-tauri/tests/fixtures/local-ai/`).
- `localAiStore.ts` (`stemsim.local-ai`): the chosen runtime and model, added addresses and model
  checks; re-validated on every load, nothing probed on load.
- `localTransport.ts`: an `LlmTransport` over the chosen local model for the analysis pipeline.
