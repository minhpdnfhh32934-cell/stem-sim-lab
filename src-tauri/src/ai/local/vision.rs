//! Pictures for local models that read them (the learner circles part of the board and asks
//! about it). Rules, checked here before anything is sent:
//!
//! - at most [`MAX_IMAGES`] picture in a whole question, only in the learner's own turns;
//! - PNG or JPEG bytes as plain base64 (no `data:` prefix), recognised by their first bytes, at
//!   most [`MAX_IMAGE_BYTES`] once decoded;
//! - only when the caller asks for it (`vision: true`), else `no-vision`;
//! - only when the runtime itself says the model reads pictures: Ollama's `capabilities` lists
//!   "vision", LM Studio's model type is `vlm`, llama.cpp's `/props` says `modalities.vision`.
//!   When the runtime says no: `no-vision`; when it cannot tell (an older runtime, LM Studio
//!   without its REST API, any other OpenAI-compatible server): `vision-unverified`. A picture is
//!   never sent on a guess.
//!
//! Cloud requests stay text only: [`crate::ai::Message`] has no picture.

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;

use super::runtime::Cap;
use super::{chat_role, LocalChatRequest, BAD_IMAGE, NO_VISION, VISION_UNVERIFIED};
use crate::ai::AiError;

/// Most pictures in one question (all messages together).
pub const MAX_IMAGES: usize = 1;
/// Largest picture, decoded.
pub const MAX_IMAGE_BYTES: usize = 2 * 1024 * 1024;
/// Longest base64 text of a picture of [`MAX_IMAGE_BYTES`] (checked before decoding).
const MAX_BASE64_LEN: usize = MAX_IMAGE_BYTES.div_ceil(3) * 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormat {
    Png,
    Jpeg,
}

impl ImageFormat {
    pub fn mime(self) -> &'static str {
        match self {
            ImageFormat::Png => "image/png",
            ImageFormat::Jpeg => "image/jpeg",
        }
    }

    /// The format of a picture, by its first bytes (the PNG signature, a JPEG start-of-image).
    pub fn of(bytes: &[u8]) -> Option<ImageFormat> {
        const PNG: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        if bytes.starts_with(&PNG) {
            Some(ImageFormat::Png)
        } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
            Some(ImageFormat::Jpeg)
        } else {
            None
        }
    }
}

fn bad(why: &str) -> AiError {
    AiError::NotAllowed(format!("{BAD_IMAGE}: {why}"))
}

/// One picture: base64 of PNG or JPEG bytes, at most [`MAX_IMAGE_BYTES`].
pub fn check_image(b64: &str) -> Result<ImageFormat, AiError> {
    if b64.len() > MAX_BASE64_LEN {
        return Err(bad("over 2 MB"));
    }
    let bytes = STANDARD.decode(b64).map_err(|_| bad("not base64"))?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(bad("over 2 MB"));
    }
    ImageFormat::of(&bytes).ok_or_else(|| bad("not PNG or JPEG"))
}

/// The pictures of a question, checked before any request: how many there are.
pub fn check_request(req: &LocalChatRequest) -> Result<usize, AiError> {
    let mut count = 0;
    for m in req.messages.iter().filter(|m| !m.images.is_empty()) {
        if !req.vision {
            return Err(AiError::NotAllowed(NO_VISION.into()));
        }
        if chat_role(&m.role) != "user" {
            return Err(bad("picture outside the learner's turn"));
        }
        count += m.images.len();
        if count > MAX_IMAGES {
            return Err(bad("more than one picture"));
        }
        for image in &m.images {
            check_image(image)?;
        }
    }
    Ok(count)
}

/// Whether the model may get a picture, from what its runtime says about it.
pub fn allow(vision: Cap) -> Result<(), AiError> {
    match vision {
        Cap::Yes => Ok(()),
        Cap::No => Err(AiError::NotAllowed(NO_VISION.into())),
        Cap::Unverified => Err(AiError::NotAllowed(VISION_UNVERIFIED.into())),
    }
}

/// The format of a checked picture, from its first base64 characters (12 characters are 9 bytes,
/// enough for both signatures).
fn sniff(b64: &str) -> Option<ImageFormat> {
    let head = b64.get(..12).unwrap_or(b64);
    ImageFormat::of(&STANDARD.decode(head).ok()?)
}

/// `data:image/png;base64,…` of a checked picture (the OpenAI-style `image_url`).
pub fn data_url(b64: &str) -> String {
    let mime = sniff(b64).map_or("image/png", ImageFormat::mime);
    format!("data:{mime};base64,{b64}")
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::ai::local::runtime::RuntimeKind;
    use crate::ai::local::LocalMessage;

    /// A small PNG (signature and a few bytes), as base64.
    pub(crate) fn png() -> String {
        let mut bytes = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        bytes.extend_from_slice(b"\0\0\0\rIHDR picture");
        STANDARD.encode(bytes)
    }

    pub(crate) fn jpeg() -> String {
        let mut bytes = vec![0xFF, 0xD8, 0xFF, 0xE0];
        bytes.extend_from_slice(b"\0\x10JFIF\0 picture");
        STANDARD.encode(bytes)
    }

    fn req(messages: Vec<LocalMessage>, vision: bool) -> LocalChatRequest {
        LocalChatRequest {
            request_id: "r".into(),
            kind: RuntimeKind::Ollama,
            base_url: "http://127.0.0.1:11434".into(),
            model: "m".into(),
            system: "s".into(),
            messages,
            vision,
            json_schema: None,
            temperature: None,
            max_tokens: None,
            context_length: None,
            think: None,
            timeout_secs: None,
        }
    }

    fn asking(images: Vec<String>) -> LocalMessage {
        LocalMessage {
            images,
            ..LocalMessage::text("user", "Chỗ em khoanh là gì?")
        }
    }

    fn tag(e: AiError) -> String {
        match e {
            AiError::NotAllowed(m) => m,
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn png_and_jpeg_pictures_are_recognised_by_their_first_bytes() {
        assert_eq!(check_image(&png()).unwrap(), ImageFormat::Png);
        assert_eq!(check_image(&jpeg()).unwrap(), ImageFormat::Jpeg);
        assert!(data_url(&png()).starts_with("data:image/png;base64,iVBORw0KGgo"));
        assert!(data_url(&jpeg()).starts_with("data:image/jpeg;base64,/9j/"));
        // A GIF, a text, a data URL, base64 with spaces: refused.
        for not in [
            STANDARD.encode(b"GIF89a picture bytes"),
            STANDARD.encode("plain text, not a picture"),
            format!("data:image/png;base64,{}", png()),
            format!("{} ", png()),
            "@@@@".to_string(),
            // The PNG signature with non-zero bits before the padding ("…Ggo=" is canonical).
            "iVBORw0KGgp=".to_string(),
        ] {
            assert!(
                tag(check_image(&not).unwrap_err()).starts_with(BAD_IMAGE),
                "{not}"
            );
        }
    }

    #[test]
    fn a_picture_over_2_mb_is_refused_before_and_after_decoding() {
        let mut big = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        big.resize(MAX_IMAGE_BYTES + 1, 0);
        let e = check_image(&STANDARD.encode(&big)).unwrap_err();
        assert_eq!(tag(e), format!("{BAD_IMAGE}: over 2 MB"));
        // Exactly 2 MB is accepted.
        big.truncate(MAX_IMAGE_BYTES);
        assert_eq!(
            check_image(&STANDARD.encode(&big)).unwrap(),
            ImageFormat::Png
        );
        // A very long text is refused without decoding it.
        let long = "A".repeat(MAX_BASE64_LEN + 4);
        assert_eq!(
            tag(check_image(&long).unwrap_err()),
            format!("{BAD_IMAGE}: over 2 MB")
        );
    }

    #[test]
    fn a_question_has_at_most_one_picture_only_when_asked_for() {
        assert_eq!(check_request(&req(vec![asking(vec![])], false)).unwrap(), 0);
        assert_eq!(
            check_request(&req(vec![asking(vec![png()])], true)).unwrap(),
            1
        );
        // A picture without `vision`.
        assert_eq!(
            tag(check_request(&req(vec![asking(vec![png()])], false)).unwrap_err()),
            NO_VISION
        );
        // Two pictures, in one turn or in two.
        for messages in [
            vec![asking(vec![png(), jpeg()])],
            vec![asking(vec![png()]), asking(vec![jpeg()])],
        ] {
            assert_eq!(
                tag(check_request(&req(messages, true)).unwrap_err()),
                format!("{BAD_IMAGE}: more than one picture")
            );
        }
        // Not in an answer of the model.
        let answer = LocalMessage {
            images: vec![png()],
            ..LocalMessage::text("assistant", "Đây")
        };
        assert!(tag(check_request(&req(vec![answer], true)).unwrap_err()).starts_with(BAD_IMAGE));
        // An invalid picture.
        assert!(
            tag(check_request(&req(vec![asking(vec!["eA==".into()])], true)).unwrap_err())
                .starts_with(BAD_IMAGE)
        );
    }

    #[test]
    fn only_a_model_the_runtime_says_reads_pictures_gets_one() {
        assert!(allow(Cap::Yes).is_ok());
        assert_eq!(tag(allow(Cap::No).unwrap_err()), NO_VISION);
        assert_eq!(tag(allow(Cap::Unverified).unwrap_err()), VISION_UNVERIFIED);
    }
}
