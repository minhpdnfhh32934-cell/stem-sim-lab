//! Removes a model's internal reasoning ("<think>…</think>" and friends) from an answer before it
//! reaches the page, so the chat, the board and the voice only ever get learning content.
//!
//! One rule, shared with the web side (src/ai/reasoning.ts) and pinned by the vectors in
//! tests/fixtures/reasoning-strip.json (both sides test every vector, read the "about" fields):
//!
//! Tag names: `think`, `thinking`, `reasoning`, `reflection`, ASCII case-insensitive, with
//! optional attributes (`<think type="x">`). A name followed by more letters (`<thinker>`) is not
//! a tag, and neither is `<y` in `$x<y$`. `<think/>` and `<think />` are self-closing: an empty
//! block.
//!
//! Code: a closed code fence (a line of at least three backticks or tildes, closed by a later line
//! of at least as many of the same mark) and inline code (`…` on one line) are found first
//! ([`code_spans`]). An opening or self-closing tag in code is code, not reasoning; so is a closing
//! tag in code once an opening tag of the same name was written in code before it. Any other
//! closing tag counts even in code (it ends a block, or marks reasoning whose opening tag a chat
//! template pre-filled); when it is all its code span holds ("`</think>`", or a fence holding only
//! it), the backticks or fence lines go with it.
//!
//! 1. Every closed block `<name …>…</name>` (same name; the first such closing tag) is removed,
//!    together with the spaces or tabs right after it. A self-closing tag is an empty block.
//! 2. An opening tag left without its closing tag: everything from it to the end is removed
//!    (`unclosed`).
//! 3. A closing tag outside a block (no opening tag left for it, e.g. a chat template that
//!    pre-filled the opening tag): everything up to and including it is removed, plus the spaces
//!    or tabs after it (the LAST such tag wins).
//! 4. When anything was removed, leading and trailing whitespace is trimmed; when nothing was
//!    removed the text is returned unchanged.
//!
//! Rust regexes have no backreferences (and the crate has no regex dependency), so the text is
//! scanned by hand. Every byte the rule looks at is ASCII, so byte indices here find the same
//! places as the UTF-16 indices of the web side.
//!
//! [`ReasoningStream`] applies the same rule to an answer that arrives in pieces: reasoning that
//! is inside a block is never shown, a piece that may be the start of a tag is held back until it
//! is complete, a tag that may still turn out to be code (inside a fence or after a backtick still
//! waiting for their end) holds back everything from it until that is decided, and the final text
//! is always exactly [`strip_reasoning`] of everything received. It keeps its place between pieces
//! (each byte is scanned a bounded number of times), so a long answer full of '<' (HTML, XML,
//! inequalities) or backticks still streams in linear time.
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

const NL: u8 = b'\n';
const BACKTICK: u8 = b'`';
const TILDE: u8 = b'~';

/// Reads the letters of a possible tag name from `i`, at most one more than [`MAX_NAME`] (enough
/// to know the word is not a name). Returns the index after them.
fn name_end(s: &[u8], mut i: usize) -> usize {
    let start = i;
    while i < s.len() && i - start <= MAX_NAME && s[i].is_ascii_alphabetic() {
        i += 1;
    }
    i
}

/// The index in [`NAMES`] of the name written as `word`, if it is one.
fn name_index(word: &[u8]) -> Option<usize> {
    NAMES
        .iter()
        .position(|n| n.as_bytes().eq_ignore_ascii_case(word))
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

/// What a reasoning tag is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Open,
    Close,
    /// Self-closing (`<think/>`, `<think />`): an empty block.
    Empty,
}

/// A reasoning tag found in the text.
#[derive(Debug, Clone, Copy)]
struct Tag {
    /// Byte index of its '<'.
    start: usize,
    /// Byte index just after its '>'.
    end: usize,
    /// Index of its name in [`NAMES`].
    name: usize,
    kind: Kind,
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
    let name = name_index(&s[name_start..i])?;
    let tag = |end: usize, kind: Kind| Tag {
        start: at,
        end,
        name,
        kind,
    };
    if closing {
        while i < s.len() && s[i].is_ascii_whitespace() {
            i += 1;
        }
        return (s.get(i) == Some(&b'>')).then(|| tag(i + 1, Kind::Close));
    }
    match *s.get(i)? {
        b'>' => Some(tag(i + 1, Kind::Open)),
        b'/' => (s.get(i + 1) == Some(&b'>')).then(|| tag(i + 2, Kind::Empty)),
        c if c.is_ascii_whitespace() => {
            // Attributes run to the next '>'; another '<' first means this is not a tag. A '/'
            // right before the '>' (blanks aside) makes it self-closing.
            let k = i + s[i..].iter().position(|&b| b == b'>' || b == b'<')?;
            if s[k] != b'>' {
                return None;
            }
            let mut last = k - 1;
            while last > i && s[last].is_ascii_whitespace() {
                last -= 1;
            }
            let kind = if s[last] == b'/' {
                Kind::Empty
            } else {
                Kind::Open
            };
            Some(tag(k + 1, kind))
        }
        _ => None,
    }
}

/// The next reasoning tag at or after byte `from`.
fn next_tag(text: &str, from: usize) -> Option<Tag> {
    let s = text.as_bytes();
    let mut pos = from;
    while let Some(k) = s.get(pos..).and_then(|t| t.iter().position(|&b| b == b'<')) {
        if let Some(tag) = tag_at(s, pos + k) {
            return Some(tag);
        }
        pos += k + 1;
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

// ------------------------------------------------------------------------------------- code

/// Inline code or a closed code fence.
#[derive(Debug, Clone, PartialEq, Eq)]
struct CodeSpan {
    /// The span with its dressing: from the first backtick (fence: its first line's start)…
    start: usize,
    /// …to just after the last backtick (fence: the end of its closing line, before its "\n").
    end: usize,
    /// A tag whose '<' is in `from..to` is in code (inline: between the backticks; fence: all).
    from: usize,
    to: usize,
    /// First and last index of the content that is not a space, tab, CR or LF.
    first: Option<usize>,
    last: Option<usize>,
}

/// Blank in code content: a span holding only a tag and these holds only the tag.
fn is_content_space(c: u8) -> bool {
    matches!(c, b' ' | b'\t' | b'\n' | b'\r')
}

/// The content bounds of `s[from..to]`.
fn content_bounds(s: &[u8], from: usize, to: usize) -> (Option<usize>, Option<usize>) {
    let mut first = None;
    let mut last = None;
    for (k, &c) in s[from..to].iter().enumerate() {
        if is_content_space(c) {
            continue;
        }
        first.get_or_insert(from + k);
        last = Some(from + k);
    }
    (first, last)
}

/// A line of only blanks, at least `run` of `mark`, then spaces, tabs or a CR.
fn closes_fence(s: &[u8], from: usize, to: usize, mark: u8, run: usize) -> bool {
    let start = skip_blanks(&s[..to], from);
    let mut k = start;
    while k < to && s[k] == mark {
        k += 1;
    }
    k - start >= run && s[k..to].iter().all(|&c| matches!(c, b' ' | b'\t' | b'\r'))
}

/// The index of `b` at or after `from`, if any.
fn find_from(s: &[u8], from: usize, b: u8) -> Option<usize> {
    s.get(from..)?
        .iter()
        .position(|&c| c == b)
        .map(|k| from + k)
}

/// What [`fence_at`] found.
enum Fence {
    /// Text still arrives and the closing line may still come.
    Open,
    Closed(CodeSpan),
}

/// The closed fence opening at the line starting at `line_start`. `failed` remembers, per mark,
/// the shortest run that found no closing line: a longer one later cannot find one either.
fn fence_at(s: &[u8], line_start: usize, partial: bool, failed: &mut [usize; 2]) -> Option<Fence> {
    let n = s.len();
    let k = skip_blanks(s, line_start);
    let mark = *s.get(k)?;
    let slot = match mark {
        BACKTICK => 0,
        TILDE => 1,
        _ => return None,
    };
    let mut r = k;
    while r < n && s[r] == mark {
        r += 1;
    }
    let run = r - k;
    if run < 3 {
        return None;
    }
    let Some(eol) = find_from(s, r, NL) else {
        return partial.then_some(Fence::Open);
    };
    if !partial && run >= failed[slot] {
        return None;
    }
    let mut first = None;
    let mut last = None;
    let mut ls = eol + 1;
    loop {
        let (le, complete) = find_from(s, ls, NL).map_or((n, false), |le| (le, true));
        // While text still arrives (`partial`), only a whole line closes a fence.
        if (complete || !partial) && closes_fence(s, ls, le, mark, run) {
            return Some(Fence::Closed(CodeSpan {
                start: line_start,
                end: le,
                from: line_start,
                to: le,
                first,
                last,
            }));
        }
        if !complete {
            break;
        }
        let (f, l) = content_bounds(s, ls, le);
        if f.is_some() {
            first = first.or(f);
            last = l;
        }
        ls = le + 1;
    }
    if partial {
        return Some(Fence::Open);
    }
    failed[slot] = failed[slot].min(run);
    None
}

/// The code spans of a text, in order: at a line start a fence is tried first, otherwise a
/// backtick starts inline code that ends at the next backtick on the same line (`` `` `` holds
/// nothing, so its second backtick may start one). With `partial` (text still arriving), the
/// second value is where code that is not decided yet starts (a fence or a backtick still waiting
/// for its end); otherwise, or when there is none, it is the text's length.
fn code_spans(s: &[u8], partial: bool) -> (Vec<CodeSpan>, usize) {
    let n = s.len();
    let mut spans = Vec::new();
    let mut failed = [usize::MAX; 2];
    let mut i = 0;
    while i < n {
        if i == 0 || s[i - 1] == NL {
            match fence_at(s, i, partial, &mut failed) {
                Some(Fence::Open) => return (spans, i),
                Some(Fence::Closed(fence)) => {
                    i = fence.end;
                    spans.push(fence);
                    continue;
                }
                None => {}
            }
        }
        if s[i] != BACKTICK {
            i += 1;
            continue;
        }
        let mut j = i + 1;
        while j < n && s[j] != BACKTICK && s[j] != NL {
            j += 1;
        }
        if j < n && s[j] == BACKTICK && j > i + 1 {
            let (first, last) = content_bounds(s, i + 1, j);
            spans.push(CodeSpan {
                start: i,
                end: j + 1,
                from: i + 1,
                to: j,
                first,
                last,
            });
            i = j + 1;
            continue;
        }
        if j == n && partial {
            return (spans, i);
        }
        // A newline ends the attempt; a second backtick right away may start the next one.
        i = j;
    }
    (spans, n)
}

/// Where the current line stands for a fence: blanks only, a run of one mark, its trail, other.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
enum Phase {
    #[default]
    Indent,
    Run,
    Trail,
    Rest,
}

/// An opened fence waiting for its closing line.
#[derive(Debug, Clone, Copy)]
struct OpenFence {
    mark: u8,
    run: usize,
    start: usize,
    first: Option<usize>,
    last: Option<usize>,
}

/// `code_spans(text, true)` kept up to date as text arrives, reading each byte once: the closed
/// code spans so far, and where undecided code starts ([`CodeTracker::open`]).
#[derive(Debug, Default)]
struct CodeTracker {
    /// Closed spans, in order.
    spans: Vec<CodeSpan>,
    pos: usize,
    line_start: usize,
    phase: Phase,
    mark: u8,
    run: usize,
    /// The current line opens a fence (a run of three or more marks after blanks).
    opening: bool,
    /// A backtick on this line waiting for its pair, and the content's bounds after it.
    tick: Option<usize>,
    tick_first: Option<usize>,
    tick_last: Option<usize>,
    fence: Option<OpenFence>,
    /// In a fence: the content bounds of the current line (content unless it closes the fence).
    line_first: Option<usize>,
    line_last: Option<usize>,
}

impl CodeTracker {
    /// Start of the first code that is not decided yet (the text's length when none).
    fn open(&self) -> usize {
        if let Some(fence) = &self.fence {
            return fence.start;
        }
        if self.opening {
            return self.line_start;
        }
        self.tick.unwrap_or(self.pos)
    }

    fn push(&mut self, piece: &[u8]) {
        for (k, &c) in piece.iter().enumerate() {
            self.byte(c, self.pos + k);
        }
        self.pos += piece.len();
    }

    fn new_line(&mut self, p: usize) {
        self.line_start = p + 1;
        self.phase = Phase::Indent;
        self.run = 0;
        self.line_first = None;
        self.line_last = None;
    }

    fn byte(&mut self, c: u8, p: usize) {
        if let Some(fence) = self.fence.take() {
            self.fence = self.in_fence(c, p, fence);
            return;
        }
        if c == NL {
            if self.opening {
                self.fence = Some(OpenFence {
                    mark: self.mark,
                    run: self.run,
                    start: self.line_start,
                    first: None,
                    last: None,
                });
                self.opening = false;
            }
            self.tick = None;
            self.new_line(p);
            return;
        }
        // A fence opening: blanks, then three or more of one mark (the rest of the line is its
        // info).
        match self.phase {
            Phase::Indent if c == BACKTICK || c == TILDE => {
                self.phase = Phase::Run;
                self.mark = c;
                self.run = 1;
            }
            Phase::Indent if c != b' ' && c != b'\t' => self.phase = Phase::Rest,
            Phase::Run if c == self.mark => {
                self.run += 1;
                if self.run == 3 {
                    self.opening = true;
                    self.tick = None;
                }
            }
            Phase::Run => self.phase = Phase::Rest,
            _ => {}
        }
        if self.opening {
            return;
        }
        // Inline code: a backtick, then the next one on the same line with something between.
        if c == BACKTICK {
            match self.tick {
                Some(t) if p > t + 1 => {
                    self.spans.push(CodeSpan {
                        start: t,
                        end: p + 1,
                        from: t + 1,
                        to: p,
                        first: self.tick_first,
                        last: self.tick_last,
                    });
                    self.tick = None;
                }
                _ => {
                    self.tick = Some(p);
                    self.tick_first = None;
                    self.tick_last = None;
                }
            }
        } else if self.tick.is_some() && !is_content_space(c) {
            self.tick_first.get_or_insert(p);
            self.tick_last = Some(p);
        }
    }

    /// One byte inside an opened fence; returns the fence while it stays open.
    fn in_fence(&mut self, c: u8, p: usize, mut fence: OpenFence) -> Option<OpenFence> {
        if c == NL {
            let closes = matches!(self.phase, Phase::Run | Phase::Trail) && self.run >= fence.run;
            let next = if closes {
                self.spans.push(CodeSpan {
                    start: fence.start,
                    end: p,
                    from: fence.start,
                    to: p,
                    first: fence.first,
                    last: fence.last,
                });
                None
            } else {
                if self.line_first.is_some() {
                    fence.first = fence.first.or(self.line_first);
                    fence.last = self.line_last;
                }
                Some(fence)
            };
            self.new_line(p);
            return next;
        }
        // The closing line: blanks, at least as many of the mark, then spaces, tabs or a CR.
        let trail = matches!(c, b' ' | b'\t' | b'\r');
        match self.phase {
            Phase::Indent if c == fence.mark => {
                self.phase = Phase::Run;
                self.run = 1;
            }
            Phase::Indent if c != b' ' && c != b'\t' => self.phase = Phase::Rest,
            Phase::Run if c == fence.mark => self.run += 1,
            Phase::Run => self.phase = if trail { Phase::Trail } else { Phase::Rest },
            Phase::Trail if !trail => self.phase = Phase::Rest,
            _ => {}
        }
        if !is_content_space(c) {
            self.line_first.get_or_insert(p);
            self.line_last = Some(p);
        }
        Some(fence)
    }
}

/// What a tag is in its text.
struct Placed {
    /// Written as code: not reasoning.
    inert: bool,
    /// What goes with the tag: the tag, or its whole code span when the span holds only it.
    cut_start: usize,
    cut_end: usize,
}

/// Places tags one by one, in order, against the code spans: an opening or self-closing tag in
/// code is code, and so is a closing tag in code after an opening tag of the same name in code.
#[derive(Debug, Default)]
struct TagPlacer {
    next: usize,
    opened_in_code: [bool; NAMES.len()],
}

impl TagPlacer {
    fn place(&mut self, spans: &[CodeSpan], tag: &Tag) -> Placed {
        while spans.get(self.next).is_some_and(|s| s.end <= tag.start) {
            self.next += 1;
        }
        let mut placed = Placed {
            inert: false,
            cut_start: tag.start,
            cut_end: tag.end,
        };
        let Some(span) = spans.get(self.next) else {
            return placed;
        };
        if tag.start < span.from || tag.start >= span.to {
            return placed;
        }
        match tag.kind {
            Kind::Open => {
                self.opened_in_code[tag.name] = true;
                placed.inert = true;
            }
            Kind::Empty => placed.inert = true,
            Kind::Close if self.opened_in_code[tag.name] => placed.inert = true,
            Kind::Close => {
                if span.first == Some(tag.start) && span.last == Some(tag.end - 1) {
                    placed.cut_start = span.start;
                    placed.cut_end = span.end;
                }
            }
        }
        placed
    }
}

// ------------------------------------------------------------------------------------- the rule

/// What a scan keeps, before trimming.
struct Scan {
    kept: String,
    removed: bool,
    unclosed: bool,
}

fn scan(text: &str) -> Scan {
    let s = text.as_bytes();
    let (spans, _) = code_spans(s, false);
    let mut placer = TagPlacer::default();
    let mut kept = String::new();
    // Start of the text currently kept.
    let mut seg = 0;
    let mut removed = false;
    let mut block: Option<usize> = None;
    let mut pos = 0;
    while let Some(tag) = next_tag(text, pos) {
        pos = tag.end;
        let placed = placer.place(&spans, &tag);
        if placed.inert {
            continue;
        }
        if let Some(name) = block {
            if tag.name == name && tag.kind == Kind::Close {
                // Rule 1: the block is closed.
                block = None;
                seg = skip_blanks(s, placed.cut_end);
            }
            continue;
        }
        removed = true;
        match tag.kind {
            Kind::Close => {
                // Rule 3: an orphan closing tag removes everything before it.
                kept.clear();
                seg = skip_blanks(s, placed.cut_end);
            }
            Kind::Empty => {
                kept.push_str(&text[seg..placed.cut_start.max(seg)]);
                seg = skip_blanks(s, placed.cut_end);
            }
            Kind::Open => {
                kept.push_str(&text[seg..placed.cut_start.max(seg)]);
                block = Some(tag.name);
            }
        }
    }
    // Rule 2: an unclosed block takes everything after its opening tag.
    if block.is_none() {
        kept.push_str(&text[seg..]);
    }
    Scan {
        kept,
        removed,
        unclosed: block.is_some(),
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
    /// "<think type=\"x": an opening (or self-closing) tag waiting for its '>'.
    Attrs,
    /// "</think  ": a closing tag waiting for its '>'.
    CloseSpace,
    /// "<think/": a self-closing tag waiting for its '>'.
    Slash,
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
    name_index(name)?;
    if closing {
        // "</think  " waiting for '>'.
        return t[i..]
            .iter()
            .all(u8::is_ascii_whitespace)
            .then_some(Wait::CloseSpace);
    }
    if t[i] == b'/' {
        // "<think/" waiting for '>' ("<think/x" is never a tag).
        return (i + 1 == t.len()).then_some(Wait::Slash);
    }
    // "<think type=\"x" waiting for '>' (no '>' yet, else the tag is complete).
    (t[i].is_ascii_whitespace() && !t[i..].contains(&b'>')).then_some(Wait::Attrs)
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
/// piece alone. Code is tracked byte by byte ([`CodeTracker`]); the scan stops at a tag that may
/// still turn out to be code and resumes once the code before it is decided.
#[derive(Debug, Default)]
pub struct ReasoningStream {
    raw: String,
    /// `raw[..scanned]` is scanned; the rest is held back.
    scanned: usize,
    /// Where the scan looks for the next tag.
    pos: usize,
    /// Start of scanned text not yet added to `kept` (outside a block).
    seg: usize,
    /// `seg` follows a closing tag: spaces and tabs there are still removed.
    blanks: bool,
    /// Inside a block opened with this name (index in [`NAMES`]), waiting for its closing tag.
    block: Option<usize>,
    kept: Kept,
    removed: bool,
    /// The last '<' of `raw` and what it waits for, while it may still become a tag.
    held: Option<(usize, Wait)>,
    /// Code spans as text arrives, and the tags placed against them.
    code: CodeTracker,
    placer: TagPlacer,
    /// The scan stopped at the tag starting here: it may still turn out to be code.
    stop: Option<usize>,
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
        self.code.push(piece.as_bytes());
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
                // Its '>' completes it, anything else ends it: either way it is decided.
                Some((_, Wait::Slash)) | None => None,
            },
        };
        let upto = self.held.map_or(self.raw.len(), |(lt, _)| lt);
        // A stop waits until the code before its tag is decided.
        if self.stop.map_or(true, |stop| self.code.open() > stop) {
            self.advance(upto);
        }
        self.change()
    }

    /// Continues the scan of [`scan`] up to byte `upto` of `raw`, stopping at a tag that may
    /// still be code.
    fn advance(&mut self, upto: usize) {
        if self.stop.is_none() && upto <= self.scanned {
            return;
        }
        self.stop = None;
        let text = &self.raw[..upto];
        let s = text.as_bytes();
        let open = self.code.open();
        let mut stop = None;
        'scan: loop {
            if let Some(name) = self.block {
                let mut closed = false;
                while let Some(tag) = next_tag(text, self.pos) {
                    if tag.start >= open {
                        stop = Some(tag.start);
                        self.pos = tag.start;
                        break 'scan;
                    }
                    let placed = self.placer.place(&self.code.spans, &tag);
                    self.pos = tag.end;
                    if placed.inert || tag.kind != Kind::Close || tag.name != name {
                        continue;
                    }
                    // Rule 1: the block is closed.
                    self.block = None;
                    self.seg = placed.cut_end;
                    self.pos = placed.cut_end;
                    self.blanks = true;
                    closed = true;
                    break;
                }
                if !closed {
                    // Rule 2 so far: everything from the opening tag is left out.
                    self.pos = upto;
                    break;
                }
            }
            if self.blanks {
                self.seg = skip_blanks(s, self.seg);
                self.pos = self.pos.max(self.seg);
                // Spaces arriving with the next piece are still removed.
                self.blanks = self.seg == upto;
            }
            let Some(tag) = next_tag(text, self.pos) else {
                self.kept.push(&text[self.seg..]);
                self.seg = upto;
                self.pos = upto;
                break;
            };
            if tag.start >= open {
                self.kept.push(&text[self.seg..tag.start]);
                self.seg = tag.start;
                self.pos = tag.start;
                stop = Some(tag.start);
                break;
            }
            let placed = self.placer.place(&self.code.spans, &tag);
            if placed.inert {
                self.pos = tag.end;
                continue;
            }
            if !self.removed {
                self.removed = true;
                self.reset = true;
            }
            match tag.kind {
                Kind::Close => {
                    // Rule 3: an orphan closing tag removes everything before it.
                    self.kept.clear();
                    self.reset = true;
                    self.blanks = true;
                    self.seg = placed.cut_end;
                }
                Kind::Empty => {
                    self.kept.push(&text[self.seg..tag.start]);
                    self.blanks = true;
                    self.seg = tag.end;
                }
                Kind::Open => {
                    self.kept.push(&text[self.seg..tag.start]);
                    self.block = Some(tag.name);
                    self.seg = tag.end;
                }
            }
            self.pos = self.seg;
        }
        self.stop = stop;
        self.scanned = stop.unwrap_or(upto);
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

    /// The vectors of one group of the fixture.
    fn group(name: &str) -> Vec<Case> {
        let v: Value = serde_json::from_str(FIXTURE).expect("fixture is JSON");
        v[name]
            .as_array()
            .unwrap_or_else(|| panic!("fixture group {name}"))
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

    /// Every vector: the rule ("cases"), code and self-closing tags ("code"), closing tags after
    /// a block ("after_block").
    fn cases() -> Vec<Case> {
        let mut all = group("cases");
        assert!(all.len() >= 19, "fixture lost cases");
        for name in ["code", "after_block"] {
            let more = group(name);
            assert!(!more.is_empty(), "fixture group {name} is empty");
            all.extend(more);
        }
        all
    }

    #[test]
    fn every_shared_vector_passes() {
        let all = cases();
        assert!(all.len() >= 19 + 21, "fixture lost cases");
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

    /// A complete reasoning tag (not written as code), or the start of one at the end.
    fn reasoning_tag_in(s: &str) -> bool {
        strip_reasoning(s).removed || partial_tag_start(s) < s.len()
    }

    /// Where a stream's shown text ends (`previewEnd` of src/ai/reasoning.ts): before a tag still
    /// being typed at the very end, or before the first tag that may still turn out to be code.
    fn preview_end(raw: &str) -> usize {
        let mut cut = partial_tag_start(raw);
        let (_, open) = code_spans(raw.as_bytes(), true);
        if open < cut {
            if let Some(tag) = next_tag(&raw[..cut], open) {
                cut = tag.start;
            }
        }
        cut
    }

    /// What the stream must show for `raw`, computed the slow way (whole text every time): the
    /// rule applied up to `preview_end` (`hideUnfinishedReasoning` of the web side).
    fn slow_visible(raw: &str) -> String {
        strip_reasoning(&raw[..preview_end(raw)]).text
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

    #[test]
    fn the_three_review_inputs_keep_their_lesson_text() {
        // A fence holding only a closing tag goes with it (no opening fence is left behind).
        assert_eq!(
            strip_reasoning("Ví dụ:\n```\n</think>\n```\nĐáp số 12.").text,
            "Đáp số 12."
        );
        // A closing tag in code after an opening tag in code is code.
        let quoted = "Qwen viết suy nghĩ giữa `<think>` và `</think>`. Đáp số 12.";
        assert_eq!(
            strip_reasoning(quoted),
            Stripped {
                text: quoted.into(),
                removed: false,
                unclosed: false
            }
        );
        // A self-closing tag is an empty block (it does not cut the rest of the answer).
        assert_eq!(
            strip_reasoning("Dùng <think /> để đánh dấu. Đáp số 12.").text,
            "Dùng để đánh dấu. Đáp số 12."
        );
    }

    #[test]
    fn a_closing_tag_in_code_counts_until_its_name_was_opened_in_code() {
        // Another name opened in code does not protect it.
        assert_eq!(
            strip_reasoning("`<reasoning>` rồi `</think>` Hết.").text,
            "Hết."
        );
        // The same name opened in code after it does not either.
        assert_eq!(
            strip_reasoning("nháp `</think>` rồi `<think>` Hết.").text,
            "rồi `<think>` Hết."
        );
    }

    #[test]
    fn code_in_a_long_text_with_many_fence_like_lines_stays_linear() {
        let lines: Vec<String> = (0..20_000).map(|i| format!("```x{i}")).collect();
        let lines = lines.join("\n");
        let started = std::time::Instant::now();
        assert_eq!(
            strip_reasoning(&format!("{lines}\n<think>a</think>Hết.")).text,
            format!("{lines}\nHết.")
        );
        assert!(started.elapsed() < std::time::Duration::from_secs(2));
    }

    #[test]
    fn a_tag_that_may_still_be_code_is_held_back_until_its_code_is_decided() {
        let mut st = ReasoningStream::new();
        assert_eq!(
            st.push("Qwen viết `"),
            Some(Shown::Append("Qwen viết `".into()))
        );
        // The backtick waits for its pair: the tag after it may be code.
        assert_eq!(st.push("<think>"), None);
        assert_eq!(st.push(" nhé"), None);
        assert_eq!(
            st.push("` rồi"),
            Some(Shown::Append("<think> nhé` rồi".into()))
        );
        assert_eq!(st.shown(), "Qwen viết `<think> nhé` rồi");
        // A fence holds its tags back until its closing line arrives.
        let mut st = ReasoningStream::new();
        st.push("Ví dụ:\n```html\n");
        assert_eq!(st.shown(), "Ví dụ:\n```html\n");
        st.push("<think>\n");
        st.push("```");
        assert_eq!(st.shown(), "Ví dụ:\n```html\n");
        st.push("\nHết.");
        assert_eq!(st.shown(), "Ví dụ:\n```html\n<think>\n```\nHết.");
        assert_eq!(st.finish().0.text, "Ví dụ:\n```html\n<think>\n```\nHết.");
        // A line ends a backtick's wait: the tag was no code after all, and opens a block.
        let mut st = ReasoningStream::new();
        st.push("Đáp số 4. `<think>nháp");
        assert_eq!(st.shown(), "Đáp số 4. `");
        st.push("\nvẫn nháp");
        assert_eq!(st.shown(), "Đáp số 4. `");
        let (all, _) = st.finish();
        assert_eq!(all.text, "Đáp số 4. `");
        assert!(all.unclosed);
    }

    #[test]
    fn a_self_closing_tag_is_an_empty_block_also_when_cut_between_pieces() {
        for pieces in [
            &["Dùng <think", "/", "> để đánh dấu."][..],
            &["Dùng <think /", "> để đánh dấu."],
            &["Dùng <think/>", " để đánh dấu."],
        ] {
            let (seen, last) = play(pieces);
            assert_eq!(last, "Dùng để đánh dấu.");
            for s in seen {
                assert!(!s.contains('<'), "{pieces:?} showed {s:?}");
            }
        }
    }

    #[test]
    fn the_code_tracker_agrees_with_code_spans_after_every_byte() {
        const PARTS: [&str; 13] = [
            "`", "``", "```", "~~~", "~", " ", "\t", "\r", "\n", "a", "ố", "<think>", "</think>",
        ];
        let mut rng = Lcg(0xC0DE);
        for _ in 0..400 {
            let len = 1 + rng.below(30);
            let text: String = (0..len).map(|_| PARTS[rng.below(PARTS.len())]).collect();
            let bytes = text.as_bytes();
            let mut tracker = CodeTracker::default();
            for i in 0..bytes.len() {
                tracker.push(&bytes[i..=i]);
                let (spans, open) = code_spans(&bytes[..=i], true);
                assert_eq!(tracker.open(), open, "{:?}", &text[..]);
                assert_eq!(tracker.spans, spans, "{:?}", &text[..]);
            }
        }
    }

    #[test]
    fn random_streams_with_code_match_a_full_rescan_after_every_piece() {
        const PARTS: [&str; 18] = [
            "<think>",
            "</think>",
            "<reasoning>",
            "</reasoning>",
            "<think/>",
            "<think />",
            "<",
            "/",
            ">",
            "think",
            "`",
            "```",
            "~~~",
            " ",
            "\n",
            "a",
            "Lực",
            "$x<y$",
        ];
        let mut rng = Lcg(0xF00D);
        for case in 0..1500 {
            let len = 1 + rng.below(24);
            let text: String = (0..len).map(|_| PARTS[rng.below(PARTS.len())]).collect();
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

    #[test]
    fn answers_with_code_stream_in_linear_time() {
        let n = 16_384;
        let rep = |p: &'static str| std::iter::repeat_n(p.to_string(), n);
        let one = |p: &'static str| std::iter::once(p.to_string());
        let cases: Vec<(&str, Vec<String>)> = vec![
            // Inline code holding a tag in every piece.
            ("inline code with a tag", rep("`<think>` a ").collect()),
            // A backtick waiting for its pair, with a tag held back behind a long line.
            (
                "backtick waiting",
                one("`<think>").chain(rep("a<b ")).chain(one("`")).collect(),
            ),
            // A fence that never closes, holding a tag.
            (
                "unclosed fence",
                one("```\n<think>\n").chain(rep("x <div>\n")).collect(),
            ),
            // Lines that look like fences.
            ("fence-like lines", rep("```x\n").collect()),
        ];
        for (name, pieces) in cases {
            let (text, raw, took) = timed(pieces.into_iter());
            assert_eq!(text, strip_reasoning(&raw).text, "{name}");
            assert!(
                took < std::time::Duration::from_secs(2),
                "{name}: {took:?} for {} bytes",
                raw.len()
            );
        }
    }
}
