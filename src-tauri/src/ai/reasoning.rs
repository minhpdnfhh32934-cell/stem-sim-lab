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

use super::AiError;

/// Reasoning tag names (lower case).
const NAMES: [&str; 4] = ["think", "thinking", "reasoning", "reflection"];

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
    while i < s.len() && s[i].is_ascii_alphabetic() {
        i += 1;
    }
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
                    seg = s.len();
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

fn js_trim(s: &str) -> &str {
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
}
