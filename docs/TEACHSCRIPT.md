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
