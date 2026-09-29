//! Save / open files through the native dialog.
//!
//! The web page never chooses a path itself: it hands over the contents, Rust shows the
//! dialog and writes (or reads) only the file the user picked.

use base64::Engine as _;
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tokio::sync::oneshot;

/// Largest file `open_text_file` will read (project files are small JSON).
const MAX_OPEN_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFile {
    pub name: String,
    pub text: String,
}

fn to_path(p: FilePath) -> Result<std::path::PathBuf, String> {
    p.into_path().map_err(|e| e.to_string())
}

/// Decodes the payload: plain UTF-8 text, or base64 for binary files (PNG).
pub fn decode_contents(contents: &str, base64: bool) -> Result<Vec<u8>, String> {
    if base64 {
        base64::engine::general_purpose::STANDARD
            .decode(contents)
            .map_err(|e| format!("base64: {e}"))
    } else {
        Ok(contents.as_bytes().to_vec())
    }
}

/// Shows a "Save as" dialog and writes the file. Returns the chosen path, or `None` when
/// the user cancelled.
#[tauri::command]
pub async fn save_file(
    app: AppHandle,
    default_name: String,
    filter_name: String,
    extensions: Vec<String>,
    contents: String,
    base64: bool,
) -> Result<Option<String>, String> {
    let bytes = decode_contents(&contents, base64)?;
    let (tx, rx) = oneshot::channel();
    let exts: Vec<&str> = extensions.iter().map(String::as_str).collect();
    app.dialog()
        .file()
        .add_filter(&filter_name, &exts)
        .set_file_name(&default_name)
        .save_file(move |p| {
            let _ = tx.send(p);
        });
    let Some(picked) = rx.await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let path = to_path(picked)?;
    tokio::fs::write(&path, bytes)
        .await
        .map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Shows an "Open" dialog and returns the text of the chosen file (`None` if cancelled).
#[tauri::command]
pub async fn open_text_file(
    app: AppHandle,
    filter_name: String,
    extensions: Vec<String>,
) -> Result<Option<OpenedFile>, String> {
    let (tx, rx) = oneshot::channel();
    let exts: Vec<&str> = extensions.iter().map(String::as_str).collect();
    app.dialog()
        .file()
        .add_filter(&filter_name, &exts)
        .pick_file(move |p| {
            let _ = tx.send(p);
        });
    let Some(picked) = rx.await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let path = to_path(picked)?;
    let meta = tokio::fs::metadata(&path)
        .await
        .map_err(|e| e.to_string())?;
    if meta.len() > MAX_OPEN_BYTES {
        return Err("file too large".into());
    }
    let text = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(Some(OpenedFile { name, text }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_text_and_base64() {
        assert_eq!(decode_contents("héllo", false).unwrap(), "héllo".as_bytes());
        assert_eq!(decode_contents("aGk=", true).unwrap(), b"hi");
        assert!(decode_contents("***", true).is_err());
    }
}
