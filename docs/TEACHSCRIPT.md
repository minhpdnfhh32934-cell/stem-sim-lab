# TeachScript 1.0 — specification (PROMPT_PHAN_2 B3)

> **Tóm tắt tiếng Việt.** TeachScript là "kịch bản giảng dạy" mà AI viết ra (hoặc người viết tay ở
> T1). Chữ nằm ngoài thẻ là lời thầy nói; thẻ đặt ở đâu thì hành động (viết bảng, chỉ, đổi nét mặt)
> xảy ra đúng lúc giọng nói tới chỗ đó. AI **chỉ nói ý định** ("viết vào vùng các bước"), **không bao
> giờ** đưa tọa độ; chương trình tự xếp chỗ trên bảng. Mọi con số viết lên bảng phải lấy từ công cụ
> tính toán hoặc từ đề bài, nếu không câu đó bị bỏ và AI phải viết lại. Trình đọc kịch bản **chịu
> lỗi**: thẻ hỏng thì bỏ thẻ, vẫn nói phần chữ. **Trạng thái: đặc tả T0, chờ duyệt.**

Status: **draft for approval (T0)**. Version `1.0`. Implemented from T1 (parser, validator,
orchestrator) — this document is the contract for those tests.

## 1. Design goals

1. **Stream-parsable.** The LLM streams TeachScript sentence by sentence; the parser must emit
   speech and actions before the whole reply has arrived. That is why tags are flat, lightweight
   XML rather than nested JSON.
2. **Speech is the clock.** Text outside tags is spoken; a tag's position in the text is its time
   anchor. Actions start when the audio reaches that position (B2: master clock =
   `AudioContext.currentTime`, sync error ≤ 100 ms).
3. **Intent, not geometry.** The author names zones, roles and relations. The deterministic layout
   engine (B7.2) chooses positions. **Pixel coordinates are invalid TeachScript.**
4. **Numbers have provenance.** Every number written or drawn must come from a tool result or from
   the problem text (MASTER_PROMPT §2, B1.1). The validator enforces it (§7).
5. **Fault tolerant.** Broken markup never stops the lesson: drop the broken part, keep the speech,
   log it.

## 2. Lexical rules

- Encoding UTF-8; Vietnamese text in NFC. The parser normalises to NFC.
- A document is a sequence of **text runs** and **tags**. Tags: `<name attr="v" …>` … `</name>`
  (container) or `<name … />` (empty). Names are lowercase ASCII `[a-z_]+`.
- Attribute values in double or single quotes. Entities: `&lt; &gt; &amp; &quot; &apos;` only.
  Unknown entities stay as literal text.
- Whitespace in text runs collapses to one space for speech; newlines are not pauses (use `<pause>`).
- **Container tags may not nest** except: `<emph>`, `<prosody>`, `<tone>` may contain text and
  empty tags (anchors), not other containers. `<write>`, `<correct>`, `<ask>` contain text only.
- Anything that is not a valid tag (e.g. a lone `<` in "a < b") is literal text. Authors should
  write `&lt;`; the parser tolerates the raw form when the next character cannot start a tag name.
- A TeachScript tag name (§4) or a reasoning tag name (§6) after `<` is always a tag. Any other
  name is a tag only when the rest reads as one: the name, then `name="value"` pairs only
  (`<foo bar="x">`, `<b>`, `<h1>`), or a closing tag without attributes (`</foo>`). Otherwise
  every character is text, so a comparison such as `$x<y$ và $y>z$` is never eaten.

## 3. Time model

The orchestrator turns a parsed sentence into a timeline:

- **Speech segments.** Text runs between anchors are synthesised as segments. With providers that
  return word timestamps (Azure `WordBoundary`), anchors map to word offsets. With providers that
  do not (Gemini TTS), the sentence is **split at anchors** and each segment is synthesised
  separately; the anchor time is the segment boundary, exact to the audio sample (B6.1). Inside a
  segment, positions are estimated from syllable counts.
- **Anchors.** Every tag has an anchor = the character offset in the spoken text where it appears.
  Empty tags fire at their anchor. Container tags fire at their opening anchor.
- **`sync`** on board tags (`write`, `draw`, `table`, `plot`, `correct`):
  - `during` (default): drawing starts at the anchor and runs while the teacher keeps talking. If
    the drawing needs longer than the speech that follows before the next board action, the
    orchestrator inserts a natural pause (face `focus`, gaze `board`) — the voice never races the
    pen (B8).
  - `before`: speech **waits** at the anchor until the drawing finishes ("viết xong rồi nói").
  - `after`: drawing starts when the current sentence's audio ends.
- **Ordering.** Actions with the same anchor run in document order. Board actions are serialised
  (one pen); face, gaze and pointer actions may overlap board actions.
- **Barge-in.** When the learner interrupts, the orchestrator stops audio (≤ 200 ms), lets the pen
  finish the current glyph, and stores a **resume point** = (sentence id, last completed anchor).

## 4. Tags

Attributes marked **req** are required; others optional. `id` values match `[a-z][a-z0-9_]{0,31}`
and are unique within a lesson (the board keeps them across sentences).

### 4.1 Voice

| Tag                                      | Attributes                                                                 | Meaning                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `<pause ms="400"/>`                      | `ms` **req**, 50–3000                                                      | Silence. Values outside the range are clamped.                                                                          |
| `<emph>…</emph>`                         | —                                                                          | Stress. SSML `<emphasis>` where supported; otherwise slight rate −10 % and volume +2 dB on that segment.                |
| `<prosody rate pitch volume>…</prosody>` | `rate` 0.7–1.3 (×), `pitch` −4…+4 (semitones), `volume` −6…+6 (dB)         | Local change; nested values multiply/add with the user's speed setting. Clamped.                                        |
| `<tone style="…">…</tone>`               | `style` **req**: `question` · `story` · `emphasis` · `gentle` · `cheerful` | Speaking style. Gemini TTS: natural-language style prompt; Azure: rate/pitch preset (vi-VN voices have no SSML styles). |

### 4.2 Face and gaze

| Tag              | Attributes                                                                                                                                     | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `<face e="…"/>`  | `e` **req**: `neutral` · `listening` · `thinking` · `focus` · `happy` · `encouraging` · `empathetic` · `curious` · `surprised_light` · `proud` | Blend to that expression (150–400 ms). Stays until changed.            |
| `<gaze to="…"/>` | `to` **req**: `student` · `board` · an element id                                                                                              | Eye/head direction. Board writing implies `board` while the pen moves. |
| `<nod/>`         | —                                                                                                                                              | Small nod.                                                             |
| `<smile/>`       | —                                                                                                                                              | Smile layered on the current expression for ~1.5 s.                    |

`explaining` is accepted as an alias of `focus`, `patient` of `empathetic` (B5.2 names).

### 4.3 Board — writing

| Tag                                                      | Attributes                                                                                                                                                                                              | Meaning                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `<write id zone role math speed sync note-for>…</write>` | `id` **req**; `zone` (default `main`); `role`: `heading` · `body` · `keyword` · `note` · `result`; `math="true"` → content is KaTeX; `speed`: `slow` · `normal` · `fast`; `note-for`: id to sit next to | Written on the board, **not spoken**. The teacher says the surrounding words while writing. |
| `<draw id zone type spec sync/>`                         | `id` **req**; `type` **req**: `free_body` · `axes` · `plot` · `table` · `flow` · `molecule` · `cell` · `vector`; `spec` **req**: JSON (§4.6)                                                            | Diagram. Numbers inside come from `ref` tool results only.                                  |
| `<table id zone ref sync/>`                              | `id` **req**; `ref` **req**: `tool:<id>` whose result is a table                                                                                                                                        | Table from a tool result (never from free text).                                            |
| `<plot id zone fn domain ref sync/>`                     | `id` **req**; `fn`: expression in `x` (CAS-checked) **or** `ref` to a tool series; `domain`: `"a..b"`                                                                                                   | Function graph. Sample points are computed by code.                                         |

**Zones:** `title`, `main`, `steps`, `side_notes`, `example`, `diagram`, `scratch`. Unknown zone →
`main` (validator warning).

### 4.4 Board — marking and editing

| Tag                             | Attributes                                       | Meaning                                                                 |
| ------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `<underline target span/>`      | `target` **req**; `span`: substring to underline | Sketch-style underline.                                                 |
| `<circle target/>`              | `target` **req**                                 | Hand-drawn ellipse, slightly open.                                      |
| `<box target/>`                 | `target` **req**                                 | Frame.                                                                  |
| `<highlight target/>`           | `target` **req**                                 | Marker behind the element.                                              |
| `<arrow from to label/>`        | `from`, `to` **req** (ids); `label` text         | Curved arrow; the layout engine routes it.                              |
| `<point target/>`               | `target` **req**                                 | Pointer/pen moves to the element and rests there.                       |
| `<erase target/>`               | `target` **req**                                 | Wipe animation; element moves to history.                               |
| `<correct target>new</correct>` | `target` **req**                                 | Strike through `target`, write `new` beside it (same id keeps history). |
| `<newboard title/>`             | `title`                                          | New board face; the old one stays in the board history.                 |
| `<recall target/>`              | `target` **req** (may be on an old board)        | Camera returns to the element (or shows a thumbnail of the old board).  |

### 4.5 Interaction

| Tag                                    | Attributes                                                                                                                                                                                 | Meaning                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `<ask id expect options check>…</ask>` | `id` **req**; `expect` **req**: `choice` · `number` · `expression` · `text`; `options`: `A\|B\|C` (choice); `check`: `tool:<id>` (deterministic check, required for `number`/`expression`) | The question is spoken; quick-answer buttons appear for `choice`. Ends the sentence: the teacher waits (state `ASKING`). |
| `<wait_student/>`                      | —                                                                                                                                                                                          | Stop and listen without a formal question.                                                                               |
| `<checkpoint concept/>`                | `concept` **req**: concept id from the lesson plan                                                                                                                                         | Marks a comprehension check point (progress bar, learner model).                                                         |

### 4.6 `spec` JSON for `<draw>`

`spec` is a small JSON object validated against a schema per `type` (T2). Common rules: no
coordinates, sizes or colours chosen by the LLM; numbers only through `"ref": "tool:<id>"`
references, e.g. `{"body":"block","forces":["P","N"],"ref":"tool:fbd_1"}`. Labels are text.

## 5. Grammar (informal EBNF)

```
script     = { sentence } ;
sentence   = { text | empty_tag | container } , sentence_end ;
container  = open_tag , { text | empty_tag } , close_tag ;   (* see nesting rules in §2 *)
empty_tag  = "<" , name , { attribute } , "/>" ;
open_tag   = "<" , name , { attribute } , ">" ;
close_tag  = "</" , name , ">" ;
attribute  = ws , attr_name , "=" , quoted ;
sentence_end = "." | "?" | "!" | "…" | </ask> | <wait_student/> | end of stream ;
```

Sentence splitting ignores `.` inside numbers ("9.81" in a `<write>`, "9,81" in speech) and
inside tags. A sentence longer than 300 characters is split at the next comma for TTS latency.

## 6. Streaming parser behaviour

- Input arrives in arbitrary chunks. The parser keeps an incomplete tag in a buffer until `>`
  arrives (max 2 000 characters; longer → treat the buffer as text and log `tag_too_long`).
- A sentence is released to the validator when its `sentence_end` arrives **and** no container is
  open. Unclosed containers at end of stream are closed implicitly (log `unclosed_tag`).
- Unknown tag → dropped, its text content kept as speech (log `unknown_tag`). Unknown attribute →
  ignored (log). Malformed attribute → tag dropped, text kept.
- A `<write>` whose `id` is missing or invalid keeps its text: the id is repaired (lower case,
  `-` → `_`: `S1` → `s1`, `step-1` → `step_1`) or replaced by an automatic `autoN` that no other
  `id` of the answer uses (log `id_repaired`; also for `<draw>`/`<plot>` ids). A `<correct>`
  without a `target` has nothing to correct: its text is spoken instead.
- An unclosed `<write>` or `<correct>` (end of stream, or another container opens) ends at its
  first sentence end or line break; the rest is speech (log `unclosed_tag`).
- A TeachScript or reasoning tag cut off at the very end of the stream (an answer stopped at the
  output limit: `<write id="s3" zone="ste`) is markup: it is dropped, never spoken (log
  `unclosed_tag`). Only when **all** of the tail reads as a cut tag: a name being typed, or a
  whole TeachScript/reasoning name, complete `name="value"` attributes and at most one being
  typed. Anything else stays text: "x<y" at the end, and "Khi v<c thì … 6 kg·m/s." (a comparison
  followed by more of the lesson) keeps every word.
- `<` followed by a letter is a tag only where a tag can stand: a TeachScript or reasoning name,
  a name with `name="value"` attributes, a closing tag, or a bare name of known markup (HTML such
  as `<b>`, answer wrappers such as `<answer>`). A bare unknown name is text: `<v> = s/t` is an
  average.
- Every sentence records where it stands in the text it was read from (`start`/`end`, after the
  hidden reasoning was removed). "Viết tiếp" (the answer was cut and its rest arrives) reads the
  whole answer again and goes on from where the lesson got to: the sentences already said and
  written whole are skipped by position (never by counting sentences; a cut sentence grows when
  its rest is joined on the same line), the sentence that was cut is said again whole, and a
  lesson stopped part way goes on from where it stopped. What the lesson placed from its last
  sentence on is checked against the whole answer: an action that comes again exactly, on
  elements that stay, is not placed twice; anything else (a stump of a line cut mid-word or
  inside `**`, a line that grew past the board's length or became a label, a final check that is
  a step once the answer goes on, a face whose title was cut) is wiped with its marks, and the
  whole answer's version is placed. The board then ends as if the whole answer had been taught at
  once (oracle test `lessonContinue.test.ts`).
- Hidden reasoning (`<think>`, `<thinking>`, `<reasoning>`, `<reflection>`, any case) is the
  exception: the whole block is dropped, never spoken or written (log `reasoning_removed`). An
  unclosed block is cut to the end; a closing tag with no opening tag before it (a chat template
  pre-filled the opening tag) drops everything before it. One rule for the chat, the voice and
  the board: `src/ai/reasoning.ts`, shared vectors `tests/fixtures/reasoning-strip.json`. An
  opening tag between backticks (inline code or a closed fence) is code, not reasoning; a bare
  literal `<think>` in the text is reasoning (`stripReasoningOutsideCode`). A closing tag always
  counts; when it is all its inline code span holds, the backticks go with it (no stray "`").
- The parser never throws; it returns `{ sentences, diagnostics }`. **Fuzz tests** feed random
  byte strings and random tag soups and assert: no exception, all plain text reaches speech in
  order, no action is emitted from inside a broken tag.

## 7. Validator (before performance)

Applied per sentence, with the board state of the lesson:

| Check                                                                                           | Action                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate `id` on a new element                                                                 | Rename to `<id>_2`, warn.                                                                                                                                                                                                                                                                                                                                                                           |
| `target` / `from` / `to` / `note-for` not found                                                 | Drop that action, keep speech, warn.                                                                                                                                                                                                                                                                                                                                                                |
| Unknown zone / role / face / style                                                              | Fall back to the default, warn.                                                                                                                                                                                                                                                                                                                                                                     |
| Coordinates or pixel sizes in any attribute or `spec` (`x`, `y`, `px`, `left`, `top`, `width`…) | Strip them, warn.                                                                                                                                                                                                                                                                                                                                                                                   |
| **Number provenance** (`write`, `correct`, `draw`, `table`, `plot`, `ask options`)              | Every number must match a tool result or the problem text (same rules as `src/ai/numbers.ts`, with tolerance for formatting: `9.81` = `9,81`; units converted). **Fail → the whole sentence is withheld, a `provenance` diagnostic is logged and the brain is asked to regenerate that sentence (max 2 tries, then a safe fallback line: "Phần này thầy chưa chắc chắn, mình kiểm tra lại nhé.")**. |
| `ask expect="number"/"expression"` without `check`                                              | Downgrade to `text` (LLM may only judge wording, B10.3).                                                                                                                                                                                                                                                                                                                                            |
| Spoken numbers                                                                                  | Numbers in speech follow the same provenance rule (they are checked on the normalised text).                                                                                                                                                                                                                                                                                                        |
| Safety                                                                                          | Output moderation (`outputIsSafe`) runs on the spoken text and on written text before performance.                                                                                                                                                                                                                                                                                                  |

Diagnostics are kept in the dev overlay and in tests; they never contain learner text.

### 7.1 As built: the board shows learning content only (item 1, 2026-10-14)

`src/teacher/board/lessonCheck.ts` (`validateLesson`) checks every answer, TeachScript or the
markdown layout (`fromMarkdown.ts`), after it was cleaned (`answerClean.ts`: hidden reasoning,
prompt echoes, a Think reviewer's notes) and before anything is drawn. No prompt change: the kind
of each written part (`title`, `goal`, `given`, `concept`, `definition`, `equation`, `step`,
`example`, `note`, `result`, `check`) is inferred from its zone, role and words.

- **Internal text** (reasoning in plain words such as "Let me think" or "Người dùng hỏi…", a
  reviewer's note about the draft, a prompt label alone, a link alone or a source line, bare
  markup such as `---`): neither written nor said. Only positive evidence drops a text; when
  unsure, it stays.
- **Social or meta text** (a greeting, "Tôi là AI…", "Hy vọng…", "Dưới đây là…", a sentence of
  generic words only such as "Mình sẽ giải từng bước"): said, never written. When a computation
  follows the greeting or the remark ("Chào em, v = gt = 9,8·2 = 19,6 m/s.", "Dưới đây là công
  thức: a = F/m = 5 m/s²"), that computation is written (the greeting is still only said).
  Generic words are compared with their Vietnamese marks ("có"/"cơ", "rồi"/"rơi", "đây"/"dây"
  are different words), a single letter is a symbol, and a verdict ("Không.", "Có.", "Kết quả:
  Có"), an unknown ("a = ?") or a symbol ("σ là độ đàn hồi") is never a remark.
- **A label alone** from a closed list ("Kết luận:", "**Đáp án**", "Phân tích:", "Cho:", "Ghi
  chú:", "Câu hỏi kiểm tra:", "Tài liệu tham khảo:"), closed by ":" or set in bold: not written,
  said with the line it names (a list of sources: not said). Its meaning goes to that line: a
  conclusion becomes the boxed result (one box, never an empty one), given data and notes go to
  the side, a check question becomes a side note of kind `check`. "Kiểm tra (lại):" is neutral:
  in a solution it verifies the answer, and the computation after it is written. A neutral label
  in front of content ("Trả lời: …") is not written either. A bare word ("Kết luận", "Yêu cầu")
  may be content and stays.
- **Questions**: only the learner's check (after a check label, or the lesson's last written
  text when it asks) is shortened to its question, and a sentence of it with numbers or a formula
  stays. A question among the steps ("… 72 km/h … sau 10 s dừng. Tính quãng đường?") is written
  whole.
- **Length** (`PART_LIMIT`: title 60, goal 80, given 120, concept 80, definition 100, equation
  120, step 80 or 140 with numbers, example 80, note 80, result 100, check 100): words only, the
  key point is written and the whole text said; with numbers, the text is split at clause
  boundaries into at most 3 writes (ids `<id>_pN`, never the layout's `<id>_N`), else kept whole.
  Never cut inside a number or a `$…$`. Math is never split here (the layout does).
- **Marks** (marks, arrows, points, corrections) on a write that was dropped, and underlines of
  words no longer written, are removed (a correction is still said). **The same write twice**:
  the second is dropped, its marks go to the first. On a write split into pieces, a box goes
  around the last piece, an underline, circle or highlight of the whole write under every piece,
  and a correction strikes every piece and is written after the last. A result boxed anywhere in
  the script is not boxed again.
- **Sanitising** never eats a comparison: HTML is removed only when its attributes are
  `name="value"` pairs ("Nếu v<s và t>0" stays), a bare unknown name stays ("<v>"), and a blank to
  fill in ("F = ____ N") keeps its underscores.
- **Tables** at most 8 rows × 5 columns with cells ≤ 40 characters, **flows** 6 steps ≤ 40,
  **new-board titles** ≤ 40. A cell with a number is kept whole.
- **What the teacher says** is recomputed from what is still written, so the voice never reads a
  dropped write; a sentence left with nothing to say or do goes, and its pause moves on. Links
  are not read out.

Long markdown paragraphs are said and only their equations written: every `$…$` and `\(…\)`
formula and plain-text chains such as `a = F/m = 10/2 = 5 m/s²` (written as text, never as
KaTeX), at most four. A chain is written whole or not at all: one whose right side would stop
after an operator, a `(` or a function name, or with brackets left open ("T = R *", "V₁ = 250 ml
(dung") is not written (Greek letters, `½`, `⋅` and "cos α" are part of a formula). `\[…\]` is
display math. Nothing here changes, rounds or invents a number:
a property test checks that every number of a random answer is written or said, whole. The
outline (`LessonOutline`) keeps the parts and, for dropped text, only reasons and counts (never
learner text). Number provenance is shown as labels on the board (`provenance.ts`); withholding a
sentence and asking the brain to rewrite it (the table above) is not built yet. Tests:
`lessonCheck.test.ts`, `boardFixtures.test.ts` (copies of real eval answers and cloud-shaped
answers), `teachscriptRepair.test.ts`, `lessonContinue.test.ts` ("Viết tiếp" equals teaching the
whole answer at once).

## 8. Text-to-speech normalisation (Vietnamese)

Spoken text is normalised before TTS (separate module + tests, B6.1): decimal comma ("9,81" →
"chín phẩy tám mốt"), units ("m/s²" → "mét trên giây bình phương"), symbols ("√" → "căn bậc hai
của", "Δ" → "đen-ta"), formulas ("H₂O" → "hát hai ô"), Greek letters, vectors. Text inside
`<write math="true">` is never spoken; if the teacher must read a formula aloud it is written in
words in the spoken text.

## 9. Example (B3.2, annotated)

```xml
<face e="focus"/>Trước tiên, chúng ta cần xác định
<write id="h1" zone="steps" role="heading">Bước 1: Các lực tác dụng</write>
các lực tác dụng lên vật.<pause ms="400"/>
Có <emph>hai lực chính</emph>.
Thứ nhất là trọng lực <write id="f1" zone="steps" math="true">\vec{P} = m\vec{g}</write>,
<point target="f1"/>hướng thẳng đứng xuống dưới.
Thứ hai là phản lực <write id="f2" zone="steps" math="true">\vec{N}</write> của mặt phẳng.
<draw id="d1" zone="diagram" type="free_body" spec='{"body":"block","forces":["P","N"],"ref":"tool:fbd_1"}'/>
<circle target="f1"/><prosody rate="0.9">Đây là chỗ nhiều bạn hay nhầm nhất.</prosody>
<face e="curious"/><ask id="q1" expect="choice" options="Có|Không" check="tool:equilibrium_1">Vậy theo em, vật có đứng yên được không?</ask>
```

Sentence 1 speaks "Trước tiên, chúng ta cần xác định các lực tác dụng lên vật." The heading starts
being written at "xác định|" (sync `during`); the face is `focus` from the start. Sentence 5 draws
the free-body diagram from tool result `fbd_1` (no numbers in the LLM text). The last sentence ends
with `<ask>` → state `ASKING`, buttons "Có" / "Không", the answer is checked by `equilibrium_1`.

## 10. Versioning

The brain's system prompt states `TeachScript 1.0`. New tags are additive; a performer that does
not know a tag drops it (§6). Breaking changes bump the major version and the prompt.
