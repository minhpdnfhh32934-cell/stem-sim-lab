//! Opens a fixed set of external pages in the system browser (Gemma terms, model pages) and
//! the Windows speech settings.
//! The web page only sends an id: it can never ask the app to open an arbitrary URL.

const PAGES: &[(&str, &str)] = &[
    ("gemma-terms", "https://ai.google.dev/gemma/terms"),
    (
        "gemma3-270m",
        "https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX",
    ),
    (
        "gemma3-1b",
        "https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX",
    ),
    (
        "gemma4-e2b",
        "https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX",
    ),
    // AI Teacher's voice: the Vietnamese on-device voice model and its licence, and the
    // Windows page where a Vietnamese voice is added (Time & language → Speech).
    ("mms-tts-vie", "https://huggingface.co/facebook/mms-tts-vie"),
    (
        "cc-by-nc-4",
        "https://creativecommons.org/licenses/by-nc/4.0/",
    ),
    ("windows-speech", "ms-settings:speech"),
    // Store copies: "Thư viện → Cập nhật" in the Microsoft Store app.
    ("store-updates", "ms-windows-store://downloadsandupdates"),
];

fn page_url(id: &str) -> Option<&'static str> {
    PAGES
        .iter()
        .find(|(key, _)| *key == id)
        .map(|(_, url)| *url)
}

#[tauri::command]
pub fn open_known_page(app: tauri::AppHandle, id: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = page_url(&id).ok_or_else(|| format!("unknown page: {id}"))?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_listed_pages_open() {
        assert_eq!(
            page_url("gemma-terms"),
            Some("https://ai.google.dev/gemma/terms")
        );
        assert!(page_url("gemma3-1b").is_some_and(|u| u.starts_with("https://huggingface.co/")));
        assert_eq!(page_url("windows-speech"), Some("ms-settings:speech"));
        assert_eq!(
            page_url("store-updates"),
            Some("ms-windows-store://downloadsandupdates")
        );
        assert_eq!(page_url("https://evil.example"), None);
        assert_eq!(page_url(""), None);
    }
}
