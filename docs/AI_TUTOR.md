# Thầy AI and local Gemma

This fork adds a launch page (“Phòng thí nghiệm” / “Thầy AI”), an AI tutor page and a floating
chat bubble in the lab. The chat is text-based. It never takes screenshots or inspects other
applications.

> **Fork exceptions (user decision 2026-10-12).** `CLAUDE.md` / PROMPT_PHAN_2 forbid local AI and
> remote hosts in the production CSP. For this fork the user accepted two exceptions: Gemma runs
> locally inside the app (WebGPU), and the production CSP allows the HuggingFace model hosts and
> `vi`/`en.wikipedia.org`. The upstream repository is not changed. Ollama is no longer used.

## Navigation

- The app opens on the launch page with two entries: **Phòng thí nghiệm** (the existing topic
  browser and simulations) and **Thầy AI** (the full tutor page).
- The **STEM Sim Lab** brand in the top bar always returns to the launch page. Esc leaves the tutor
  page.
- The chat bubble is shown in the lab only (the launch page already has its own entry).
- The first-run tour explains the lab, so it starts the first time the learner opens the lab.

## Which engine answers

The chat has an engine selector (“API” or “Gemma cục bộ”). New installs pre-select Gemma, but a
pre-selected default never blocks anyone:

| Selected | Gemma model ready | Learner picked it | Who answers (chat **and** “Phân tích đề”)          |
| -------- | ----------------- | ----------------- | -------------------------------------------------- |
| API      | –                 | –                 | the provider from Settings → Kết nối AI            |
| Gemma    | yes               | –                 | Gemma on this computer                             |
| Gemma    | no                | no (default)      | the connected API (selector shows “API”)           |
| Gemma    | no                | yes               | nothing is sent; a notice opens Settings → Thầy AI |

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
short prompt (2 library excerpts of ≤ 700 characters, last 4 messages) and at most 384 new tokens:
small models lose the question under a long prompt and are slow per token. Settings → Thầy AI shows, per model: download (with live
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

## Knowledge library

The built-in library contains 66 short notes across upper-secondary Physics, Chemistry and Biology.
They are a starter reference, not a complete curriculum or a substitute for teacher-reviewed
materials. Learners can add UTF-8 `.txt`, `.md`, `.csv` and `.json` files in desktop (native dialog)
or browser mode (file picker): up to 120,000 characters per file, 20 files and 1.5 million characters
total; other formats and oversized files get a clear error. Personal files and chat history are kept
in this app's local storage on this computer. Relevant excerpts are selected with keyword matching.

Imported files are treated as reference data, never as instructions. The tutor names the sources it
used below its answer. AI answers can still be wrong; numerical simulation results continue to come
from STEM Sim Lab's deterministic engines.

**Wikipedia lookup is opt-in** (Settings → Thầy AI, off by default, main edition only): when on,
the question text is sent to `vi`/`en.wikipedia.org` to fetch one labelled excerpt. Earlier fork
versions queried Wikipedia on every question without telling the learner; v4 of the chat settings
turns it off for everyone.

## Where data goes

Settings → Thầy AI shows a live “Dữ liệu của em đi đâu?” box built from the current settings, and
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
Settings → Thầy AI → “Giọng nói của thầy” offers four styles, a voice picker and a preview. Asking a
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
