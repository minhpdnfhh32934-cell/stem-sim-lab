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

The chat has an engine selector (“API”, “Gemma cục bộ” or “AI trên máy khác”). New installs
pre-select Gemma, but a pre-selected default never blocks anyone:

| Selected         | Gemma model ready | Runtime + model picked  | Learner picked it | Who answers (chat, “Phân tích đề” **and** “AI diễn giải”)    |
| ---------------- | ----------------- | ----------------------- | ----------------- | ------------------------------------------------------------ |
| API              | –                 | –                       | –                 | the provider from Settings → Kết nối AI                      |
| Gemma            | yes               | –                       | –                 | Gemma on this computer                                       |
| Gemma            | no                | –                       | no (default)      | the connected API (selector shows “API”)                     |
| Gemma            | no                | –                       | yes               | nothing is sent; a notice opens Settings → AI local          |
| AI trên máy khác | –                 | yes                     | always            | the runtime on this computer (Ollama, LM Studio, llama.cpp…) |
| AI trên máy khác | –                 | no (or address dropped) | always            | nothing is sent; a notice opens Settings → AI trên máy khác  |

The rule lives in `src/app/ai/engineChoice.ts` (tested). Before, a fresh install with a Gemini key
could not analyse a problem until a Gemma model was downloaded. “AI trên máy khác” is only ever
the learner's own choice (`setEngine`) and never becomes the API: a runtime that does not answer is
reported as such when the learner asks.

## Screen context

“Lấy thông tin từ màn hình” appears only in the floating chat bubble, is off by default, and is
reset to off every time the bubble opens (and when the full tutor page opens). When enabled, the
prompt may include the active subject and topic, physics parameters, simulation time, the current
problem text, module inputs and the Science Card. The context is read from app state; no
screenshot, clipboard or data from another window is collected. The blue scan band is visual
feedback only. Personal-data and content checks run on the context before anything is sent.

**“Hỏi thầy về bộ phận này” (3D mitosis, item 2 outside the board).** The part card of the 3D
mitosis view (`Mitosis3DView.tsx` `PartInfo`, shown after a tap or a pick in “Bộ phận tế bào”)
has a “Hỏi thầy” button. It opens AI Teacher the usual way (`openTeacherWithQuestion` →
`openTeacher`: talk layout, screen context off) with a question written into the box from the
module's own texts only: the part's name (`COMPONENTS`), the stage (`STAGE3D_NAME`) and the cell
type (`teacher.askMitosisPartQuestion`). Nothing is sent until the learner presses send, and the
learner may change the question first; it then goes like any typed question (`checkInput`,
moderation, labels), with no picture and no screen data. The teacher page's chat takes the
question once (`useTeacherStore.draft`, cleared when taken or when the page closes).

## Cloud chat and Think

Cloud chat uses the provider and key configured in Settings → Kết nối AI. **Think** sends one
draft request and then asks a second, different provider to review and rewrite the draft.

- With Think **every call is sent without the quota fallback** (`ChatRequest.noFallback`): the
  draft, the summary of older turns and the review. The reviewer can never end up checking its own
  answer (e.g. Gemini → Groq fallback with Groq as reviewer, or a reviewer whose fallback is the
  drafter), and nothing goes to a third provider. A reviewer out of quota is reported
  ("Bên rà soát (Groq) báo đã hết lượt dùng…"), never replaced. “Viết tiếp” is sent the same way
  (the rest of the answer and the summary sent before it; `askTeacher({ noFallback })`) while Think
  is on or when the answer it continues was reviewed. Without Think the usual fallback stays on.
- Missing pieces are reported before any call: provider turned off, no key for the answering
  provider, no key for the reviewer (also shown as a notice as soon as Think is switched on), same
  provider for both.
- With Gemma as the answering engine, Think = local draft + cloud review. The reviewer gets the
  question, the draft, the related note, the summary of older turns (if any) and the screen
  context (if on); Settings → AI Teacher says exactly that.
- The answer shows the “Nội dung do AI hỗ trợ” label with the model and a report button, plus
  “Đã rà soát: <provider> · <model>” when Think was used (the provider that really reviewed,
  from the response). An answer written by the quota fallback is labelled with the provider that
  wrote it and “dự phòng” (“mô hình Groq · qwen/… · dự phòng”), in the chat and on the board.
  “Viết tiếp” of a reviewed answer is written without a review: the message then says “Phần viết
  tiếp chưa được rà soát.”; if another model wrote the rest, both are named (“a + b”).
- **Failures in the learner's words** (`src/teacher/chat/cloudErrors.ts`): every error of an
  online call is mapped with `aiErrorKind` to one study-partner sentence `chat.errors.cloud.*`
  (timeout, stalled, network, quota, badKey, badModel, dailyLimit, missingKey, notAllowed,
  emptyAnswer, reasoningOnly, tooLarge, server, other; a provider filter stop gives
  `chat.errors.filtered`). It names who failed (the provider, “Bên rà soát (…)” for the reviewer,
  or “Gemini (hoặc Groq dự phòng)” when the fallback may have been asked as well) and the Settings
  page to open, with a button. A streamed answer that stalls between two pieces (`gap: …`) or runs
  past the overall cap (`overall: …`) gets `stalled`, without that advice: those limits are fixed
  and the wait in Settings → Kết nối AI covers only the first text and whole answers. Only a real
  network failure is called one (`toAiError`: Rust's `{code: 'network'}` or `fetch`'s TypeError);
  a plain string or Error from the desktop bridge (“Command ai_chat not found”, wrong arguments) or
  a programming error is `internal` and gets the `other` sentence, never “check your Internet”.
  No status code, JSON, key name or raw provider text reaches the learner; the console gets
  `[teacher-cloud] <role> <provider> <kind> <code>` only. “Dừng” stays a stop. “Hỏi lại” is
  offered where asking again may help, and it is the learner's click: the page never re-sends a
  question by itself (the Rust gateway retries 429/5xx at most 3 times; the quota fallback is
  asked once, only for a quota or credit error).
- **Streaming** (`cloudChat`): a question streams through `transport.chatStream` when the
  transport has it (desktop: `ai_chat_stream`; browser: SSE) and the chat shows it as it is
  written; never Think's draft or review, a summary, or a JSON reading. The shown text is
  provisional and goes through the same wrapper as Gemma's (each piece passes `outputIsSafe`, an
  unsafe piece takes everything back, unfinished reasoning is hidden, a reset replaces the text);
  the final answer is cleaned and checked whole, and only the completed answer is stored, read
  aloud or taught on the board. In the board layout the lesson being written (TeachScript) shows
  as readable text, the subtitles of its sentences so far (`boardStreamPreview` in
  `src/teacher/board/lesson.ts`): never a tag, an attribute or LaTeX, and a `<write>` still being
  written stays out until it is whole. A lesson asked in TeachScript (a cloud board lesson) reads
  so from its first word, before any tag has come, so a formula in its first sentence never shows
  as LaTeX; a decimal comma written `9{,}8` stays the number 9,8 inside a root or a fraction, and
  a fraction of sums keeps its brackets (`(s₁ + s₂)/t`). A stream that breaks off leaves nothing
  behind: the partial text goes and the failure sentence is shown (for a broken connection “{who}
  chưa trả lời được vì kết nối mạng bị gián đoạn”, true whether or not the question reached the
  provider). A desktop app older than the web part (no `ai_chat_stream`: “Command … not found” /
  “unknown command”) answers through `ai_chat`, and the missing command is remembered for the
  session (one failed lookup, not one per question).
- Only learning content is kept (`src/teacher/chat/answerClean.ts`, run in `askTeacher` before
  the answer is stored, spoken, drawn or checked for numbers): hidden reasoning (`<think>`…,
  also unclosed or orphan; the streaming preview hides it while it is written), echoed
  `<reference>` blocks, HTML comments, lines that only repeat a prompt label (“GHI CHÚ”, “KẾT QUẢ
  DO SIMLAB TÍNH”…, `promptLabels.ts`) and, for a Think answer, the reviewer’s notes about the
  draft (“Nhận xét về bản nháp…”, “Bản đã sửa:”). The reviewer gets the cleaned draft. The safety
  filter checks the text as received and the cleaned text; an answer with nothing left shows
  `chat.errors.noAnswer`. The board and the chat copy clean answers saved by older versions
  too (`lesson.scriptFor`, `boardAnswerText`). Nothing is rewritten and no number is changed.
- The reviewer’s notes are removed sentence by sentence from the start, never by whole
  paragraph: the scan stops at the first sentence or line that is not about the draft (a
  TeachScript sentence, a heading, a lesson line), so a lesson that shares its paragraph with a
  remark is kept. A remark names the draft with a verdict (“Bản nháp đúng.”, “The draft is
  correct.”; “Bản nháp báo cáo…” or “the draft of a ship” without a verdict is lesson text), the
  answer under review (“Bản trả lời ban đầu đã đúng.”, “The original answer is correct.”), or
  opens with a reviewer’s label (“Rà soát:”, or “Review:”/“Đánh giá:”/“Nhận xét:” followed by a
  verdict on “câu trả lời”/“the answer” or by a bare verdict such as “Đúng.”). A remark that
  holds a number, a formula, a tag or code, or that goes on with more than 6 words after
  “nhưng”/“rằng”/“but”/“that” (it may state a fact), stays unless a revision header (“Bản đã
  sửa:”, “Revised answer:”, alone on its line or closed by “:”) follows it; then only what
  follows the header is kept (up to 4 sentences without lesson structure between the first
  remark and that header go too). Before any remark, only a header that names the reviewer’s
  revision of the answer (“Bản đã sửa”, “Bản sửa”, “Câu trả lời đã chỉnh sửa”, “Revised
  answer”, “Corrected version”) alone on its line also ends up to 4 opening sentences without
  learning material (“Chào em!”, “Review: …”); a labelled verdict on something else (“Nhận xét:
  bước 2 sai, g = 10.”) goes only then. “Bài giải đã sửa”, “Lời giải đã sửa” and “Bản hoàn
  chỉnh” never end opening sentences: a teacher writes them after a misconception (“Nhiều bạn
  nghĩ vật nặng rơi nhanh hơn…”). At the very start, before any header, words only a reviewer
  writes about the answer it checked are remarks too, without a label: “giữ nguyên nội
  dung/câu trả lời/bản nháp/lời giải/bài giảng” and “the (provided/original/given) response is
  accurate/correct/complete” when they end their clause (only “ban đầu”, “như cũ”, “as it
  was”…, then the end of the sentence, a comma or “và/and …” may follow), “No changes needed”,
  and “I kept the answer/response/draft/explanation/content/wording/structure/lesson/text/
  solution/format”. “Câu trả lời cuối cùng:” counts as a header only right after a remark.
  Feedback on the learner’s own draft or answer (“Bản nháp của em…”, “Câu trả lời ban đầu của
  em…”, “Your answer…”) is never a remark; when the question mentions “nháp”/“draft” no wrapper
  is removed at all. When the question asks for a correction or a check of the learner’s **own**
  work, the verdict the learner asked for stays: only words about the draft or the version under
  review (“bản trả lời ban đầu”, “the provided response”) count, and a header alone ends nothing.
  Such questions (whole words): “sửa/chữa/chấm/kiểm tra/check (lại) giúp/hộ (em)”, “sửa cho em”
  when the request ends there (“Kiểm tra lại giúp em.”, “Sửa giúp em, v = …”) or names the work
  and then ends or opens a “:” (“Thầy chữa giúp em bài này”, “Thầy check giúp em bài này với: v
  = 20 m/s”, “sửa giúp em chỗ này”) — a topic after it (“Thầy kiểm tra giúp em điều kiện cân
  bằng…”, “Kiểm tra lại giúp em đơn vị của lực là gì”, “Kiểm tra giúp em xem nước có dẫn điện
  không”, “Sửa giúp em lỗi chính tả…”, “Sửa cho em câu hỏi: …”, “Thầy chữa giúp em bài tập 5
  trang 20”) is no such request;
  “sửa/chữa/chấm/kiểm tra/nhận xét/góp ý/đánh giá” + a piece of work (“bài (làm/giải/tập)”, “lời
  giải”, “đáp án”, “kết quả”, “lỗi (sai)”, “sai”…, maybe “trong bài này”) + “giúp em”/“cho
  em”/“của em”/“em làm” or a bare “giúp” that ends the request (“Sửa bài giúp em với ạ”, “Thầy
  chữa bài cho em”, “Thầy sửa lỗi giúp em”, “Sửa lỗi sai trong bài của em”); “xem” + the
  learner’s work (“xem giúp bài làm của em”, “xem bài em làm”, “xem giúp em bài làm này”); “giúp
  em sửa/chữa/chấm/kiểm tra” + a piece of work or the end of the request; “xem/nhận xét giúp em”
  at the very end of the question (“Em tính ra 20 m/s, thầy xem giúp em”); “bài làm/bài
  giải/lời giải/đáp án/câu trả lời của em”, “bài em làm”, “Kết quả của em là …” anywhere; “em
  (làm/tính) sai ở đâu/chỗ nào/bước nào”, “(thầy) xem có sai chỗ nào không”; a yes/no check at
  the end of a sentence (“… đúng không ạ?”, “có đúng không”, “có sai không ạ?”, “đúng chưa thầy”,
  “đúng không thầy ơi?”, “đúng k ạ”, “đúng hông”, “đúng hk thầy”), but not after “còn”/“vẫn”
  (“Khi có ma sát, định luật bảo toàn cơ năng còn đúng không?” asks whether a law still holds);
  “được/ổn … không/chưa” after the learner’s way of working (“Em làm như vầy được chưa thầy?”,
  “Em làm vậy ổn không ạ?”) or choice (“Em chọn đáp án C có được không ạ?”); in English
  “check/fix/grade/correct my …”, “is my … correct?”, “fix this”/“check it for me” and “is
  it/this/that right?” only at the end of the question and not after “how”/“why”, “am I right?”,
  “did I solve this correctly?”, “have I done this right?”, “did I make a mistake?”, “where did I
  go wrong?”, “Is answer A right?”, “Is 20 m/s correct?” (a value, judged at the end of the
  sentence; “Is 90° a right angle?” is geometry), “I got 20 m/s, right?”. **Typed without
  accents** (common for pilot testers): the question is also folded letter by letter (“đúng” →
  “dung”), and a folded pattern counts only on a part of the question typed with no accent at all
  (so a mixed “em lam dung khong ạ?” counts, and an accented “dùng không” never reads as “đúng
  không”). Folded letters are ambiguous (“dung” is đúng/dùng/dừng, “cham” chấm/chậm/chạm, “chua”
  chữa/chưa/chua, “sua” sửa/sữa), so each folded pattern needs a context only the learner’s own
  work gives: “sua/chua/kiem tra (lai) giup em” that ends or names the work, “sua/chua/cham/nhan
  xet bai … giup em/cua em”, “cham diem giup em”, “bai lam/loi giai cua em”, an own-work subject
  before the check (“em lam/giai/tinh/ra/chon/viet … dung/sai khong/chua/k/hk”, “em lam nhu vay
  duoc chua”, “em chon dap an C co duoc khong”), “Dap an A dung khong”, “em (lam) sai o dau”,
  “xem co sai cho nao khong”, “xem/nhan xet giup em” at the very end. Ordinary questions never turn
  it on (“Thầy xem giúp em bài này: …”, “Thầy xem bài này giúp em: …”, “Bài tập của em hôm nay:
  …”, “xem kết quả của mình trên đồ thị”, “Xem đáp án giúp em”, “Em có nhận xét gì về …”,
  “chỉnh lưu”, “điều chỉnh”, “sửa sai ADN”, “Enzyme sửa lỗi giúp tế bào/con người…”, “chữa cho
  con người”, “Nhận xét kết quả con lắc…”, “Giúp em kiểm tra điều kiện cân bằng…”, “Em làm thí
  nghiệm này ở nhà được không?”, “Which … is correct?”, “Check this: <a new task>”, “Fix this
  circuit: …”, “How do I correct this for air resistance?”, “How do I fix this?”, “Why is it
  wrong to …?”, “review free fall”; without accents “Co the dung cong thuc nay khong?”, “Vat co
  dung yen khong?”, “Thay giang cham lai giup em”, “Thay noi cham giup em”, “Em chua hieu, giai
  thich lai giup em”, “Qua bong to ra dung khong?”, “Kiem tra giup em dieu kien can bang…”, “Em
  lam the nao de vat dung lai?”). Known limits
  (shapes still not recognised, so the text stays — nothing is dropped on a guess, except where
  said): a sentence that is both a short remark and a fact without any number or formula (“Bản
  nháp đúng: lực là đại lượng vectơ.”) goes as a remark; a remark in the middle of the lesson
  stays; reviewer notes with a number that are not recognised as a remark stay (“Câu trả lời dùng
  g = 10, nên đổi thành 9,8.” followed by a “Bản đã sửa:” line keeps both); an unlabelled verdict
  without a reviewer-only phrase stays (“Câu trả lời đúng và đầy đủ.”, “The answer is
  correct.”); reviewer-only phrases after the first header, or when the learner asked for a
  correction, stay; a lesson that opens with one of the reviewer-only phrases as a fact without a
  number or formula loses that sentence (“I kept the answer short on purpose.”, “The response is
  correct.”, “No corrections are needed at low speeds.”); a check phrased otherwise (“… phải
  không?”, “Thầy xem bài giúp em”, “Bài của em: v = 20 m/s”, “Can you check this for me: v = 20
  m/s?”, “Thầy xem bài này giúp em: v = 20”) is read as an ordinary question (its labelled
  verdict may go); a question that ends with “xem giúp em” or “is that right?” after a new
  exercise turns the correction reading on; a request to go over a new exercise with a
  correcting verb (“Thầy chữa bài tập này giúp em: …”, “Kiểm tra giúp em bài này: …”) turns the
  correction reading on (a reviewer note may then stay); a conceptual yes/no question about a
  statement or a law (“Định luật Ôm áp dụng cho mọi vật dẫn, đúng không?”, “Lực là đại lượng
  vectơ, có đúng không?”) turns it on too — only “còn/vẫn đúng không?” is told apart, so “Em làm
  vậy vẫn đúng không ạ?” reads as ordinary; “được không” after the learner’s way (“Em làm vậy được
  không?”) may be a permission question and still turns it on; “I got confused, right?” turns it
  on. Typed without accents, these stay ordinary (the folded letters are too ambiguous, so the
  verdict may go): a check with no own-work subject (“co dung khong?”, “dung khong thay?” after
  an exercise — “dung” may be “dùng”), a bare “cham giup em” (“chậm” or “chấm”), “tớ” (“to” is
  also “tô/tổ/to”), “con” as the learner, “Bai cua em: …”, and the shapes the accented list
  leaves out; teen spellings beyond “k/ko/hk/hok/hông” (“hem”, “khum”, “j”) are not read; the
  other way round, a folded “sua cho em.” at the end of a sentence counts even when it is “sữa”
  (“Me mua sua cho em.”). The lasting fix is a structured review output (`{answer, notes[]}`),
  still an open question.
- A reasoning tag written as code (“Qwen dùng thẻ `` `<think>` ``”, or inside a closed code
  fence) is code and stays. The same rule runs on both sides (`src/ai/reasoning.ts`,
  `src-tauri/src/ai/reasoning.rs`, their stream filters `ThinkFilter` and `ReasoningStream`, and
  the page’s `stripReasoningOutsideCode` for the chat, the voice and the board; pinned by
  `tests/fixtures/reasoning-strip.json`, groups `cases`, `code`, `after_block`): an opening or
  self-closing tag in code is code; a closing tag in code is code once an opening tag of the same
  name was written in code before it (“giữa `` `<think>` `` và `` `</think>` ``”); any other
  closing tag counts even as code, and when it is all its code span holds (“`` `</think>` ``”,
  or a fence holding only it) the backticks or the fence lines go with it. `<think/>` and
  `<think />` are an empty block (removed, the rest stays). A bare literal `<think>` outside code
  is hidden reasoning: unclosed, it is cut to the end (the shared rule cannot tell it from a model
  stopped mid-reasoning). A closing tag left after a block is an orphan for Rust, the streams and
  the browser transport (everything before it goes); only the page’s whole-answer pass removes it
  as a tag and keeps its neighbours. While a stream arrives, a tag that may still turn out to be
  code (inside a fence or after a backtick still waiting for their end) is held back with
  everything after it until that is decided. `hideUnfinishedReasoning` is the one preview rule
  for a whole text so far (the Gemma worker’s partial answers): the rule applied up to that
  point, reading the code spans of everything received (a fence closed after a tag still being
  typed keeps the tags before it as code); `ThinkFilter` and Rust’s `ReasoningStream` are its
  incremental form and show exactly the same after every piece (tested on every vector cut at
  every character and on random streams with code on both sides), so a stream’s shown text is
  never filtered twice.
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

**Old answers in the history** (`memory.sentText`). New answers are stored clean; an answer saved
by an older version may still hold hidden reasoning, echoed prompt labels or a Think reviewer’s
notes. The history (`fitHistory`) and the summary request (`summaryRequest`) send every answer
cleaned with `cleanAnswer`, a Think answer (`checkedBy`) read with the learner’s question right
before it (`questionBefore`), so feedback the learner asked for is kept. An answer that cleaning
leaves empty (nothing but reasoning, also one cut before its closing tag, or nothing but a
reviewer’s notes) is sent as `EMPTY_ANSWER` (“…”): the saved reasoning never goes back to the AI
or to the summary, and no turn is empty (an empty turn breaks some providers’ requests). Known
limits until the chat wiring step (chatService.ts is not changed in this step): its own calls
`sentText(r)` (the pending turns it shortens for the summary, the turns given to the screen
context) have no question, so a Think answer’s reviewer notes stay there as saved (reasoning and
labels still go); and `givenNumbers` still reads an old record without `unverifiedNumbers` from
its saved text. The numbers there that nobody gave are flagged by the same check and never count
as given; only numbers the check does not read as stated values could.

**"Viết tiếp".** The Rust gateway and the browser transport report `truncated` when the provider
stopped for any reason but its natural end (Gemini `STOP`; Claude `end_turn`, `stop_sequence`,
`tool_use`; Groq `stop`): the output limit (`MAX_TOKENS`, `max_tokens`, `length`), a context
limit, Gemini `OTHER`/`LANGUAGE`, a reason added later; streamed or not; the Gemma worker when it
generated `maxTokens` tokens. A stop by the provider's own filter (Gemini `SAFETY` and the like,
Claude `refusal`, Groq `content_filter`) is no answer, also when some text came with it. The chat
then shows "Câu trả lời dài nên đã dừng giữa chừng." and **Viết tiếp**, which asks for the rest
and appends it to the same message (a new list item, heading or formula starts a new line).

**Browser transport = Rust rules** (`src/ai/cloudStream.ts`, `FetchTransport` in
`src/ai/transport.ts`; development and E2E only, the desktop app streams in Rust). Same natural
ends and filter stops as above (`NATURAL_END`, `GEMINI_BLOCKED`); every whole answer goes through
the shared reasoning rule (`visibleAnswer`: nothing but reasoning is `reasoningOnly`, a JSON
answer to a schema is kept as sent); whitespace before the first visible text is held back, so
it does not count as shown and the quota fallback may still answer; a provider error after the
end mark (its stop reason) keeps the complete answer; the fallback is asked only while at least
min(5 s, a quarter of the first-text wait) of that wait is left (`roomForFallback`), otherwise the
provider's own quota error comes back (there is no retry in the browser).

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

**Number words, with and without accents: what they miss on purpose** (`numberWords.ts`). A number
word the learner wrote counts as given, so when the reading is unsure the reader finds less, and an
unsure numeral gives nothing at all, never a shorter value. The usual cost is a false "chưa kiểm
chứng" on a value the learner did write.

- _Spoken numbers._ A digit word, "mốt", "lăm" or "tư" right after a lone digit, "chục", "trăm" or
  a scale word ends the number in speech ("hai tư" 24, "ba sáu" 36, "hai trăm hai" 220, "một trăm
  mốt" 110, "một nghìn tư" 1400, "trăm hai" 120), or the words are a range ("hai ba người", two or
  three people). So "hai bốn giờ", "hai trăm tư mét", "một nghìn hai", "nghìn hai" give nothing, not
  2 and 4, 200, 1000 or 2; "một trăm tư nhân hai" gives only the 2. After a numeral that ends in a
  units digit, a digit word is the other end of a range: "mười hai ba tuổi" (12 or 13) gives 12
  only, "hai mươi lăm sáu độ" 25 only.
- _"chục", rough numerals._ "hai chục" is 20 ("hai chục rưỡi" 25, "hai chục nghìn" 20 000). A rough
  or partial numeral gives nothing: "hai trăm mấy", "hai mươi mấy", "hai trăm lẻ" (two hundred-odd),
  "ba lẻ năm" (3,05 or 305?), "twenty-odd", "two and a half thousand", "half a million"; nor does a
  numeral before "vạn" or "tá", which are not read ("hai vạn", "hai tá").
- _"năm" is also "year"._ Right after a number it is the year: "một năm" gives 1, "hai mươi năm"
  20, "Sau 3 năm" nothing. Before a unit or a count word it cannot be the year, so the whole numeral
  gives nothing: "bốn năm lần" (four or five times), "trẻ bốn năm tuổi", "mười năm phút" (15 said
  with an "n"?), "bốn năm nghìn". After "chục", "trăm" or a scale word it is the year only before
  "rưỡi" or a word that settles it ("hai trăm năm trước", "hai nghìn năm qua"); "Em ra hai trăm
  năm" (250 in speech?) gives nothing. Alone, "năm", "một" (also "a") and "chín" (also "ripe")
  count only before a unit or measure word ("năm giây"; not "Năm nay", "năm nhất", "Năm 1905", "Quả
  chín"), so "sinh viên năm hai" and "nhân năm" give nothing.
- _Names._ A capitalised digit word that does not start a sentence is a name ("anh Ba", "chú Bảy",
  "bạn Nam"), and so are "Ba Lan" (Poland) and, without accents, a capitalised "Nam" anywhere ("Nam
  lan luot tha…"). They give nothing.
- _"tư" that starts a word_ ("tư thế", "tư vấn", "tư nhân"; not "tư nhân viên") ends no numeral, and
  the numeral it would have ended gives nothing: "hai mươi tư thế" gives neither 24 nor 20, "ba phần
  tư nhân hai" neither 0,75 nor 3.
- _Fractions and decimals._ A denominator is no value of its own ("phần mười giây", "mot phan muoi
  giay", "two thirds", "one tenth"; "half-life" gives no 0,5). Decimals in words ("ba phẩy năm",
  "one point five") are read; an unsure ending gives nothing: "hai phẩy năm năm" (2,55, or 2,5
  years?), and one digit after "point" followed by a word that is no unit ("Through one point two
  lines": one point, two lines). "hai giờ rưỡi" gives 2,5 only, so an answer that rewrites it as "2
  giờ 30 phút" has "2 giờ" listed.
- _Text with no Vietnamese mark at all._ Nearly every digit word is also an ordinary word ("sau"
  after, "bay" fly, "tam" centre or "tầm" about, "muoi" salt, "do" because), "muoi" is both "mươi"
  (tens) and "mười" (ten), and "gap" is both "gấp" (times) and "gặp" (meet), the core word of
  meeting problems. A numeral then counts only before a unit, unless it has a word that means nothing
  else ("nghin", English number words except "ten"); after "gap" it also counts at the end of its
  run ("tang gap ba"; "gap doi" anywhere), but not a lone "mot" or "nam" or a capitalised name ("An
  gap Nam"). A numeral that starts with "sau", "bay" or "tam" never counts, alone ("Sau giay dau
  tien", "May bay bay thang", "tam giay") or longer ("Sau muoi giay" is after ten seconds, not 60;
  "May bay bay muoi phut"; "Bay muoi met"), not even after "gap" ("Hai xe gap sau muoi giay": they
  meet after ten seconds; "gap tam muoi phut": after about ten minutes), so "tang gap sau lan" gives
  nothing either. Neither does "bon muoi" ("Mot bon muoi lit": a tank of ten litres, not 40). The
  whole numeral is skipped, so its 10 or 15 is not taken either. Inside a numeral that starts with
  another word they still count ("muoi sau giay" = 16). "nam", "do", "ngay", "tan", "can" are not
  units there, so "ba muoi do", "ba ngay", "hai tan" and "hai nam ruoi" give nothing, and neither
  does a numeral with no unit after it ("v = hai muoi lam"). A short reply such as "hai" or "ba" has
  no marks even when typed on a Vietnamese keyboard, so it is read the same way and gives nothing.

These rules make an invented value passing as given unlikely, not impossible: an ordinary word they
do not foresee can still be read as a digit ("nam muoi phut" gives 50, though it may be "nằm mười
phút"; "Hai xe gap doi xe" gives 2, though it may be "gặp đội xe").

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
the chat shows one line naming where the next question will go: the answering provider, the quota
fallback when it can be asked (Think off and it has a key: “Groq (dự phòng khi Gemini hết lượt)”;
on the desktop, after a quota error the gateway asks it directly for 10 minutes), the reviewer with
Think, and Wikipedia when the lookup is on (never for a question about the circled board; a
question about a picture of the circled area names no reviewer either: it is not reviewed).

| Stays on this computer                                                                                  | May be sent online                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| chat history, added files, built-in notes                                                               | question + recent turns + summary of older turns + relevant excerpts → answering provider (API engine)                                               |
| downloaded Gemma models; Gemma answers                                                                  | the same → the quota fallback provider, when the chosen one is out of quota and Think is off (only if it has a key)                                  |
| questions to a runtime on this computer                                                                 | question + draft + relevant excerpts + summary + screen context (if on) → reviewer (Think; never the fallback)                                       |
| API keys (keychain or session memory)                                                                   | (with a runtime on this computer: only Think, Wikipedia or the Gemini voice)                                                                         |
|                                                                                                         | question → Wikipedia (only if the lookup is on; never for “Khoanh để hỏi”)                                                                           |
|                                                                                                         | screen context (only when the bubble toggle is on)                                                                                                   |
|                                                                                                         | a photographed problem → the API (browser only, downscaled)                                                                                          |
|                                                                                                         | model files are downloaded from HuggingFace (nothing is uploaded)                                                                                    |
| the learner's own strokes on the board                                                                  | circled board text (“Khoanh để hỏi”: the lesson's own words, LaTeX and drawing labels, ≤ 2000 chars) → the answering provider and the Think reviewer |
| a picture of a circled area without text (only to an AI on this computer that reads pictures)           |                                                                                                                                                      |
| the answer about that picture (never to the reviewer, an online engine, the summary or an online voice) |                                                                                                                                                      |

**“Khoanh để hỏi” (item 2, `src/teacher/board/selection.ts`, `chatService.askTeacher` option
`boardSelection`).** What the learner circled on the board is read back by code (no AI): the
written words, formula pieces (exact LaTeX) and drawings' own labels inside the loop, in reading
order, with the face's title and the steps just before/after. It is sent as one fenced
`<board_selection>` block: in the instruction with `BOARD_ASK` for a full (cloud) prompt, right
before the question in the user turn for an on-device or small local prompt (capped at 600, or 300
on an integrated card). It passes `checkInput` (own errors `chat.errors.boardPersonal` /
`boardUnsafe`), is added to the knowledge query and to the missing-data check, and is never put in
the question, its `prompt` or the prompt's `sources`: numbers the lesson flagged stay flagged. The
answer is an aside (`ChatMessageRecord.mode: 'aside'`; the question keeps `boardRef {face, ids,
excerpt}`, and `memory.sentText` adds the excerpt for follow-ups): shown and read aloud in the chat,
never taught on the board, whose lesson stays paused until “Quay lại bài giảng”. Only when the
circled part has no text at all (a drawing without labels, the learner's handwriting) a PNG of the
area is built from the board model (pure SVG, never KaTeX/DOM text) and sent **only** to an AI on
this computer that reads pictures (`pictureReader.ts`): the learner's chosen Gemma E2B on a card
known to be discrete (never on an integrated card, never a silent switch from 1B to E2B), or a
local runtime model whose check on this computer says vision “Có”. Never to the cloud; any other
AI → the board says it cannot read pictures and asks the learner to type (no AI call). With
Think on, a question about such a picture is **not reviewed**: the draft is the on-device model's
description of the learner's strokes, so sending it to the online reviewer would put the strokes
online as text (and the reviewer could not see the picture to check it). `askTeacher` answers it on
this computer only (no reviewer key needed), the answer carries `reviewSkipped: 'picture'` and the
chat shows "Chưa rà soát: …"; the "sent to" line leaves the reviewer out for it. Later questions
never carry it online either (`memory.withoutPictureAsks`): the history sent to an online engine or
used for a Think draft leaves out each picture question and the answer after it, and the summary of
older turns is always made without them (only an on-device answer without Think still sees them in
its history). "Viết tiếp" of a cut picture answer is therefore not offered while the API is chosen
(the chat says it can be continued with “Gemma cục bộ” or “AI trên máy khác”), and `askTeacher`
refuses a continuation whose answer would be left out of what is sent (`continues`), so nothing is
asked; a quick button after it asks the API without that answer. **The voice keeps it here too**
(`speak.ts`: `canSpeakOnDevice`, `speak(…, { onDevice: true })`): a picture answer and its
continuation are read aloud only by the on-device voice model or an installed Windows voice
(`localService`, name without “Online”/“Natural”); with the Gemini voice (which sends the text to
Google) or an online Windows voice (“… Online (Natural)” in Edge/WebView2) it is not read, and the
chat says so under the answer with a “Chọn giọng” button. When the on-device voice fails, a Windows
voice takes over only if it reads on this computer. The voice's name is all the app knows about
where it reads: an installed voice that sends text away without saying “Online” is not detected. A question about the circled board is never looked up on Wikipedia (its
words alone name no topic, and the board's text never goes there); the "sent to" line leaves
Wikipedia out then. It is never read as an answer to the teacher's check question
(`TurnOrigin.boardAsk`). When the circled text does not fit the block's cap, the title and the
neighbours are left out first, then lines are cut ("…") and the parts left out are counted in a
marked line — never dropped silently. The PNG path (blob: URL → OffscreenCanvas) is **not verified
in the native WebView2 build**; if it fails, the learner is told and nothing is sent.

## Teacher voice (reads answers aloud)

The speaker button in the chat header turns the teacher's voice on and off; the state is
remembered. Each new answer is read with the device's built-in voices — free, no key, no network.
Settings → AI Teacher → “Giọng nói của thầy” offers four styles, a voice picker and a preview. Asking a
new question, clearing history, leaving the page or closing the panel stops the speech.

### Natural teacher voice for the on-device MMS voice (2026-10-14)

The engine stays MMS-TTS (`Xenova/mms-tts-vie`, VITS). Text editing is separate from synthesis:

1. **Speech plan** (`src/teacher/voice/speechPlan.ts`, pure). `prepareSpeech(text, {role, emphasis})`
   removes what is not meant to be heard (hidden reasoning — `<think>` and friends, also unclosed
   or orphan, `src/ai/reasoning.ts` —, `<reference>` blocks, comments,
   known tags only — TeachScript, SSML and a short HTML list (`markup.ts`), even with `>` inside an
   attribute; a comparison without spaces such as "x<y khi y>0" stays and is read "nhỏ hơn" /
   "lớn hơn" —, horizontal rules, emoji), applies the
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
   | `keyword`  | the key term itself (board keyword, marked word, `**bold**` term)                   | 0.90 | 0.60        | 0.70                 |
   | `check`    | words: the sentence ends with "?"                                                   | 0.96 | 0.70        | 0.85                 |
   | `feedback` | words: "Đúng rồi", "Chưa đúng", "Rất tốt", "Không sao"… (correction, encouragement) | 0.94 | 0.72        | 0.85                 |

   Emphasis is a short pause before the key term and a slower pace for the term alone (it is cut
   off after it, so the words after it keep their sentence's role: a question stays a question) —
   never a louder voice. A one-word term followed by more words gets the pause only (MMS says a
   lone word oddly); a term with fewer than 3 words before it in its piece gets neither. A bold
   label at the start of a line ("**Bước 1:**") is not a key term.

4. **What MMS supports (the limit).** Hugging Face's VITS reads `speaking_rate`, `noise_scale` and
   `noise_scale_duration` from its config inside `forward()`. Transformers.js 4.3 `VitsModel` feeds
   the ONNX graph only the inputs it names (`session.inputNames`), and Optimum's VITS export (the
   one behind `Xenova/mms-tts-*`) declares `input_ids` and `attention_mask` only, so the three
   values are fixed in the graph (1, 0.667, 0.8). Not checked on the stored file itself (that
   needs the model; the worker reads `session.inputNames` at load and adapts). The worker
   (`localVoiceWorker.ts`, `vitsControls.ts`) passes a value only when the graph names it, clamped
   to 0.85–1.15 / 0.5–0.8 / 0.6–1.0, and reports which it applied; a graph that refuses a value (a
   wrong type, rank or shape) is run without it from then on. Any other error, above all a
   graphics-card failure, is never retried: it reaches the page, which moves the voice off the card. With the expected graph nothing is applied, so the noise columns
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
   rendered chunks, so the re-read starts at once. A chunk the worker was already rendering when
   the learner paused cannot be cut short: it finishes into the lesson's cache, and the re-read
   waits for that render instead of queueing the chunk again behind it. The board still calls
   `speak()` once per sentence, so speech and board stay in sync. The Windows and Gemini voices
   keep their sentence-sized phrases (they now get the dictionary too); after an on-device failure
   the Windows voice goes on from the first chunk not yet heard.
7. **Benchmark** (`scripts/voice/tts-bench.mjs`; first CPU run 2026-10-14, results in
   `docs/VOICE_BENCHMARK.md` §6 and `tests/voice/results/`). Renders `ttsBenchSet.json` (19
   sentences: greeting, transition, new concepts, check questions, correction and encouragement, a
   long paragraph, formulas, units and numbers, names, mitosis, chemical equations, a heading, a
   result, a note) as `legacy` and `natural` on the same prepared text (`prepareSpeech`'s
   `plan.text`: dictionary and today's reader in both), so only the pipeline differs: `legacy` =
   20b19c2's chunking, pauses and playback rate on that text (comma pieces, 140/260/320/520 ms
   timer pauses, raw audio, playback rate = speed); it is not the old reader's words. On the CPU
   only (Edge with GPU and WebGPU off, `wasm` asserted, model hosts blocked: the voice must
   already be stored). It records first-audio latency, synthesis time, real-time factor
   (synthesis over voiced time — each chunk without its edge silence — alike in both modes),
   duration, syllables per second, chunk loudness spread and peak, the longest gap, gaps over
   600 ms and the time spent stalling, clipping, NaN, words dropped or reordered, and the Edge
   process tree's CPU time and peak memory. The WAVs are what the app would play on that CPU:
   each chunk placed where the playback timeline (look-ahead of one) starts it, so a stall while
   the next chunk renders is heard as silence (the wait for the first chunk is left out). The
   folder for listeners is `listen/` only (the blind A/B sheet `index.html`, four 1–5 ratings
   per recording, and `blind/`); `by-mode/`, `key/ab-key.json` and `results.json` name the modes
   and stay outside it.

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

**A picture for a local runtime** (Ollama, LM Studio, llama.cpp server, other OpenAI-compatible
servers; `check_vision` in `src-tauri/src/ai/local/mod.rs`, `visionOf` in
`src/ai/local/fetchClient.ts`) reaches the model only when its runtime says the model reads
pictures. A runtime that cannot tell (any other OpenAI-compatible server: its model list says
nothing about pictures) is not asked again, and a model missing from LM Studio's list is not
known either: both are refused before the question as `vision-unverified` ("Chưa xác minh"),
never as a missing model. A runtime that says no gives `no-vision`.

## AI on this computer as the AI Teacher engine (Ollama, LM Studio, llama.cpp)

User decision 2026-10-14 (loopback-only Ollama, LM Studio, llama.cpp and OpenAI-compatible
servers). **Not yet recorded in `CLAUDE.md`**: its rules still say "no LM Studio/Ollama" and "do not
add local providers back"; the lead must record this decision there before the branch is merged.
The runtimes are a third engine, `ChatEngine = 'local'` (`stemsim.teacher-chat` v6; v5 keeps its
engine), never a cloud `Provider`.
The page talks to them through `src/ai/local/client.ts` (Rust `local_ai_*` commands in the desktop
app, the browser client only without it).

**Settings → “AI trên máy khác (Ollama, LM Studio, llama.cpp)”**
(`src/teacher/chat/settings/LocalRuntimeSettings.tsx`, after the Gemma page):

- Nothing is asked when the page opens; a saved choice is shown as saved (“SimLab chưa hỏi chương
  trình lần này”). “Tìm trên máy này” asks only 127.0.0.1:11434, :1234, :8080 and the addresses the
  learner added (no file read, no disk scan), then lists the models of each runtime that answered.
- Each runtime: “Phát hiện” + “Đang chạy · phiên bản …”, “Đang nạp mô hình”, “Cần khóa”, “Không
  thấy” or “Không phải chương trình AI”. Each model: “Có trong danh sách”, loaded or not, “Đang
  chọn cho AI Teacher” only while the chat uses it (otherwise “Đã chọn · AI Teacher đang dùng …”,
  naming the engine that really answers), “Đã thử trả lời · time”, “Không dùng được: reason”
  (runs online, context under 2 048, a failed answer test). Models that run online are listed but
  cannot be chosen.
- “Kiểm tra kết nối” = fingerprint + model details (nothing generates). “Kiểm tra trả lời” = one
  tiny generation; the page warns it loads the model into RAM/VRAM; one click is one request.
- Capability table: Có / Không / Chưa xác minh, only what was seen on this computer (the
  runtime's documentation is a hint). File size and context length when the runtime reports them;
  RAM/VRAM is always “Chưa xác minh”.
- The last search, its time and the model lists stay in `localAiStore` for the session (never
  saved): reopening Settings shows them again with “Kết quả lần tìm lúc …” (an older result adds
  that it may be out of date); answers that arrive after “Khôi phục mặc định” are dropped.
- The chosen model is checked against that search: a runtime not found, not this runtime, or a
  complete model list without the model shows “Chưa dùng được” with the runtime's sentence instead
  of “AI Teacher đang trả lời bằng mô hình này” (“Bỏ chọn” and another model stay available).
- “Dùng cho AI Teacher” saves the choice (`stemsim.local-ai`) and the engine; “Bỏ chọn” goes back
  to the engine used before, as it was (a pre-selected Gemma stays only a suggestion). Its note and
  the “not in use” line name the engine that really answers (`analysisEngine`): a pre-selected
  Gemma without its model means the questions now go online to the API, and the note says so
  (the provider's plain name, never the menu's “khuyên dùng”; without a key: nothing is sent yet).
  “Khôi phục mặc định” (after a confirm) forgets addresses, checks and the choice; the engine is not
  changed.
- “Thêm địa chỉ” refuses anything off this computer and says why. In Basic mode the address form
  and the capability table are folded behind one line.
- Troubleshooting per status, honesty notes (SimLab does not choose the runtime's GPU, does not
  know what it logs, a loopback relay can still forward), the browser CORS note, and the fallback
  line: a failing local AI is reported and nothing goes online.

**Answers** (`chatService.localRuntimeChat`): streamed through the same filter as Gemma (every
piece passes `outputIsSafe`, unfinished reasoning is hidden, pieces are provisional), cleaned with
`cleanAnswer`, labelled “Ollama · qwen3:8b” (`src/app/ai/localRuntime.ts`). No retry, no daily
cap, never a fallback; “Dừng” closes the connection. Failures are study-partner sentences
(`chat.errors.local*`: down, model missing, loading, stalled, needs a key, context full, runs
online, not this runtime, not chosen, failed, app update) with the Settings page to open and
“Hỏi lại” when asking again may help — the learner's click, one request. The summary of older
turns is written by the same runtime and capped to fit the window it is sent with (window − 400 −
512 tokens), so Ollama never cuts it silently, and sent with `think: false` (only a model seen
reasoning first gets it). A summary the runtime fails for a runtime reason (an allow-list in
`chatService.localSummaryFatal`: not running, stalled, loading, model missing, locked, runs
online, not this runtime, not chosen, app update, gate closed) ends the question with that sentence
instead of asking the runtime a second time; any other summary failure (did not fit, only
reasoning, nothing within its 400 tokens, an unsafe text, another error) is skipped and the
question is asked. A model that wrote no answer gets `chat.errors.localNoAnswer`. The chat line
“không gửi lên mạng” is shown only while nothing goes online: with the Gemini voice on it says that
each answer's text goes to Google to be read aloud. With Think on, the button counts “· 1 API rà
soát” (only the review goes online) instead of “· 2 API”.

**Top-bar AI pill** (`aiStatusView.ts`) follows the chosen engine: “AI trên máy: Ollama” (hint:
model, address, nothing goes online; click → “AI trên máy khác”), “AI trên máy: chưa chọn”,
“Gemma trên máy” / “Gemma: chưa tải” (click → the Gemma page); the API states only for the API
engine, and the safety gate first.

**Budget** (`memory.contextBudget('local', …, ctx)`): with a context window seen on this computer,
the cloud table but never more than the window minus the answer and 512 tokens; unknown → the small
on-device budget (4 000 / 1 024). The window sent to Ollama (`num_ctx`) is what the request needs,
never the model's whole window. Prompt: the cloud prompt when the window is known and ≥ 16 384,
otherwise the on-device one (no new prompt text, no decoding change).

**Think**: the draft is written on this computer, then only the review goes to the chosen reviewer
(sent with `noFallback`, so never to a third provider; also for Gemma drafts).

**Analysis, explanation and photos**: “Phân tích đề” and “AI diễn giải” use the same engine
(`resolveAiForAnalysis` → `localTransport`; JSON schema as structured output only when the check
saw it supported, otherwise in the prompt; the draft checks are unchanged). A local failure in the
analysis dialog is the same sentence plus “Mở AI trên máy khác”; “AI diễn giải” shows the same
sentence with a Settings button, and a chosen Gemma without its model says so (never a code). A
photo with this engine (`photoVision.readPhotoOnComputer`) is read by the runtime only when its
model was seen reading pictures, else by the in-app Gemma, else the learner is told it needs an API
key or the picture-reading Gemma. No runtime picked and a runtime that fails (not running, stalled,
model missing…) each get their own sentence and Settings page instead — it never goes online. A
runtime that refuses the picture (`no-vision`) counts as a model not seen reading pictures; a
refused picture says to take another one. Outside the chat (`localFailure(e, use)`), a task too
long for the model's window points to a model with a larger window on the runtime page, never to
Trí nhớ, and an explanation the model did not write is a sentence, never a code.

Tests: `engineChoice.test.ts`, `chatStore.test.ts`, `memory.test.ts`, `chatLocalOnly.test.ts`
(local cases), `ChatPanelLocal.test.tsx`, `LocalRuntimeSettings.test.tsx`,
`TeacherSettingsDataFlow.test.tsx`, `analyze.test.ts`, `ExplainBox.test.tsx`,
`photoVision.test.ts`, `CameraDialog.test.tsx`, `localAiStore.test.ts`, `localRuntime.test.ts`,
`AiStatusPill.test.tsx`, E2E
`tests/e2e/local-ai.spec.ts` (a fake Ollama on
127.0.0.1:11434; every cloud host and Wikipedia counted and refused). Not tested against a real
runtime.

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
