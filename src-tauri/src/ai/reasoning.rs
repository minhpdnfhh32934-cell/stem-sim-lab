//! Removes a model's internal reasoning ("<think>…</think>" and friends) from an answer before it
//! reaches the page, so the chat, the board and the voice only ever get learning content.
//!
//! One rule, shared with the web side (src/ai/reasoning.ts) and pinned by the vectors in
//! tests/fixtures/reasoning-strip.json (both sides test every vector):
//!
//! Tag names: `think`, `thinking`, `reasoning`, `reflection`, ASCII case-insensitive, with
//! optional attributes (`<think type="x">`). A name followed by more letters (`<thinker>`) is not
//! a tag, and neither is `<y` in `$x<y$`.
//!
//! 1. Every closed block `<name …>…</name>` (same name) is removed, together with the spaces or
//!    tabs right after its closing tag.
//! 2. An opening tag left without its closing tag: everything from it to the end is removed
//!    (`unclosed`).
//! 3. A closing tag with no opening tag before it (a chat template that pre-filled the opening
//!    tag): everything up to and including the LAST such closing tag is removed, plus the spaces
//!    or tabs after it.
//! 4. When anything was removed, leading and trailing whitespace is trimmed; when nothing was
//!    removed the text is returned unchanged.
//!
//! Rust regexes have no backreferences (and the crate has no regex dependency), so the text is
//! scanned by hand. The scan is linear in the length of the text.
//!
//! [`ReasoningStream`] applies the same rule to an answer that arrives in pieces: reasoning that
//! is inside a block is never shown, a piece that may be the start of a tag is held back until it
//! is complete, and the final text is always exactly [`strip_reasoning`] of everything received.
//! It keeps its place between pieces (each byte is scanned a bounded number of times), so a long
//! answer full of '<' (HTML, XML, inequalities) still streams in linear time.
//!
//! Rule 3 cannot be applied before its closing tag arrives: text before an orphan closing tag is
//! shown while it streams (nothing marks it as reasoning yet) and is taken back by a
//! [`Shown::Replace`] when the closing tag comes. So streamed text is provisional: speech, board
//! actions and anything else that cannot be taken back must wait for the final text.

use super::AiError;

/// Reasoning tag names (lower case).
const NAMES: [&str; 4] = ["think", "thinking", "reasoning", "reflection"];

/// Length of the longest name: a longer run of letters after '<' is never a tag, so a scan never
/// reads further than this into a word.
const MAX_NAME: usize = 10;

/// Reads the letters of a possible tag name from `i`, at most one more than [`MAX_NAME`] (enough
/// to know the word is not a name). Returns the index after them.
fn name_end(s: &[u8], mut i: usize) -> usize {
    let start = i;
    while i < s.len() && i - start <= MAX_NAME && s[i].is_ascii_alphabetic() {
        i += 1;
    }
    i
}

/// The result of [`strip_reasoning`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stripped {
    pub text: String,
    /// Something was removed.
    pub removed: bool,
    /// An opening tag had no closing tag (the answer was probably cut while reasoning).
    pub unclosed: bool,
}

/// A reasoning tag found in the text.
struct Tag {
    /// Byte index of its '<'.
    start: usize,
    /// Byte index just after its '>'.
    end: usize,
    name: &'static str,
    closing: bool,
}

/// The reasoning tag that starts at byte `at` (which holds '<'), if it is one.
fn tag_at(s: &[u8], at: usize) -> Option<Tag> {
    let mut i = at + 1;
    let closing = s.get(i) == Some(&b'/');
    if closing {
        i += 1;
    }
    let name_start = i;
    i = name_end(s, i);
    let name = NAMES
        .iter()
        .find(|n| n.as_bytes().eq_ignore_ascii_case(&s[name_start..i]))?;
    if closing {
        while i < s.len() && s[i].is_ascii_whitespace() {
            i += 1;
        }
        return (s.get(i) == Some(&b'>')).then_some(Tag {
            start: at,
            end: i + 1,
            name,
            closing,
        });
    }
    match s.get(i) {
        Some(b'>') => Some(Tag {
            start: at,
            end: i + 1,
            name,
            closing,
        }),
        // Attributes run to the next '>'; another '<' first means this is not a tag.
        Some(c) if c.is_ascii_whitespace() => s[i..]
            .iter()
            .position(|&b| b == b'>' || b == b'<')
            .filter(|&k| s[i + k] == b'>')
            .map(|k| Tag {
                start: at,
                end: i + k + 1,
                name,
                closing,
            }),
        _ => None,
    }
}

/// The next reasoning tag at or after byte `from`.
fn next_tag(text: &str, from: usize) -> Option<Tag> {
    let s = text.as_bytes();
    let mut pos = from;
    while let Some(k) = text.get(pos..).and_then(|t| t.find('<')) {
        if let Some(tag) = tag_at(s, pos + k) {
            return Some(tag);
        }
        pos += k + 1;
    }
    None
}

/// The first closing tag named `name` at or after byte `from`.
fn closing_tag(text: &str, from: usize, name: &str) -> Option<Tag> {
    let mut pos = from;
    while let Some(tag) = next_tag(text, pos) {
        if tag.closing && tag.name == name {
            return Some(tag);
        }
        pos = tag.start + 1;
    }
    None
}

/// Skips the spaces and tabs at byte `from`.
fn skip_blanks(s: &[u8], mut from: usize) -> usize {
    while from < s.len() && (s[from] == b' ' || s[from] == b'\t') {
        from += 1;
    }
    from
}

/// What a scan keeps, before trimming.
struct Scan {
    kept: String,
    removed: bool,
    unclosed: bool,
}

fn scan(text: &str) -> Scan {
    let s = text.as_bytes();
    let mut kept = String::new();
    // Start of the text currently kept.
    let mut seg = 0;
    let mut removed = false;
    let mut unclosed = false;
    let mut pos = 0;
    while let Some(tag) = next_tag(text, pos) {
        removed = true;
        if tag.closing {
            // Rule 3: an orphan closing tag removes everything before it.
            kept.clear();
        } else {
            kept.push_str(&text[seg..tag.start]);
            match closing_tag(text, tag.end, tag.name) {
                // Rule 1: a closed block.
                Some(close) => {
                    seg = skip_blanks(s, close.end);
                    pos = seg;
                    continue;
                }
                // Rule 2: unclosed, everything to the end goes.
                None => {
                    unclosed = true;
                    break;
                }
            }
        }
        seg = skip_blanks(s, tag.end);
        pos = seg;
    }
    if !unclosed {
        kept.push_str(&text[seg..]);
    }
    Scan {
        kept,
        removed,
        unclosed,
    }
}

/// Whitespace as JavaScript's `String.prototype.trim` sees it, so both sides trim alike: Rust's
/// `char::is_whitespace` also counts U+0085 and misses U+FEFF.
fn is_js_space(c: char) -> bool {
    (c.is_whitespace() && c != '\u{85}') || c == '\u{FEFF}'
}

/// `String.prototype.trim` of JavaScript. Every rule shared with the web side trims this way
/// (here and in `local::endpoint`), so both sides agree on U+0085 and U+FEFF.
pub(crate) fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_space)
}

/// Removes reasoning from a whole answer (see the module documentation for the rule).
pub fn strip_reasoning(text: &str) -> Stripped {
    let scan = scan(text);
    if !scan.removed {
        return Stripped {
            text: text.to_string(),
            removed: false,
            unclosed: false,
        };
    }
    Stripped {
        text: js_trim(&scan.kept).to_string(),
        removed: true,
        unclosed: scan.unclosed,
    }
}

/// The answer text the learner may see: reasoning removed. An answer that was nothing but
/// reasoning is an error ("reasoningOnly"), never an empty message.
pub fn visible_answer(text: &str) -> Result<String, AiError> {
    let s = strip_reasoning(text);
    if s.removed && s.text.trim().is_empty() {
        return Err(AiError::BadResponse("reasoningOnly".into()));
    }
    Ok(s.text)
}

/// The text is one whole JSON value.
pub fn is_json(text: &str) -> bool {
    serde_json::from_str::<serde::de::IgnoredAny>(text).is_ok()
}

/// The answer of a structured (JSON schema) request. When it is JSON it is kept exactly as sent:
/// a string value may hold a word like "</think>" that is data, and the rule above would cut the
/// JSON there. Otherwise the rule applies (a reasoning block before the JSON is removed).
pub fn visible_structured(text: &str) -> Result<String, AiError> {
    if is_json(text) {
        return Ok(text.to_string());
    }
    visible_answer(text)
}

/// What a possible tag at the end of a streamed text still waits for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Wait {
    /// "<", "</", "<thi", "</think": the name may still grow (at most a few bytes).
    Name,
    /// "<think type=\"x": an opening tag waiting for its '>'.
    Attrs,
    /// "</think  ": a closing tag waiting for its '>'.
    CloseSpace,
}

/// `t` starts with '<' and holds no other '<': what it waits for while it may still become a
/// reasoning tag, or `None` when it is already a whole tag or can never be one. Either answer is
/// final once `None`: more text cannot make it a possible tag again.
fn partial_wait(t: &[u8]) -> Option<Wait> {
    let mut i = 1;
    let closing = t.get(1) == Some(&b'/');
    if closing {
        i += 1;
    }
    let name_start = i;
    i = name_end(t, i);
    let name = &t[name_start..i];
    if i == t.len() {
        // "<", "</", "<thi", "</think": may still become a tag.
        return NAMES
            .iter()
            .any(|n| n.len() >= name.len() && n.as_bytes()[..name.len()].eq_ignore_ascii_case(name))
            .then_some(Wait::Name);
    }
    if !NAMES
        .iter()
        .any(|n| n.as_bytes().eq_ignore_ascii_case(name))
    {
        return None;
    }
    if closing {
        // "</think  " waiting for '>'.
        t[i..]
            .iter()
            .all(u8::is_ascii_whitespace)
            .then_some(Wait::CloseSpace)
    } else {
        // "<think type=\"x" waiting for '>' (no '>' yet, else the tag is complete).
        (t[i].is_ascii_whitespace() && !t[i..].contains(&b'>')).then_some(Wait::Attrs)
    }
}

/// How the text shown to the learner changes after a piece of a streamed answer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Shown {
    /// Add this text at the end.
    Append(String),
    /// Replace everything shown so far (a late closing tag turned earlier text into reasoning).
    Replace(String),
}

/// The kept text of a stream, with the bounds of its trimmed form kept up to date as it grows.
#[derive(Debug, Default)]
struct Kept {
    text: String,
    /// First byte that is not JavaScript whitespace.
    lead: Option<usize>,
    /// Just after the last byte that is not JavaScript whitespace.
    end: usize,
}

impl Kept {
    fn push(&mut self, s: &str) {
        let base = self.text.len();
        self.text.push_str(s);
        if self.lead.is_none() {
            self.lead = s
                .char_indices()
                .find(|&(_, c)| !is_js_space(c))
                .map(|(i, _)| base + i);
        }
        let content = s.trim_end_matches(is_js_space);
        if !content.is_empty() {
            self.end = base + content.len();
        }
    }

    fn clear(&mut self) {
        *self = Kept::default();
    }

    /// `js_trim(&self.text)`, without reading the text again.
    fn trimmed(&self) -> &str {
        self.lead.map_or("", |l| &self.text[l..self.end])
    }
}

/// [`strip_reasoning`] for an answer that arrives in pieces.
///
/// The scan of [`strip_reasoning`] is run once over the text, resumed where it stopped when a
/// piece arrives: a '<' that cannot change any more (every '<' but a possible tag at the very end)
/// is decided once. Only the last '<' may be held back, and its wait is updated from the new
/// piece alone.
#[derive(Debug, Default)]
pub struct ReasoningStream {
    raw: String,
    /// `raw[..scanned]` is scanned; the rest is a possible tag held back.
    scanned: usize,
    /// Where the scan looks for the next tag.
    pos: usize,
    /// Start of scanned text not yet added to `kept` (outside a block).
    seg: usize,
    /// `seg` follows a closing tag: spaces and tabs there are still removed.
    blanks: bool,
    /// Inside a block opened with this name, waiting for its closing tag.
    block: Option<&'static str>,
    kept: Kept,
    removed: bool,
    /// The last '<' of `raw` and what it waits for, while it may still become a tag.
    held: Option<(usize, Wait)>,
    /// What the learner sees.
    shown: String,
    /// `shown` may no longer be the start of the visible text (the kept text was cleared, or
    /// trimming began): the next change compares the whole text.
    reset: bool,
}

impl ReasoningStream {
    pub fn new() -> Self {
        Self::default()
    }

    /// Everything received so far (reasoning included).
    #[cfg(test)]
    pub fn raw(&self) -> &str {
        &self.raw
    }

    /// What the learner sees now.
    #[cfg(test)]
    pub fn shown(&self) -> &str {
        &self.shown
    }

    fn visible(&self) -> &str {
        if self.removed {
            self.kept.trimmed()
        } else {
            &self.kept.text
        }
    }

    /// Adds a piece; returns how the shown text changes, if it does.
    pub fn push(&mut self, piece: &str) -> Option<Shown> {
        let before = self.raw.len();
        self.raw.push_str(piece);
        let raw = self.raw.as_bytes();
        self.held = match piece.rfind('<') {
            Some(k) => partial_wait(&raw[before + k..]).map(|w| (before + k, w)),
            // The held tag (if any) is still the last '<': only the new piece can change it.
            None => match self.held {
                Some((lt, Wait::Name)) => partial_wait(&raw[lt..]).map(|w| (lt, w)),
                Some((lt, Wait::Attrs)) => (!piece.contains('>')).then_some((lt, Wait::Attrs)),
                Some((lt, Wait::CloseSpace)) => piece
                    .bytes()
                    .all(|b| b.is_ascii_whitespace())
                    .then_some((lt, Wait::CloseSpace)),
                None => None,
            },
        };
        let upto = self.held.map_or(self.raw.len(), |(lt, _)| lt);
        self.advance(upto);
        self.change()
    }

    /// Continues the scan of [`scan`] up to byte `upto` of `raw`.
    fn advance(&mut self, upto: usize) {
        if upto <= self.scanned {
            return;
        }
        let text = &self.raw[..upto];
        let s = text.as_bytes();
        loop {
            if let Some(name) = self.block {
                match closing_tag(text, self.pos, name) {
                    // Rule 1: the block is closed.
                    Some(close) => {
                        self.block = None;
                        self.seg = close.end;
                        self.pos = close.end;
                        self.blanks = true;
                    }
                    // Rule 2 so far: everything from the opening tag is left out.
                    None => {
                        self.pos = upto;
                        break;
                    }
                }
            }
            if self.blanks {
                self.seg = skip_blanks(s, self.seg);
                self.pos = self.pos.max(self.seg);
                // Spaces arriving with the next piece are still removed.
                self.blanks = self.seg == upto;
            }
            match next_tag(text, self.pos) {
                None => {
                    self.kept.push(&text[self.seg..]);
                    self.seg = upto;
                    self.pos = upto;
                    break;
                }
                Some(tag) => {
                    if !self.removed {
                        self.removed = true;
                        self.reset = true;
                    }
                    if tag.closing {
                        // Rule 3: an orphan closing tag removes everything before it.
                        self.kept.clear();
                        self.reset = true;
                        self.blanks = true;
                    } else {
                        self.kept.push(&text[self.seg..tag.start]);
                        self.block = Some(tag.name);
                    }
                    self.seg = tag.end;
                    self.pos = tag.end;
                }
            }
        }
        self.scanned = upto;
    }

    /// The change to what is shown since the last piece.
    fn change(&mut self) -> Option<Shown> {
        if std::mem::take(&mut self.reset) {
            let now = self.visible().to_string();
            return self.show(now);
        }
        // The kept text only grew, so `shown` is the start of the visible text and the new part
        // is what follows it. No comparison of the whole text: long answers stay linear.
        let now = self.visible();
        match now.get(self.shown.len()..) {
            Some("") => None,
            Some(added) => {
                let added = added.to_string();
                self.shown.push_str(&added);
                Some(Shown::Append(added))
            }
            None => {
                let now = now.to_string();
                self.show(now)
            }
        }
    }

    fn show(&mut self, now: String) -> Option<Shown> {
        if now == self.shown {
            return None;
        }
        let change = if now.starts_with(self.shown.as_str()) {
            Shown::Append(now[self.shown.len()..].to_string())
        } else {
            Shown::Replace(now.clone())
        };
        self.shown = now;
        Some(change)
    }

    /// The end of the answer: the final text (exactly [`strip_reasoning`] of everything
    /// received) and the last change to what is shown.
    pub fn finish(&mut self) -> (Stripped, Option<Shown>) {
        let all = strip_reasoning(&self.raw);
        let change = self.show(all.text.clone());
        (all, change)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const FIXTURE: &str = include_str!("../../../tests/fixtures/reasoning-strip.json");

    struct Case {
        name: String,
        input: String,
        text: String,
        removed: bool,
        unclosed: bool,
    }

    fn cases() -> Vec<Case> {
        let v: Value = serde_json::from_str(FIXTURE).expect("fixture is JSON");
        v["cases"]
            .as_array()
            .expect("cases")
            .iter()
            .map(|c| Case {
                name: c["name"].as_str().unwrap().to_string(),
                input: c["input"].as_str().unwrap().to_string(),
                text: c["text"].as_str().unwrap().to_string(),
                removed: c["removed"].as_bool().unwrap(),
                unclosed: c["unclosed"].as_bool().unwrap(),
            })
            .collect()
    }

    #[test]
    fn every_shared_vector_passes() {
        let all = cases();
        assert!(all.len() >= 19, "fixture lost cases");
        for c in all {
            let got = strip_reasoning(&c.input);
            assert_eq!(got.text, c.text, "text of '{}'", c.name);
            assert_eq!(got.removed, c.removed, "removed of '{}'", c.name);
            assert_eq!(got.unclosed, c.unclosed, "unclosed of '{}'", c.name);
        }
    }

    #[test]
    fn the_name_bound_is_the_longest_name() {
        assert_eq!(NAMES.iter().map(|n| n.len()).max(), Some(MAX_NAME));
        // A word longer than any name after '<' is never a tag.
        let s = strip_reasoning("a <reflections> b <reflection>c</reflection>d");
        assert_eq!(s.text, "a <reflections> b d");
    }

    #[test]
    fn reasoning_only_answers_are_errors_and_plain_answers_are_unchanged() {
        assert!(matches!(
            visible_answer("<think>chỉ có nháp</think>"),
            Err(AiError::BadResponse(ref m)) if m == "reasoningOnly"
        ));
        assert!(matches!(
            visible_answer("<think>bị cắt giữa chừng"),
            Err(AiError::BadResponse(ref m)) if m == "reasoningOnly"
        ));
        assert_eq!(visible_answer("  Lực  ").unwrap(), "  Lực  ");
        assert_eq!(
            visible_answer("<think>x</think> Đáp số 12 N.").unwrap(),
            "Đáp số 12 N."
        );
    }

    /// Byte index of a possible tag held back at the end of `raw`, or `raw.len()`.
    fn partial_tag_start(raw: &str) -> usize {
        match raw.rfind('<') {
            Some(lt) if partial_wait(&raw.as_bytes()[lt..]).is_some() => lt,
            _ => raw.len(),
        }
    }

    /// A complete reasoning tag, or the start of one at the end.
    fn reasoning_tag_in(s: &str) -> bool {
        next_tag(s, 0).is_some() || partial_tag_start(s) < s.len()
    }

    /// What the stream must show for `raw`, computed the slow way (whole text every time).
    fn slow_visible(raw: &str) -> String {
        let sc = scan(&raw[..partial_tag_start(raw)]);
        if sc.removed {
            js_trim(&sc.kept).to_string()
        } else {
            sc.kept
        }
    }

    fn apply(change: Option<Shown>, screen: &mut String) {
        match change {
            Some(Shown::Append(t)) => screen.push_str(&t),
            Some(Shown::Replace(t)) => *screen = t,
            None => {}
        }
    }

    /// Feeds `pieces` and returns every text the learner saw, then the final text.
    fn play(pieces: &[&str]) -> (Vec<String>, String) {
        let mut st = ReasoningStream::new();
        let mut screen = String::new();
        let mut seen = Vec::new();
        for p in pieces {
            let change = st.push(p);
            apply(change, &mut screen);
            assert_eq!(screen, st.shown(), "screen and stream agree");
            // The fast path gives what a full rescan gives.
            assert_eq!(screen, slow_visible(st.raw()), "after {p:?}");
            seen.push(screen.clone());
        }
        let (all, change) = st.finish();
        apply(change, &mut screen);
        assert_eq!(screen, all.text);
        (seen, screen)
    }

    fn char_pieces(s: &str) -> Vec<&str> {
        s.char_indices()
            .map(|(i, c)| &s[i..i + c.len_utf8()])
            .collect()
    }

    #[test]
    fn streaming_gives_the_same_final_text_at_every_split() {
        for c in cases() {
            // One character at a time.
            let (seen, last) = play(&char_pieces(&c.input));
            assert_eq!(last, c.text, "char by char: '{}'", c.name);
            // Every split into two pieces.
            for (i, _) in c.input.char_indices().skip(1) {
                let (a, b) = c.input.split_at(i);
                let (_, last) = play(&[a, b]);
                assert_eq!(last, c.text, "split at {i}: '{}'", c.name);
            }
            // A reasoning tag never reaches the screen, and before the end the screen only
            // shows the start of the final answer (an orphan closing tag is the exception: the
            // text before it could not be known to be reasoning).
            if !c.name.contains("orphan") {
                for s in &seen {
                    assert!(!reasoning_tag_in(s), "tag shown in '{}': {s:?}", c.name);
                    assert!(
                        js_trim(&c.text).starts_with(js_trim(s)),
                        "'{}' showed {s:?}",
                        c.name
                    );
                }
            }
        }
    }

    #[test]
    fn text_inside_a_block_is_never_shown_while_streaming() {
        let answer = "Ta có <think>BÍ MẬT: thử 3 kg</think> a = F/m = 5 m/s². \
                      <Thinking type=\"x\">BÍ MẬT nữa</Thinking>Xong. <reasoning>BÍ MẬT bị cắt";
        let pieces = char_pieces(answer);
        let (seen, last) = play(&pieces);
        assert_eq!(last, "Ta có a = F/m = 5 m/s². Xong.");
        for s in seen {
            assert!(!s.contains("BÍ MẬT"), "reasoning shown: {s:?}");
            assert!(!reasoning_tag_in(&s), "tag shown: {s:?}");
        }
        // Pieces of several characters, as runtimes really send them.
        let chunks: Vec<&str> = vec![
            "Ta có <th",
            "ink>BÍ MẬT: thử",
            " 3 kg</thi",
            "nk> a = F/m = 5 m/s². <Thinking type=\"x\">BÍ ",
            "MẬT nữa</Thinking>Xong. <reasoning>BÍ MẬT bị cắt",
        ];
        let (seen, last) = play(&chunks);
        assert_eq!(last, "Ta có a = F/m = 5 m/s². Xong.");
        assert!(seen.iter().all(|s| !s.contains("BÍ MẬT")));
    }

    #[test]
    fn a_late_orphan_closing_tag_replaces_what_was_shown() {
        let mut st = ReasoningStream::new();
        assert_eq!(
            st.push("Người dùng hỏi"),
            Some(Shown::Append("Người dùng hỏi".into()))
        );
        assert_eq!(
            st.push(" về lực.</think>\nLực là"),
            Some(Shown::Replace("Lực là".into()))
        );
        assert_eq!(
            st.push(" tác dụng."),
            Some(Shown::Append(" tác dụng.".into()))
        );
        let (all, change) = st.finish();
        assert_eq!(all.text, "Lực là tác dụng.");
        assert_eq!(change, None);
    }

    #[test]
    fn plain_text_streams_piece_by_piece_and_inequalities_are_not_held() {
        let mut st = ReasoningStream::new();
        assert_eq!(st.push("Nếu $x"), Some(Shown::Append("Nếu $x".into())));
        // "<" alone may become a tag: held back until the next piece.
        assert_eq!(st.push("<"), None);
        assert_eq!(st.push("y$ thì"), Some(Shown::Append("<y$ thì".into())));
        assert_eq!(st.raw(), "Nếu $x<y$ thì");
        assert_eq!(st.finish().0.text, "Nếu $x<y$ thì");
    }

    #[test]
    fn a_held_back_tag_start_appears_when_the_answer_ends() {
        let mut st = ReasoningStream::new();
        st.push("Kết thúc <thi");
        assert_eq!(st.shown(), "Kết thúc ");
        let (all, change) = st.finish();
        assert_eq!(all.text, "Kết thúc <thi");
        assert_eq!(change, Some(Shown::Append("<thi".into())));
    }

    #[test]
    fn spaces_after_a_closing_tag_are_removed_even_when_they_arrive_later() {
        let (_, last) = play(&["A <think>b</think>", "  ", "\tC"]);
        assert_eq!(last, "A C");
    }

    #[test]
    fn long_answers_stream_in_linear_time() {
        // 200 000 pieces of plain text: the fast path never rescans the whole answer.
        let mut st = ReasoningStream::new();
        let started = std::time::Instant::now();
        for _ in 0..200_000 {
            st.push("ab ");
        }
        assert_eq!(st.shown().len(), 600_000);
        assert!(started.elapsed() < std::time::Duration::from_secs(5));
    }

    /// Streams `pieces` without the slow checks; returns the final text and the time it took.
    fn timed(pieces: impl Iterator<Item = String>) -> (String, String, std::time::Duration) {
        let mut st = ReasoningStream::new();
        let mut screen = String::new();
        let started = std::time::Instant::now();
        for p in pieces {
            let change = st.push(&p);
            apply(change, &mut screen);
        }
        let (all, change) = st.finish();
        apply(change, &mut screen);
        let took = started.elapsed();
        assert_eq!(screen, all.text);
        (all.text, st.raw().to_string(), took)
    }

    #[test]
    fn pieces_with_tag_marks_stream_in_linear_time() {
        let n = 16_384;
        let rep = |p: &'static str| std::iter::repeat_n(p.to_string(), n);
        let cases: Vec<(&str, Vec<String>)> = vec![
            // HTML, XML or inequalities: a '<' in every piece (64 KB).
            ("a<b in every piece", rep("a<b ").collect()),
            // The same inside a reasoning block that closes at the end.
            (
                "inside a block",
                std::iter::once("<think>".to_string())
                    .chain(rep("a<b "))
                    .chain(std::iter::once("</think> Xong.".to_string()))
                    .collect(),
            ),
            // A '<' followed by a very long word.
            (
                "long word after '<'",
                std::iter::once("<".to_string())
                    .chain(rep("abcd"))
                    .collect(),
            ),
            // An opening tag whose '>' never comes (held back the whole time).
            (
                "unfinished attributes",
                std::iter::once("Đáp <think ".to_string())
                    .chain(rep("x=1 "))
                    .collect(),
            ),
            // A closing tag waiting for its '>' behind many spaces.
            (
                "unfinished closing tag",
                std::iter::once("A </think".to_string())
                    .chain(rep("    "))
                    .collect(),
            ),
            // Many orphan closing tags, each one taking back what was shown.
            ("orphan closing tags", rep("x</think>").collect()),
            // Many short blocks.
            ("short blocks", rep("a<think>b</think>").collect()),
        ];
        for (name, pieces) in cases {
            let (text, raw, took) = timed(pieces.into_iter());
            assert_eq!(text, strip_reasoning(&raw).text, "{name}");
            assert!(
                took < std::time::Duration::from_secs(1),
                "{name}: {took:?} for {} bytes",
                raw.len()
            );
        }
    }

    /// A small deterministic generator (no new crate for tests).
    struct Lcg(u64);

    impl Lcg {
        fn below(&mut self, n: usize) -> usize {
            self.0 = self
                .0
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1_442_695_040_888_963_407);
            ((self.0 >> 33) as usize) % n
        }
    }

    #[test]
    fn random_streams_match_a_full_rescan_after_every_piece() {
        const PARTS: [&str; 24] = [
            "<",
            "</",
            ">",
            "think",
            "Think",
            "THINKING",
            "reasoning",
            "reflection",
            "er",
            " ",
            "\t",
            "\n",
            "a",
            "Lực",
            "ố",
            "$x<y$",
            " type=\"x\"",
            "<think>",
            "</think>",
            "<reasoning>",
            "</reasoning>",
            "\u{FEFF}",
            "\u{85}",
            "<thinker>",
        ];
        let mut rng = Lcg(0x5EED);
        for case in 0..3000 {
            let len = 1 + rng.below(24);
            let text: String = (0..len).map(|_| PARTS[rng.below(PARTS.len())]).collect();
            // Random cuts at character boundaries.
            let bounds: Vec<usize> = text.char_indices().map(|(i, _)| i).skip(1).collect();
            let mut cuts: Vec<usize> = bounds
                .iter()
                .copied()
                .filter(|_| rng.below(3) == 0)
                .collect();
            cuts.push(text.len());
            let mut pieces = Vec::new();
            let mut from = 0;
            for c in cuts {
                pieces.push(&text[from..c]);
                from = c;
            }
            let (_, last) = play(&pieces);
            assert_eq!(last, strip_reasoning(&text).text, "case {case}: {text:?}");
        }
    }
}
