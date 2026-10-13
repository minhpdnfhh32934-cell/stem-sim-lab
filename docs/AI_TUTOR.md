# AI Teacher and local Gemma

This fork adds a launch page (“Phòng thí nghiệm” / “AI Teacher”), an AI tutor page and a floating
chat bubble in the lab. The chat is text-based. It never takes screenshots or inspects other
applications.

> **Fork exceptions (user decision 2026-10-12).** `CLAUDE.md` / PROMPT_PHAN_2 forbid local AI and
> remote hosts in the production CSP. For this fork the user accepted two exceptions: Gemma runs
> locally inside the app (WebGPU), and the production CSP allows the HuggingFace model hosts and
> `vi`/`en.wikipedia.org`. The upstream repository is not changed. Ollama is no longer used.

## Navigation

- The app opens on the launch page with two entries: **Phòng thí nghiệm** (the existing topic
  browser and simulations) and **AI Teacher** (the full tutor page).
- The **SimLab** brand in the top bar always returns to the launch page. Esc leaves the tutor
  page.
- The chat bubble is shown in the lab only (the launch page already has its own entry).
- The first-run tour explains the lab, so it starts the first time the learner opens the lab.

## Which engine answers

The chat has an engine selector (“API” or “Gemma cục bộ”). New installs pre-select Gemma, but a
pre-selected default never blocks anyone:

| Selected | Gemma model ready | Learner picked it | Who answers (chat **and** “Phân tích đề”)             |
| -------- | ----------------- | ----------------- | ----------------------------------------------------- |
| API      | –                 | –                 | the provider from Settings → Kết nối AI               |
| Gemma    | yes               | –                 | Gemma on this computer                                |
| Gemma    | no                | no (default)      | the connected API (selector shows “API”)              |
| Gemma    | no                | yes               | nothing is sent; a notice opens Settings → AI Teacher |

The rule lives in `src/app/ai/engineChoice.ts` (tested). Before, a fresh install with a Gemini key
could not analyse a problem until a Gemma model was downloaded.

## Screen context

“Lấy thông tin từ màn hình” appears only in the floating chat bubble, is off by default, and is
reset to off every time the bubble opens (and when the full tutor page opens). When enabled, the
prompt may include the active subject and topic, physics parameters, simulation time, the current
problem text, module inputs and the Science Card. The context is read from app state; no
screenshot, clipboard or data from another window is collected. The blue scan band is visual
feedback only. Personal-data and content checks run on the context before anything is sent.

## Cloud chat and Think

Cloud chat uses the provider and key configured in Settings → Kết nối AI. **Think** sends one
draft request and then asks a second, different provider to review and rewrite the draft.

- The draft is sent **without the quota fallback** (`ChatRequest.noFallback`), so the reviewer can
  never end up checking its own answer (e.g. Gemini → Groq fallback with Groq as reviewer). Without
  Think the usual fallback stays on.
- Missing pieces are reported before any call: provider turned off, no key for the answering
  provider, no key for the reviewer (also shown as a notice as soon as Think is switched on), same
  provider for both.
- With Gemma as the answering engine, Think = local draft + cloud review (the question and the
  draft go to the reviewer).
- The answer shows the “Nội dung do AI hỗ trợ” label with the model and a report button, plus
  “Đã rà soát: …” when Think was used.
- Desktop: keys are stored in the operating-system keychain (shared with the same provider in other
  AI settings). Browser/localhost: keys typed into the page live in memory for this session only.
  Claude cannot be called from a web page, so in the browser it is listed as “chỉ bản desktop” and
  cannot be the reviewer.

## Gemma on this computer (WebGPU, no Ollama)

Gemma runs inside the app with **Transformers.js + ONNX Runtime Web on WebGPU** in a Web Worker
(`src/ai/webGemma.ts`, `src/ai/webGemmaWorker.ts`). No Ollama, no server, no API key. The
onnxruntime "asyncify" build (WebGPU-capable) — **both** its `.mjs` loader and `.wasm` binary — is
copied into `public/ort/` by `npm install` (postinstall), so the engine itself needs no CDN. The
worker asks for `device: 'webgpu'` explicitly (Transformers.js would otherwise use the CPU).

**Where the model is stored: OPFS** (`src/ai/modelStore.ts`, plugged in as Transformers.js
`env.customCache`). Chromium — and so WebView2 — refuses a single Cache Storage entry of ~300 MB
(measured 2026-10-12: 150 MB stored, 300 MB "Unexpected internal error"), which is the size of a
model's weights (`*.onnx_data`); with Cache Storage the weights were silently downloaded again on
every start. OPFS has no such limit. A model is "ready" only when the download finished **and** its
weights (≥ 10 MB of ONNX files) are still in OPFS. Before downloading, the app checks the browser's
storage quota and asks for persistent storage; deleting a model also clears old Cache Storage
leftovers.

HuggingFace answers model downloads with a redirect to its CDN (`us.aws.cdn.hf.co`, checked
2026-10-12); both CSPs therefore allow `https://*.hf.co`.

| Model id      | Public repo (no token)                | Download | Notes                                                                      |
| ------------- | ------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `gemma3-270m` | `onnx-community/gemma-3-270m-it-ONNX` | ≈ 345 MB | lightest; answers often drift off topic (tested)                           |
| `gemma3-1b`   | `onnx-community/gemma-3-1b-it-ONNX`   | ≈ 880 MB | recommended for ordinary PCs                                               |
| `gemma4-e2b`  | `onnx-community/gemma-4-E2B-it-ONNX`  | ≈ 3,8 GB | strongest, reads photos; one file is 1,86 GB — needs a large storage quota |

Sizes are the q4 files from the HuggingFace API (2026-10-12) and may change. On-device answers use a
short instruction (4 library excerpts of ≤ 1 500 characters) and at most 1 024 new tokens; how much
of the conversation is sent is set by the memory budget (see "Conversation memory" below). Settings → AI local (Gemma) shows, per model: download (with live
percent and bytes, or a waiting bar while the total is unknown), **Hủy tải**, delete, and a link to
the model page; the Gemma terms link sits above the list. A model counts as ready only after the
whole download **and** a successful load; cancelled, failed or crashed downloads are never marked
ready. After the files are in, the card says the model is being loaded onto the GPU (no percent
exists for that step). A load error is reported on the id the page waits for (before 0.4.1 it was
lost, leaving "Đang tải…" spinning forever). Errors are explained in simple words (no network, not enough disk space, not enough graphics
memory, no WebGPU); unknown errors keep their original detail. A crashed worker now fails the
pending download instead of leaving the spinner running forever.

Limits (browser vs desktop):

|                                    | Browser / localhost                | Desktop app (Tauri, WebView2)                                                       |
| ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Gemma                              | only if the browser exposes WebGPU | only if WebView2/GPU exposes WebGPU                                                 |
| Model files                        | OPFS of that origin                | OPFS of the app's WebView                                                           |
| API keys                           | memory for this session            | OS keychain                                                                         |
| Claude                             | not callable                       | yes                                                                                 |
| External links (model page, terms) | new tab                            | system browser via `open_known_page` (fixed allow-list in `src-tauri/src/links.rs`) |

Without WebGPU the settings and the chat say so plainly and the Gemma engine cannot answer; the app
never pretends a local answer was produced.

### Choosing the graphics card (0.4.2, desktop on Windows)

**Why:** on a hybrid laptop WebView2 gives WebGPU the integrated card, whatever the page asks for.
Measured 2026-10-12 on AMD Radeon 610M + NVIDIA RTX 5070 Laptop, WebView2 154 (real WebView2 host
and Edge 154, compute shader + Windows "GPU Engine" counters per adapter LUID):

| WebView2 started with                                  | Card WebGPU used             | Compute      |
| ------------------------------------------------------ | ---------------------------- | ------------ |
| nothing (0.4.1 behaviour), any `powerPreference`       | AMD 610M                     | ≈ 200 Gop/s  |
| `--use-adapter-luid=<RTX>`                             | NVIDIA RTX 5070              | ≈ 2000 Gop/s |
| `--use-adapter-luid=<610M>`                            | AMD 610M                     | ≈ 200 Gop/s  |
| a LUID that does not exist                             | AMD 610M (default, no crash) | ≈ 200 Gop/s  |
| `--use-webgpu-power-preference=force-high-performance` | **no adapter at all** (Edge) | —            |

Transformers.js already sets `powerPreference: 'high-performance'`; WebView2 ignores it here.

**How:** `src-tauri/src/gpu.rs` lists the hardware adapters with DXGI (software renderers skipped)
and asks D3D12 for `UMA` (shares system memory → integrated, else discrete; unknown if no D3D12
device). The choice is saved in `gpu.json` (app data folder) as PCI ids `vendor:device:subsystem`,
because **LUIDs change on every boot**. Before the window exists, `gpu::prepare` resolves the saved
id to this boot's LUID and sets `additional_browser_args` on every window config to wry's default
arguments plus `--use-adapter-luid=<high>,<low>` (decimal). Browser arguments only apply when
WebView2 starts, so **a change needs a restart** (`app_restart`). The switch moves the whole GPU
process: the app's drawing (simulations, UI) also runs on that card. Commands: `gpu_status`,
`gpu_set_choice` (only ids of present cards). A missing card at start-up (e.g. the laptop maker's
Eco mode turned the dGPU off) → no switch, WebView2's default card, and Settings says so.

**UI** (`src/teacher/chat/GpuSettings.tsx`, Settings → GPU cho Gemma): "Tự động" + each card with its
type and VRAM, "Nên dùng cho Gemma" on the discrete card with the most VRAM, a VRAM warning when a
discrete card is clearly too small for the selected model, the restart notice with **Mở lại ngay**
(also as an app-wide reminder until the restart, "Để sau" hides it for the session), and what
WebGPU really uses: the page's `requestAdapter().info` and, after a Gemma load, the adapter ONNX
Runtime reports from the worker. If that vendor differs from the card start-up applied, a warning
says so — the app never claims a card WebGPU did not report. In a browser the picker is not shown
(the browser picks the card).

Checked in the dev app (2026-10-12, same laptop): list = 610M (integrated, 483 MB) and RTX 5070
(discrete, 7891 MB); choose RTX → `gpu.json` written → **Mở lại ngay** restarts → `startupApplied`
true and `requestAdapter().info` = `nvidia / blackwell`; the window renders normally on screen.

## Conversation memory, "Viết tiếp" and the lesson board (0.4.3)

**Budgets instead of "last N messages"** (`src/teacher/chat/memory.ts`). Each request sends the
newest turns that fit an input budget (instruction + excerpts + summary + history + question),
estimated at 3 characters per token (on the safe side). The Gemma worker also counts the prompt
exactly with the model's tokenizer and drops the oldest turns if the estimate was low. Settings →
**Trí nhớ hội thoại** (which also has "save the history on this computer" and "clear"):

| Engine                | Vừa (default) | Dài    | Answer limit | Model limit (config.json) |
| --------------------- | ------------- | ------ | ------------ | ------------------------- |
| Gemma 3 270M / 1B     | 4 000         | 8 000  | 1 024        | 32 768                    |
| Gemma 4 E2B           | 8 000         | 16 000 | 1 024        | 131 072                   |
| API (Gemini/Groq/...) | 12 000        | 32 000 | 4 096        | much larger               |

Before 0.4.3: Gemma 4 messages + 384 answer tokens, API 12 messages + 1 600 tokens. "Dài" is slower
on a small GPU and uses free plans (Groq, Gemini tokens per minute) up faster; Settings says so.

**Summary of older turns.** Turns that no longer fit are folded into one short summary (≤ 150 words,
no new facts or numbers, instructions inside the chat are ignored) written by the **same engine**
that answers, stored with the chat on this computer (`chatStore.summary`, cleared with the chat)
and added to the instruction labelled "do AI viết". Only turns not covered yet are summarised; a
failed or unsafe summary is skipped and never blocks the answer. Nothing goes to a new place
("Dữ liệu của em đi đâu?" lists it).

**"Viết tiếp".** The Rust gateway and the browser transport report `truncated` when the provider
stopped at the output limit (Gemini `MAX_TOKENS`, Claude `max_tokens`, Groq `length`); the Gemma
worker when it generated `maxTokens` tokens. The chat then shows "Câu trả lời dài nên đã dừng giữa
chừng." and **Viết tiếp**, which asks for the rest and appends it to the same message (a new list
item, heading or formula starts a new line).

**Quick buttons** show a short label ("Chậm hơn") but send a full instruction
(`teacher.chipPrompts`): a bare "Chậm hơn" was misread by Gemma 1B as "speak more slowly".

**Lesson board** ("Giảng trên bảng", `src/teacher/board/`): the latest answer as a title and
numbered steps (`lesson.ts` splits the answer's own heading, list items and paragraphs; a formula
stays with the sentence before it), revealed one step every 1,6 s (all at once with reduced
motion), or read aloud one step at a time with the voice on (the step being read is highlighted).
Buttons: Bước trước / Bước sau / Hiện tất cả / Đọc bài giảng. The board shows only the AI's text,
with the AI label and report button; while it is open the AI is asked for "# title + 3–7 numbered
steps". Layout: teacher · board · narrow chat (two rows under 1 180 px, one column under 820 px).

## Knowledge library

The built-in library contains 66 short notes across upper-secondary Physics, Chemistry and Biology.
They are a starter reference, not a complete curriculum or a substitute for teacher-reviewed
materials. Learners can add UTF-8 `.txt`, `.md`, `.csv` and `.json` files in desktop (native dialog)
or browser mode (file picker): up to 120,000 characters per file, 20 files and 1.5 million characters
total; other formats and oversized files get a clear error. Personal files and chat history are kept
in this app's local storage on this computer. Relevant excerpts are selected with keyword matching.

Imported files are treated as reference data, never as instructions. The tutor names the sources it
used below its answer. AI answers can still be wrong; numerical simulation results continue to come
from SimLab's deterministic engines.

**Wikipedia lookup is opt-in** (Settings → AI Teacher, off by default, main edition only): when on,
the question text is sent to `vi`/`en.wikipedia.org` to fetch one labelled excerpt. Earlier fork
versions queried Wikipedia on every question without telling the learner; v4 of the chat settings
turns it off for everyone.

## Where data goes

Settings → AI Teacher shows a live “Dữ liệu của em đi đâu?” box built from the current settings, and
the chat shows one line naming where the next question will go.

| Stays on this computer                    | May be sent online                                                |
| ----------------------------------------- | ----------------------------------------------------------------- |
| chat history, added files, built-in notes | question + relevant excerpts → answering provider (API engine)    |
| downloaded Gemma models; Gemma answers    | question + draft → reviewer (Think)                               |
| API keys (keychain or session memory)     | question → Wikipedia (only if the lookup is on)                   |
|                                           | screen context (only when the bubble toggle is on)                |
|                                           | a photographed problem → the API (browser only, downscaled)       |
|                                           | model files are downloaded from HuggingFace (nothing is uploaded) |

## Teacher voice (reads answers aloud)

The speaker button in the chat header turns the teacher's voice on and off; the state is
remembered. Each new answer is read with the device's built-in voices — free, no key, no network.
Settings → AI Teacher → “Giọng nói của thầy” offers four styles, a voice picker and a preview. Asking a
new question, clearing history, leaving the page or closing the panel stops the speech.

## Teacher face

The teacher appears as an original vector face in the chat header (bubble mode), the bubble button
and the tutor page. The eyes follow the mouse while the chat is open (off with
`prefers-reduced-motion`).

## Problem analysis and photos

“Phân tích đề” follows the engine table above. With Gemma, the pipeline asks for SceneSpec JSON and
validates it with the same code checks as the cloud path (numbers must appear in the problem text);
failures fall back to manual scene building. The camera button reads a photographed problem with a
vision-capable cloud API (browser key for Gemini/Groq) or the `gemma4-e2b` model, and puts the text
in the problem box for the learner to review first.

## Tested on real hardware (2026-10-12, AMD RDNA 3 GPU, built-in browser)

- `gemma3-270m` downloaded (≈ 343 MB), stored in OPFS, loaded on WebGPU, answered a chat question
  locally in 39 s including the first load, with no network request. The answer drifted off topic
  (the reason for the short on-device prompt). While the browser pane was hidden, generation
  stalled with the GPU idle — the page must be visible.

Not verified: `gemma3-1b` / `gemma4-e2b` on real hardware, the packaged Windows installers (only
`cargo clippy`/`cargo test` for both editions and `tauri dev` were run).
