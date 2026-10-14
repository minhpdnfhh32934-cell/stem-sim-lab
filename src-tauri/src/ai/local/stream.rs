//! Splits a streamed answer into lines, whatever the network chunks look like: a line may be cut
//! across chunks (and a Vietnamese character across bytes), several lines may share a chunk, and
//! the last line may have no newline. Lines are decoded only when complete, so multi-byte
//! characters are never cut. Every size is capped.

use super::TOO_LARGE;
use crate::ai::AiError;

/// Longest line accepted (one NDJSON object or one SSE line).
pub const MAX_LINE_BYTES: usize = 1 << 20;
/// Longest answer text accepted (reasoning included).
pub const MAX_ANSWER_BYTES: usize = 512 * 1024;
/// Most models listed from one runtime.
pub const MAX_MODELS: usize = 500;

/// Bytes in, complete lines out (without "\n" or "\r\n").
#[derive(Debug)]
pub struct Lines {
    buf: Vec<u8>,
    max_line: usize,
}

impl Lines {
    pub fn new(max_line: usize) -> Lines {
        Lines {
            buf: Vec::new(),
            max_line,
        }
    }

    fn too_long(&self) -> AiError {
        AiError::BadResponse(format!("{TOO_LARGE}: line over {} bytes", self.max_line))
    }

    /// Adds a network chunk; returns the lines it completed, in order.
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<String>, AiError> {
        self.buf.extend_from_slice(chunk);
        let mut lines = Vec::new();
        let mut start = 0;
        while let Some(k) = self.buf[start..].iter().position(|&b| b == b'\n') {
            let end = start + k;
            if end - start > self.max_line {
                return Err(self.too_long());
            }
            let line = self.buf[start..end]
                .strip_suffix(b"\r")
                .unwrap_or(&self.buf[start..end]);
            lines.push(String::from_utf8_lossy(line).into_owned());
            start = end + 1;
        }
        self.buf.drain(..start);
        if self.buf.len() > self.max_line {
            return Err(self.too_long());
        }
        Ok(lines)
    }

    /// The stream ended: the last line if it had no newline.
    pub fn finish(&mut self) -> Option<String> {
        let rest = std::mem::take(&mut self.buf);
        let rest = rest.strip_suffix(b"\r").unwrap_or(&rest);
        (!rest.iter().all(u8::is_ascii_whitespace))
            .then(|| String::from_utf8_lossy(rest).into_owned())
    }
}

/// One line of a server-sent event stream, as the OpenAI-compatible servers send them.
#[derive(Debug, PartialEq, Eq)]
pub enum Sse<'a> {
    /// `data: {json}`
    Data(&'a str),
    /// `data: [DONE]`
    Done,
    /// `error: {json}` (llama.cpp reports errors in the stream this way).
    Error(&'a str),
    /// Blank line, `: comment`, `event:`, `id:` or `retry:`.
    Ignore,
}

pub fn sse_line(line: &str) -> Sse<'_> {
    if line.is_empty() || line.starts_with(':') {
        return Sse::Ignore;
    }
    if let Some(rest) = line.strip_prefix("data:") {
        let data = rest.strip_prefix(' ').unwrap_or(rest);
        return if data.trim() == "[DONE]" {
            Sse::Done
        } else {
            Sse::Data(data)
        };
    }
    if let Some(rest) = line.strip_prefix("error:") {
        return Sse::Error(rest.trim());
    }
    Sse::Ignore
}

#[cfg(test)]
mod tests {
    use super::*;

    const NDJSON: &str = include_str!("../../../tests/fixtures/local-ai/ollama-chat.ndjson");
    const SSE: &str = include_str!("../../../tests/fixtures/local-ai/openai-chat.sse");

    fn all_lines(chunks: &[&[u8]]) -> Vec<String> {
        let mut l = Lines::new(MAX_LINE_BYTES);
        let mut out = Vec::new();
        for c in chunks {
            out.extend(l.push(c).unwrap());
        }
        out.extend(l.finish());
        out
    }

    #[test]
    fn lines_survive_any_chunking_including_split_characters() {
        let whole = all_lines(&[NDJSON.as_bytes()]);
        assert!(whole.len() >= 4);
        let bytes = NDJSON.as_bytes();
        // Every split point, also inside a multi-byte character ("ầ", "²").
        for i in 1..bytes.len() {
            assert_eq!(
                all_lines(&[&bytes[..i], &bytes[i..]]),
                whole,
                "split at {i}"
            );
        }
        // One byte at a time.
        let singles: Vec<&[u8]> = bytes.chunks(1).collect();
        assert_eq!(all_lines(&singles), whole);
    }

    #[test]
    fn several_lines_in_one_chunk_crlf_and_a_last_line_without_newline() {
        let got = all_lines(&[b"{\"a\":1}\r\n{\"b\":2}\n\n{\"c\":3}"]);
        assert_eq!(got, vec!["{\"a\":1}", "{\"b\":2}", "", "{\"c\":3}"]);
        let mut l = Lines::new(64);
        assert_eq!(l.push(b"x\n").unwrap(), vec!["x"]);
        assert_eq!(l.finish(), None);
    }

    #[test]
    fn a_line_over_the_cap_is_an_error_even_before_its_newline() {
        let mut l = Lines::new(16);
        assert!(l.push(&[b'a'; 10]).unwrap().is_empty());
        let e = l.push(&[b'a'; 10]).unwrap_err();
        assert!(matches!(e, AiError::BadResponse(ref m) if m.starts_with(TOO_LARGE)));
        let mut l = Lines::new(16);
        let mut long = vec![b'a'; 40];
        long.push(b'\n');
        assert!(l.push(&long).is_err());
    }

    #[test]
    fn sse_lines_are_classified() {
        let kinds: Vec<Sse> = SSE.lines().map(sse_line).collect();
        assert!(kinds.contains(&Sse::Done));
        assert!(kinds.iter().any(|k| matches!(k, Sse::Data(_))));
        assert!(kinds.contains(&Sse::Ignore));
        assert_eq!(sse_line("data:{\"x\":1}"), Sse::Data("{\"x\":1}"));
        assert_eq!(sse_line("data: [DONE]"), Sse::Done);
        assert_eq!(sse_line(": keep-alive"), Sse::Ignore);
        assert_eq!(sse_line("event: message"), Sse::Ignore);
        assert_eq!(
            sse_line("error: {\"message\":\"boom\"}"),
            Sse::Error("{\"message\":\"boom\"}")
        );
    }
}
