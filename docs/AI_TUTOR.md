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
in this app's local storage on this computer. Relevant excerpts are selected with keyword matching
(see "Teaching quality (2026-10-14)" below for how notes are ranked and when none is sent).

Imported files are treated as reference data, never as instructions. The tutor names the sources it
used below its answer. AI answers can still be wrong; numerical simulation results continue to come
from SimLab's deterministic engines.

**Wikipedia lookup is opt-in** (Settings → AI Teacher, off by default, main edition only): when on,
the question text is sent to `vi`/`en.wikipedia.org` to fetch one labelled excerpt. Earlier fork
versions queried Wikipedia on every question without telling the learner; v4 of the chat settings
turns it off for everyone. With Gemma, Wikipedia is asked only when the library has no note for the
question (the on-device prompt takes one note).

## Teaching quality (2026-10-14)

Changes made after the analysis of the Gemma 1B evaluation (keyFacts 29 % → 23 %: noise plus
rubric artefacts, but retrieval, prompts and invented numbers needed work). None of them needs a
model to be tested; no model was run to make them.

**Retrieval** (`knowledge.ts`: `rankKnowledge`, `searchKnowledge`, `bestSentences`).

- Text is split into syllables compared as whole words, tone mark apart ("hoá" = "hóa"), "y" = "i"
  after a consonant ("kỳ" = "kì"); a question typed without accents is compared folded. A few older
  names and abbreviations read as the notes write them ("ancol" = "alcohol", "NST" = "nhiễm sắc thể").
- Function words and question frames ("điều kiện", "đại lượng", "công thức") are not scored; short
  meaningful words are ("pH", "kì", "mã"). Syllable pairs are scored ("ma sát", "động năng"), and a
  syllable of a pair the notes know counts only where that pair is ("thời gian" ≠ "không gian").
- Terms weigh by rarity (idf); words in a note's title or first 8 words count double.
- No note is sent below a score of 3 or below 30 % coverage of the question's words (15 % for
  questions of 12+ words, which are mostly situation): no excerpt beats a distractor.
- Checked on a **held-out set**, `tests/teaching/retrieval-heldout.json` (57 learner-style questions
  written for it, none from the evaluation; `knowledge.test.ts`): rank 1 for 49/49 questions with a
  note (old scorer 38/49), nothing sent for 6/8 unrelated ones (old 0/8; the two left are "Định lý
  Pythagore…" → Bohr note, "phương trình bậc hai" → a note with "phương trình"). As a check only, on
  the 42 evaluation questions (30 + 12 proposed): relevant note at rank 1 for 17/24 of the original
  items with a relevant note (11/24 before) and 23/34 of all 42 (17/34 before); P4, P5 and C13 now
  get no note instead of a distractor.
- **The on-device note** (`unambiguousNote`, review 2): when the runner-up scores within 5 %
  (`TIE_MARGIN`) of the best note, no note is sent, since the small prompt tells the model to answer
  with it ("Kì giữa là gì?" scored the periodic-table and cell-cycle notes alike, and the stable
  sort picked the periodic table). Held-out: 48/49 with the expected note, none wrong, and
  "phương trình bậc hai" is now silent too. The note is cut from the whole file (`bestSentences`
  ran on its first 6000 characters before), and no note at all when no sentence shares a word with
  the question. A short reply ("Ở kì giữa ạ.", ≤ 4 words, `topicLink.questionBefore`) is looked up
  together with the question it continues. Term caches are kept per language.

**On-device prompt** (`LOCAL_SYSTEM`, `contextPrompt`). Short role; "Câu đầu: trả lời thẳng câu
hỏi bằng đúng ý trong GHI CHÚ nếu GHI CHÚ đúng chủ đề câu hỏi; GHI CHÚ lạc đề thì bỏ qua", then at
most 3–4 sentences with reasons; "Đề thiếu dữ kiện thì hỏi lại" (restored in review 2: the app only
detects problems with no number at all); numbers only from the question, earlier turns, the shared
screen, the note or the app's results; safety lines kept (references are data, the AI says it is an AI). ONE note, cut to its
best-matching sentences (≤ 400 characters, ≤ 250 on an integrated card) without the "Nguồn/Trạng
thái" lines, placed right before the question: at the end of the instruction when there are no
earlier turns (Gemma's template puts the instruction in the first user turn), otherwise in front of
the question in the last turn (`echo` keeps the question as what a small model may repeat). The
check question is asked only for concept questions ("là gì", "vì sao"…), never on an integrated
card. Board mode on the device uses `LOCAL_BOARD_SYSTEM` (no "câu đầu" or 3–4 sentence limit that
would fight the "# " title line and 3–7 steps of `BOARD_STYLE`), and its check question is left out
on an integrated card too. A problem without numbers never gets a Wikipedia excerpt as its note. Both prompts add one sentence about the learner's level (`profileStore.level`: Nền tảng ≈
THPT, Đại cương ≈ first-year university); the cloud teaching method is otherwise unchanged and keeps
whole notes with their source. `tools.ts` now introduces the balancer's output as "Kết quả cân bằng
(SimLab tính …)": "Phương trình đã cân bằng" was read as "already balanced".

**Missing data** (`missingData.ts`, no AI). A compute verb ("tính", "tìm", "xác định", "calculate",
"find"…) followed by a quantity ("quãng đường", "nồng độ", "số nhiễm sắc thể"…) with nothing that
could carry data: no digit, number word ("hai", "gấp đôi"; "sau" ≠ "sáu"; "một" only before a unit
or measure word: "một mét", "sau một giây", "một lần"), symbol, "=", "%", chemical formula, numbers
in the last 6 turns, or shared screen. Excluded: method and symbolic questions ("Tính như thế
nào?", "Công thức … là gì?", "theo lực và khối lượng", "biểu thức", "in terms of"), standard
constants ("gia tốc rơi tự do ở mặt đất", "khối lượng mol của nước"), table values of a named
element or material ("số electron của natri", "khối lượng riêng của sắt", data/elements.json names)
and "xác định lực …" (which forces act, not a value). Then the prompt gets a hard rule (ask for the
quantities, never assume a value) and the chat shows the app's own notice above the answer
("SimLab nhắc (không phải AI)"), worded as a possibility ("có thể còn thiếu số liệu"): the check
reads words, it does not understand the problem. Conservative on purpose: a problem that gives some
numbers but not enough (P11-style) is not detected; that would need the problem solved.

**Number provenance** (`provenance.ts`). Values in an answer — with a unit, after "=", "≈",
"khoảng", after "là"/"bằng"/"is"/"equals" at the end of a sentence, decimals, powers of ten, whole
numbers above 10 — that appear in none of the question, the learner's turns (number words too:
"hai giờ", "hai mươi lăm", "nửa", `numberWords.ts`), the app's results, the excerpt sent, the shared
screen or earlier answers' checked, unflagged numbers (1 % rounding allowed) are listed under the
answer in a box the app labels as its own ("SimLab kiểm tra (không phải AI)": "Số do AI tự đưa ra
(chưa kiểm chứng): …"). The record keeps the full list (`ChatMessageRecord.unverifiedNumbers`, set
even when empty); the chip shows six and "… và N số khác". An answer saved before the check existed
has no such field: it is checked again when used as history, so its numbers are never taken as
given unchecked. Only real tags are removed ("pH < 7 … ->" is text). List and step numbers, small
counts ("là 2 bước"), formula parts, exponents and 0 are ignored. Tested on 14 saved Gemma 1B
answers: "khoảng 50 km" (P5) is flagged; restated data ("Na=23g", "0.1 m", the learner's "23") is
not. "Unverified" is not "wrong": a correct textbook value the AI adds is listed too.

The board's ✓ (`board/provenance.ts`) answers a different question and is deliberately not shared
(review 2): it means the arithmetic on that line is right, not the formula. B5 (Gemma 1B wrote
"1 × 3³ = 27" for three mitoses, answer 2³ = 8) gets ✓ on the board and stays listed in the chat.
The board also counts standard values (9,8 / 10 / 60 / 1000…) and whole numbers 0–10 as given,
because it marks every number it writes; the chat lists a stated value with a unit even then (P5's
invented "60 km/h"). The chip's hint says that a ✓ calculation can still use a wrong formula.

**"Dừng".** While an answer is written the send button becomes "Dừng" (any open panel, through
`chatStore.stopAnswer`). Cloud: the transport's AbortSignal (desktop `ai_cancel`, browser fetch
abort). Gemma: a request still queued never starts; a running one gets a `stop` message and the
worker ends `generate` with `InterruptableStoppingCriteria` after the current token. An optional
Wikipedia lookup gets the same signal (`fetchWebKnowledge`), so nothing more is sent after "Dừng".
The chat is released at once (`AnswerStopped`), keeps the question, adds no answer and says "Đã
dừng câu trả lời…". A cloud request stopped while its key is looked up is never sent; on desktop a
stop that reaches Rust before `ai_chat` registers the request (`ai_cancel` → false) is sent again
every 50 ms while the call runs (up to 2 s). Known limit (Rust, not changed): `ai_chat` counts the
call against the daily cap before it registers it, so a call stopped in that window is still
counted. A second question cannot start while another panel is answering.

For `scripts/teaching/eval-gemma.mjs`: `contextPrompt` still returns the whole instruction in
`system` (note last), so items without history are sent as the app sends them; for follow-up items
the app moves `prompt.note` in front of the last question, which the script does not do yet.

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

### Natural teacher voice for the on-device MMS voice (2026-10-14)

The engine stays MMS-TTS (`Xenova/mms-tts-vie`, VITS). Text editing is separate from synthesis:

1. **Speech plan** (`src/teacher/voice/speechPlan.ts`, pure). `prepareSpeech(text, {role, emphasis})`
   removes what is not meant to be heard (`<think>` blocks, `<reference>` blocks, comments,
   TeachScript/HTML tags even with `>` inside an attribute, horizontal rules, emoji), applies the
   **pronunciation dictionary** (`pronunciations.json`: term, reading, subject, `review_status`;
   applied before the rule-based reader so an entry wins; never inside `$…$`, LaTeX or code, never
   next to an operator or an arrow; a reading is words only — no digit, unit symbol or formula,
   all 42 entries wait for a teacher, DATA_REVIEW PRON-1), reads the text with `toSpeech`, and cuts
   it into chunks: paragraph > sentence > `;`/`:` > `,`; a piece of one word joins its neighbour;
   a piece over 100 characters is cut between words, before a conjunction if possible, at least 3
   words on each side; the first chunk is cut at a conjunction past 64 characters (the first
   sound comes sooner). A cut never falls inside a number with its sign, power of ten and unit
   ("6,626.10⁻³⁴ J.s", "−3,2 °C", "0,1 M"), a `$…$` formula, an equation, a dictionary reading or a
   name: the written spans are marked and carried through the reader, so their spoken words are
   known exactly (a span whose marks change the reading is read on its own in the whole text's
   context and looked up instead), and a cut never falls between a number word and a sign
   ("trừ", "âm", "cộng"), another number word or a unit word. Chemistry and solutions ("0,2 M" =
   mol per litre) are told from the text as written, before the dictionary. The chunks are the
   prepared text word for word (tested on the 40 golden and 19 benchmark sentences).
2. **Pauses after a chunk** (`PAUSE_MS`): phrase cut without punctuation 80 ms · before a key term
   120 · comma 150 · `;`/`:` 280 · sentence 400 · paragraph or list item 560 · last chunk 0 (the
   board adds its own pause between sentences).
3. **Roles and prosody** (`ROLE_PROSODY`). The board passes the sentence's role and key terms
   (`voiceCue` in `lesson.ts`); otherwise a classifier reads the words. A role from the board wins
   for a heading or a result; a question or feedback heard in the words wins over step, note and
   plain.

   | Role       | Where it comes from                                                                 | Rate | noise_scale | noise_scale_duration |
   | ---------- | ----------------------------------------------------------------------------------- | ---- | ----------- | -------------------- |
   | `plain`    | anything else                                                                       | 1.00 | 0.667       | 0.80                 |
   | `step`     | board: a write in the `steps` zone; words: "Bước…", "Đầu tiên…", "một, …"           | 1.00 | 0.667       | 0.80                 |
   | `note`     | board: only side notes                                                              | 1.03 | 0.667       | 0.80                 |
   | `heading`  | board: a heading write                                                              | 0.94 | 0.60        | 0.75                 |
   | `concept`  | words: "… được gọi là …", "là gì", "khái niệm", "định nghĩa"                        | 0.92 | 0.60        | 0.75                 |
   | `result`   | board: a result write; words: "Vậy…", "Kết quả…", "Đáp số…"                         | 0.90 | 0.60        | 0.70                 |
   | `keyword`  | the chunk that starts with a key term (board keyword, marked word, `**bold**` term) | 0.90 | 0.60        | 0.70                 |
   | `check`    | words: the sentence ends with "?"                                                   | 0.96 | 0.70        | 0.85                 |
   | `feedback` | words: "Đúng rồi", "Chưa đúng", "Rất tốt", "Không sao"… (correction, encouragement) | 0.94 | 0.72        | 0.85                 |

   Emphasis is a short pause before the key term and a slower pace for its chunk — never a louder
   voice. A bold label at the start of a line ("**Bước 1:**") is not a key term.

4. **What MMS supports (the limit).** Hugging Face's VITS reads `speaking_rate`, `noise_scale` and
   `noise_scale_duration` from its config inside `forward()`. Transformers.js 4.3 `VitsModel` feeds
   the ONNX graph only the inputs it names (`session.inputNames`), and Optimum's VITS export (the
   one behind `Xenova/mms-tts-*`) declares `input_ids` and `attention_mask` only, so the three
   values are fixed in the graph (1, 0.667, 0.8). Not checked on the stored file itself (that
   needs the model; the worker reads `session.inputNames` at load and adapts). The worker
   (`localVoiceWorker.ts`, `vitsControls.ts`) passes a value only when the graph names it, clamped
   to 0.85–1.15 / 0.5–0.8 / 0.6–1.0, and reports which it applied; a graph that refuses a value is
   run without it from then on. With the expected graph nothing is applied, so the noise columns
   above are not heard (VITS still samples its own variation at the fixed scales) and the role's
   pace is applied on the page by a pitch-keeping time stretch (WSOLA). The learner's speed (and
   the board's) stays the playback rate, the same for every chunk.
5. **Stitching** (`stitch.ts`, pure, Float32Array): every chunk at 16 kHz; its own silence trimmed
   (frames 40 dB below its loudest, 30 ms margin kept); one gain per chunk so its voiced RMS is
   −20 dBFS, lowered if the peak would pass −1 dBFS (no clipping, no compressor, at most ±18 dB);
   raised-cosine fades of 8 ms in and 12 ms out (no clicks); then the planned pause as silence.
6. **Streaming, order, stop** (`chunkPlayer.ts`, `naturalVoice.ts`, `speak.ts`). Chunk n+1 renders
   while chunk n plays (a look-ahead of one, never more); playback is in strict order. Every stop
   moves a generation number on: a speech that is no longer the current one never plays another
   chunk, even if its render finishes later (a new lesson, the learner leaving); `playPcm` also
   never starts a sound stopped while the browser resumed audio. A pause stops the voice and the
   board reads the sentence again on "Tiếp tục"; the lesson's `VoiceSession` keeps up to 48
   rendered chunks, so the re-read starts at once. The board still calls `speak()` once per
   sentence, so speech and board stay in sync. The Windows and Gemini voices keep their
   sentence-sized phrases (they now get the dictionary too); after an on-device failure the
   Windows voice goes on from the first chunk not yet heard.
7. **Benchmark** (`scripts/voice/tts-bench.mjs`, not yet run). Renders `ttsBenchSet.json` (19
   sentences: greeting, transition, new concepts, check questions, correction and encouragement, a
   long paragraph, formulas, units and numbers, names, mitosis, chemical equations, a heading, a
   result, a note) as `legacy` (20b19c2: comma pieces, 140/260/320/520 ms timer pauses, raw audio)
   and `natural`, on the CPU only (Edge with GPU and WebGPU off, `wasm` asserted, model hosts
   blocked: the voice must already be stored). It records first-audio latency, synthesis time,
   real-time factor, duration, syllables per second, chunk loudness spread and peak, the longest
   gap and gaps over 600 ms, clipping, NaN, words dropped or reordered, and the Edge process
   tree's CPU time and peak memory; it writes WAVs, a blind A/B sheet (`index.html`, four 1–5
   ratings per recording) and the A/B key in `key/ab-key.json`.

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

## Audit 2026-10-13: safety and quality changes

See `docs/AUDIT_2026-10-13.md` for the evidence (benchmarks, evaluation, the GPU crash).

- **GPU safety (GPU-01, `src/ai/gpuSafety.ts`).** Gemma 1B on an integrated AMD Radeon 780M made the
  driver time out repeatedly and Windows stopped with bugcheck 0x119. After one GPU fault (lost
  device, crashed worker, ONNX Runtime buffer errors) Gemma is not loaded again in that session; the
  fault is stored (`stemsim.gemma-gpu-fault`) and shown in Settings → GPU cho Gemma with "Dùng card
  rời" / "Vẫn cho Gemma chạy lại". On an integrated card (`gemmaOnIntegrated`) the prompt is capped
  at 1024 tokens and uses the "tight" context. Never benchmark Gemma on an integrated GPU;
  `scripts/teaching/eval-gemma.mjs` refuses anything but a discrete NVIDIA adapter.
- **Stalled answers (`src/ai/stallWatch.ts`).** No first piece in 120 s or no new piece in 45 s ends
  the answer with `gemma-stalled` and a fresh worker; the worker also reports a lost WebGPU device.
  Each failure has its own learner sentence (`gemmaErrorKey`), and none of them goes online.
- **Pinned models.** Every Gemma model and the MMS voice download one pinned `revision` (commit).
  Stored files are kept per repo without the revision, so moving the pin needs no re-download.
- **Prompts.** Untrusted excerpts (library, imported files, Wikipedia) go in `<reference kind=…>`
  blocks they cannot close; on-device prompts used 2 excerpts × 700 characters (`PromptSize`; since
  2026-10-14 one note of ≤ 400 characters, see "Teaching quality"). The
  cloud prompt states the teaching method (goal → ask for missing data → explain → example → steps
  with reasons → one misconception → ONE check question → feedback that adapts).
- **App-computed facts (`src/teacher/chat/tools.ts`).** Chemical equations in a question are solved
  by `src/chemistry/balance.ts`; the result goes into the prompt ("KẾT QUẢ DO SIMLAB TÍNH") and is
  shown by the app under the answer (`ChatMessageRecord.facts`), because a small model garbles it.
  A question is read only when it asks to balance ("cân bằng", "balance") or names a reaction
  ("phản ứng", "PTHH", "reaction") next to an arrow; every species must parse as a formula; units
  ("10N", "220V") are never formulas; "cannot balance" is said only to an explicit balancing
  request written with an arrow (with "=", the line may be physics: only a real balance counts).
- **Board speech.** `Sentence.spoken` reads written words where their tag stands; a pause re-reads
  the cut sentence; `lessonMetrics()` keeps per-sentence timing in memory.
- **Simulation link (`topicLink.ts`).** "Xem mô phỏng: …" follows the learner's latest question only
  (a short follow-up or a quick button keeps the topic of the question before it). Catalog text
  match, never chosen by the AI; words typed with accents are compared with accents (tone position
  "hoá"/"hóa" does not matter), words typed without accents are compared folded.
- **Evaluation.** `tests/teaching/teaching-eval.json` (30 questions) + `scripts/teaching/rubric.mjs`
  (objective checks only); `scripts/teaching/rescore.mjs` re-scores a saved run without a browser or
  GPU. Gemma 1B, old → new prompt, re-scored on 2026-10-14 with the corrected rubric on the same 60
  saved answers: last sentence is a check question 4 % → 42 %, asks for missing data 0 % → 0 % (it
  invents numbers instead), first word 1.59 → 0.86 s (median 1.39 → 0.83 s), key facts 29 % → 23 %;
  with the new prompt it still answers "Đúng!" to wrong answers (P6, P10, B10). The model, not the
  prompt, is the limit. The first scoring (8 % → 54 %, 0 % → 33 %) counted any "?" near the end and
  answers that invented the missing numbers.
