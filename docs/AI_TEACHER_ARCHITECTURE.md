# AI Teacher ("Dạy học bằng AI") — architecture (PROMPT_PHAN_2 Part B)

> **Tóm tắt tiếng Việt.** Tách **"bộ não"** (AI quyết định dạy gì, viết kịch bản TeachScript) khỏi
> **"bộ diễn"** (chương trình tất định: giọng nói, khuôn mặt, vòng sóng, bảng trắng, con trỏ). Đồng
> hồ chủ là âm thanh đang phát. Mọi con số đến từ công cụ tính toán của app. Không có AI chạy trên
> máy: giọng nói và nhận dạng đều qua dịch vụ cloud (bản chính: Gemini; bản THPT: Azure — chờ
> duyệt, `docs/VOICE_BENCHMARK.md`). Khóa API nằm ở Rust. Màn hình "Dạy học bằng AI" là khu vực
> riêng, tải riêng, không ảnh hưởng khu mô phỏng. **Trạng thái: đặc tả T0, chờ duyệt.**

Status: **draft for approval (T0)**. Companion specs: `docs/TEACHSCRIPT.md` (script language),
`docs/VOICE_BENCHMARK.md` (voice services), `docs/LEGAL_COMPLIANCE.md` §2c (terms).

## 1. Principles (B1, B13) → design consequences

| Principle                        | Consequence in the design                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Correct knowledge first (B1.1)   | The brain plans with **tool calls** (physics engine, CAS, chemistry DB, answer checkers). TeachScript validator rejects numbers without provenance (TEACHSCRIPT §7).           |
| Honest that it is an AI (B1.2)   | Label "Thầy/cô AI" always visible on the ring; persona text forbids claiming to be human; safety test "thầy có phải người thật không".                                         |
| Warm but bounded (B1.3)          | Persona + state machine `CHITCHAT` returns to the lesson within 1–3 turns; break reminder reuses `src/learn/breakReminder.ts`.                                                 |
| Safety (B1.4)                    | `teacher/safety` wraps the existing `src/safety` (moderation both ways, crisis card, incident log kind+time only). State `SUPPORT` stops the lesson.                           |
| Privacy (B1.5)                   | Mic opt-in (pilot: supervisor consent through the Rust gate), hold-to-talk default, no audio stored, learner model stores learning data only, "xem và xóa" button.             |
| Always a way out (B1.6)          | Text input; OS voice (Web Speech) or captions if the voice service fails; offline → friendly message + link to the simulations.                                                |
| Performance before brain (B13.2) | T1–T3 build the performer with a hand-written TeachScript lesson; the LLM arrives in T4.                                                                                       |
| No local AI (B13.6)              | VAD and lip-sync are signal processing (energy, band energies); no ML model runs on the device.                                                                                |
| No Gemini code in the pilot      | Speech providers sit behind `#[cfg(feature = "edition-main")]` (Gemini) / both editions (Azure); web side behind `__EDITION__`; `build:pilot` bundle check extended to speech. |

## 2. Data flow

```
 Learner: voice (hold-to-talk) · text · quick-answer buttons · pen on the board
     │
     ▼
 speech-in   VAD (signal) ─► ASR stream (cloud, via Rust) ─► quick commands (rules: "chậm lại", "nói lại", "dừng")
     │
     ▼
 safety      checkInput (src/safety/moderation) ─► crisis → SUPPORT state, crisis card
     │
     ▼
 brain       DialogueManager (state machine) · LessonPlanner · LearnerModel
     │         └─ plan step (not streamed): tool calls → results with ids (tool:fbd_1 …)
     │         └─ perform step (streamed): TeachScript text
     ▼
 script      streaming parser ─► validator (ids, zones, number provenance, outputIsSafe)
     ▼
 orchestrator  timeline per sentence; master clock = AudioContext.currentTime
     ├─► voice      TTSProvider (segments at anchors / word boundaries) → AudioWorklet playback
     ├─► face       expression blend, visemes or audio-driven mouth, gaze, idle motion
     ├─► wave       ring reacting to teacher RMS (warm) or learner mic (cool)
     ├─► board      layout engine (zones, rbush) → handwriting animation, marks, camera
     └─► pointer    pen/pointer moves to the current target
```

## 3. Modules

Web (`src/teacher/`, lazy-loaded chunk — opening the simulations never loads it):

| Folder          | Responsibility                                                                                         | Phase |
| --------------- | ------------------------------------------------------------------------------------------------------ | ----- |
| `screen/`       | Route "Dạy học bằng AI": layout states (talk ↔ board), control bar, captions, transcript drawer        | T0–T1 |
| `script/`       | TeachScript types, streaming parser, validator, provenance check, TTS text normaliser (vi)             | T1    |
| `orchestrator/` | Timeline builder, scheduler on the audio clock, barge-in + resume point, dev metrics overlay           | T1    |
| `voice/`        | `TTSProvider` interface; Gemini / Azure / Web Speech implementations; phrase audio cache               | T1    |
| `wave/`         | Wave ring (WebGL; Canvas 2D on the light tier; `prefers-reduced-motion`)                               | T1    |
| `face/`         | `FaceRenderer` interface; `Face2D` (SVG/Canvas rig, project-designed characters); `Face3D` optional T7 | T1–T3 |
| `board/`        | Logical canvas, zones, layout engine (rbush), handwriting level 1, marks (perfect-freehand), history   | T2    |
| `pointer/`      | Pointer/pen motion                                                                                     | T2    |
| `brain/`        | Prompts + persona (`brain/persona/`), DialogueManager, LessonPlanner, tool registry, answer checkers   | T4    |
| `speech-in/`    | Mic permission flow, VAD, `ASRProvider` (stream), echo handling, quick commands                        | T5    |
| `learner/`      | Learner model (local only), spaced review schedule, view/delete                                        | T6    |
| `safety/`       | Adapters to `src/safety` + teacher-specific tests                                                      | T4–T6 |

Rust (`src-tauri/src/speech/`): provider clients with the key kept in the OS keychain (same
pattern as `src-tauri/src/ai/`): `gemini_tts.rs` / `gemini_asr.rs` (**main edition only**),
`azure.rs` (both editions). Commands stream audio chunks to the page through a Tauri `Channel`.
Daily caps and usage counters extend `ai/usage.rs`; every speech command passes the safety gate.

## 4. Key interfaces (TypeScript, illustrative)

```ts
interface TTSProvider {
  readonly id: 'gemini' | 'azure' | 'webspeech';
  readonly wordTimings: boolean; // Azure: true (WordBoundary); Gemini: false → split at anchors
  readonly visemes: boolean;
  synthesize(seg: SpeechSegment, signal: AbortSignal): AsyncIterable<AudioChunk | TimingEvent>;
}
interface ASRProvider {
  start(opts: { phrases: string[]; language: 'vi-VN' }): ASRSession; // opened only while talking
}
interface ASRSession {
  push(pcm16k: Int16Array): void;
  events: AsyncIterable<{ kind: 'interim' | 'final'; text: string }>;
  stop(): void;
}
interface FaceRenderer {
  setExpression(e: Expression, blendMs: number): void;
  setMouth(viseme: VisemeId | { open: number; round: number }): void;
  gaze(to: 'student' | 'board' | { x: number; y: number }): void; // screen coords from layout, not from the LLM
  nod(): void;
}
```

## 5. Synchronisation and latency (B8)

- One scheduler on `AudioContext.currentTime`; visual events are scheduled against audio sample
  times and checked every animation frame. Target error ≤ 100 ms (board), ≤ 60 ms (mouth). A test
  harness with a fake audio clock measures both (T1).
- Pipeline per reply: LLM plan (tools) → LLM stream → sentence 1 to TTS while sentence 2 streams →
  play; one sentence buffered ahead. Face goes `thinking` within 100 ms of the learner finishing.
- Budget: ≤ 1.5 s (good network), ≤ 2.5 s (school Wi-Fi/4G) from end of learner speech to first
  teacher audio. Prompt caching for the system prompt/persona (Claude); context summarising of old
  turns.
- Barge-in: VAD > ~300 ms of speech while the teacher talks → stop audio ≤ 200 ms, finish the
  glyph, face `listening`, keep the resume point; then "Mình quay lại chỗ lúc nãy nhé?".

## 6. Keys, tokens and editions

- Keys stay in Rust (keychain), as today. Gemini TTS/ASR calls are made **from Rust** (HTTP/WebSocket),
  so no key or token reaches the page.
- **Azure (pilot) — needs approval:** Azure has no Rust SDK; word-boundary/viseme events and interim
  recognition come through the Speech SDK (JavaScript available). Proposal: Rust exchanges the key
  for a short-lived authorization token (about 10 minutes) and hands only that token to the
  JavaScript SDK in the page; the key itself never reaches the page. Alternative if not approved:
  implement the Azure WebSocket protocol in Rust (more work, no official SDK).
- The CSP `connect-src` is unchanged unless the Azure JS SDK path is approved (then the Azure
  regional speech host is added to production CSP — a security-relevant change, listed for approval).

## 7. Screen and layout (B4) — T0 sketch

The route is implemented in T0 as a **non-functional sketch** (`src/teacher/screen/`), clearly
labelled "Bản phác thảo — chưa hoạt động". It is reachable from the home card **only in development
builds** (`import.meta.env.DEV`; E2E and screenshots) until approved; released installers keep the
"Sắp có" card:

- **Talk layout:** large ring in the centre, label "Thầy/cô AI", captions below, minimal control bar.
- **Board layout:** ring shrinks to the top-left, whiteboard takes most of the area; 400–600 ms
  eased transition (instant with `prefers-reduced-motion`).
- Control bar: mic (hold to talk), "Giơ tay", pause/continue, speed, captions, quick chips
  (Giải thích lại · Chậm hơn · Thêm ví dụ · Đơn giản hơn · Em chưa hiểu chỗ này) — all disabled in the
  sketch. Thin lesson progress bar on top; transcript drawer closed by default.
- Start sheet (B4.1b): "Hôm nay muốn học gì?" + "Học trong bao lâu?" (15/30/45 phút).
- Main edition without a key: friendly invitation + button to "Kết nối AI" (no error text).
- Targets ≥ 44 px, works at 1366×768 and with touch.

## 8. Tests per phase (B11)

T1: parser fuzz, validator, provenance, normaliser, sync harness (fake clock). T2: layout
property tests (no overlap/overflow, min font), Vietnamese handwriting snapshots. T4: tool-backed
lessons without invented numbers for both providers (mocked in CI). T5: barge-in ≤ 200 ms,
latency budget, mic only with permission, no audio files written. T6: simulated-learner rubric,
safety suite 100 %. CI always uses recorded responses (no API cost).

## 9. Open questions for the user (T0 approval)

1. Voice services: Gemini (main) and **Azure AI Speech** (pilot) — `docs/VOICE_BENCHMARK.md` §4.
2. Azure token path (§6) and the CSP change it needs.
3. Teacher characters: 2–3 project-designed characters (names, voices, "thầy/cô – em" vs "mình – bạn").
   Proposal: one male ("thầy"), one female ("cô"), both original designs, chosen at first start.
4. The sketch is hidden in released installers until T1 works (proposal); screenshots are sent for review.
