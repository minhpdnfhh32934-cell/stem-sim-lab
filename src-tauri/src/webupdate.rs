//! In-app updates of the web part of the app (HTML, JavaScript, CSS and scientific data).
//!
//! Almost every change to STEM Sim Lab is in the web part. Updating it does not install a
//! new executable, so Windows Smart App Control / SmartScreen never has to approve anything:
//! the app downloads a signed zip, checks it, unpacks it into the app data folder and serves
//! it instead of the copy built into the executable.
//!
//! Safety:
//! - the manifest is signed with Ed25519; the public key is compiled into the app and the
//!   signature covers the version, the required native version, the zip's SHA-256, its size
//!   and its URL;
//! - the zip must come from this project's GitHub releases, its hash must match, paths are
//!   checked (no `..`), and total size is limited;
//! - never downgrades; a newer installer wins over an older downloaded web part;
//! - "Khôi phục bản gốc" removes the downloaded part.

use base64::Engine as _;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::borrow::Cow;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tauri::utils::assets::{AssetKey, AssetsIter, CspHash};
use tauri::{App, AppHandle, Assets, Runtime, State};

const REPO: &str = "minhpdnfhh32934-cell/stem-sim-lab";
/// Manifest of the newest release (GitHub redirects `latest` to the newest published one).
pub const MANIFEST_URL: &str =
    "https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/latest/download/web-update.json";
pub const RELEASES_PAGE: &str =
    "https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/latest";
/// Ed25519 public key of the release signing key (private key: GitHub secret
/// `WEB_UPDATE_SIGNING_KEY`, used by `scripts/release/web-bundle.mjs`).
const PUBLIC_KEY_B64: &str = "vjX/dG4Nz3ksc+5a7980uLhoZ4OfZ1F7F3lQu5XKJgg=";
const MAX_ZIP_BYTES: u64 = 64 * 1024 * 1024;
const MAX_UNPACKED_BYTES: u64 = 256 * 1024 * 1024;
const VERSION_FILE: &str = "web-version.txt";
const ACTIVE_FILE: &str = "active.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub web_version: String,
    /// Oldest native (executable) version that can run this web part.
    pub min_native: String,
    pub sha256: String,
    pub size: u64,
    pub url: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub date: String,
    /// Base64 Ed25519 signature of [`signed_message`].
    pub signature: String,
}

/// The exact bytes that are signed (kept in sync with `scripts/release/web-bundle.mjs`).
pub fn signed_message(m: &Manifest) -> String {
    format!(
        "stemsim-web-update\n{}\n{}\n{}\n{}\n{}",
        m.web_version, m.min_native, m.sha256, m.size, m.url
    )
}

pub fn release_key() -> Result<VerifyingKey, String> {
    let raw = base64::engine::general_purpose::STANDARD
        .decode(PUBLIC_KEY_B64)
        .map_err(|e| e.to_string())?;
    let bytes: [u8; 32] = raw.try_into().map_err(|_| "bad public key length")?;
    VerifyingKey::from_bytes(&bytes).map_err(|e| e.to_string())
}

pub fn verify_manifest(m: &Manifest, key: &VerifyingKey) -> Result<(), String> {
    let sig = base64::engine::general_purpose::STANDARD
        .decode(m.signature.trim())
        .map_err(|_| "chữ ký không hợp lệ".to_string())?;
    let sig = Signature::from_slice(&sig).map_err(|_| "chữ ký không hợp lệ".to_string())?;
    key.verify_strict(signed_message(m).as_bytes(), &sig)
        .map_err(|_| "chữ ký không khớp — bản cập nhật bị từ chối".to_string())?;
    let prefix = format!("https://github.com/{REPO}/releases/download/");
    if !m.url.starts_with(&prefix) {
        return Err("địa chỉ tải không thuộc dự án".into());
    }
    if parse_version(&m.web_version).is_none() || parse_version(&m.min_native).is_none() {
        return Err("số phiên bản không hợp lệ".into());
    }
    Ok(())
}

/// "1.2.3" (a trailing "-…" is ignored) → comparable triple.
pub fn parse_version(s: &str) -> Option<(u64, u64, u64)> {
    let core = s.trim().trim_start_matches('v').split('-').next()?;
    let mut it = core.split('.').map(|p| p.parse::<u64>().ok());
    let v = (it.next()??, it.next()??, it.next()??);
    if it.next().is_some() {
        return None;
    }
    Some(v)
}

pub fn newer(a: &str, b: &str) -> bool {
    matches!((parse_version(a), parse_version(b)), (Some(x), Some(y)) if x > y)
}

pub fn native_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Unpacks a zip into `dir` (which must not exist yet), refusing unsafe paths and bombs.
pub fn unpack(zip_bytes: &[u8], dir: &Path) -> Result<(), String> {
    let mut archive =
        zip::ZipArchive::new(std::io::Cursor::new(zip_bytes)).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let mut total: u64 = 0;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = file.enclosed_name() else {
            return Err(format!("đường dẫn không an toàn: {}", file.name()));
        };
        let out = dir.join(rel);
        if file.is_dir() {
            std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut buf = Vec::new();
        (&mut file)
            .take(MAX_UNPACKED_BYTES - total + 1)
            .read_to_end(&mut buf)
            .map_err(|e| e.to_string())?;
        total += buf.len() as u64;
        if total > MAX_UNPACKED_BYTES {
            return Err("gói cập nhật quá lớn".into());
        }
        std::fs::write(&out, buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct ActiveRecord {
    version: String,
}

/// Which web part is served: the downloaded one (if newer than the built-in one) or none.
#[derive(Default)]
pub struct Shared {
    root: RwLock<Option<PathBuf>>,
    embedded: RwLock<String>,
    active: RwLock<Option<(String, PathBuf)>>,
}

impl Shared {
    fn embedded(&self) -> String {
        self.embedded.read().map(|s| s.clone()).unwrap_or_default()
    }
    fn active_version(&self) -> Option<String> {
        self.active
            .read()
            .ok()
            .and_then(|a| a.as_ref().map(|(v, _)| v.clone()))
    }
    fn running(&self) -> String {
        self.active_version().unwrap_or_else(|| self.embedded())
    }
    fn root(&self) -> Result<PathBuf, String> {
        self.root
            .read()
            .ok()
            .and_then(|r| r.clone())
            .ok_or_else(|| "chưa sẵn sàng".to_string())
    }

    /// Reads `active.json`; keeps it only if it is newer than the built-in web part.
    fn load(&self, root: &Path) {
        let record = std::fs::read(root.join(ACTIVE_FILE))
            .ok()
            .and_then(|b| serde_json::from_slice::<ActiveRecord>(&b).ok());
        let Some(rec) = record else { return };
        let dir = root.join(&rec.version);
        let valid = parse_version(&rec.version).is_some() && dir.join("index.html").is_file();
        if valid && newer(&rec.version, &self.embedded()) {
            if let Ok(mut a) = self.active.write() {
                *a = Some((rec.version, dir));
            }
        } else {
            // A newer installer (or a broken download): forget the downloaded web part.
            let _ = std::fs::remove_file(root.join(ACTIVE_FILE));
            let _ = std::fs::remove_dir_all(&dir);
        }
    }
}

/// Serves the downloaded web part when there is one, otherwise the built-in assets.
pub struct OverrideAssets<R: Runtime> {
    fallback: Box<dyn Assets<R>>,
    shared: Arc<Shared>,
}

impl<R: Runtime> OverrideAssets<R> {
    pub fn new(fallback: Box<dyn Assets<R>>, shared: Arc<Shared>) -> Self {
        let embedded = fallback
            .get(&AssetKey::from(VERSION_FILE))
            .map(|b| String::from_utf8_lossy(&b).trim().to_string())
            .unwrap_or_else(|| "0.0.0".into());
        if let Ok(mut e) = shared.embedded.write() {
            *e = embedded;
        }
        Self { fallback, shared }
    }
}

/// Relative asset path, refusing anything that could leave the folder.
fn safe_rel(key: &str) -> Option<&str> {
    let rel = key.trim_start_matches('/');
    let bad = rel.is_empty()
        || rel.contains("..")
        || rel.contains(':')
        || rel.contains('\\')
        || rel.starts_with('/');
    (!bad).then_some(rel)
}

impl<R: Runtime> Assets<R> for OverrideAssets<R> {
    fn setup(&self, app: &App<R>) {
        self.fallback.setup(app);
    }

    fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        let active = self.shared.active.read().ok().and_then(|a| a.clone());
        if let Some((_, dir)) = active {
            let rel = safe_rel(key.as_ref())?;
            return std::fs::read(dir.join(rel)).ok().map(Cow::Owned);
        }
        self.fallback.get(key)
    }

    fn iter(&self) -> Box<AssetsIter<'_>> {
        self.fallback.iter()
    }

    fn csp_hashes(&self, html_path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        self.fallback.csp_hashes(html_path)
    }
}

/// Placeholder used while swapping the context's assets.
struct NoAssets;

impl<R: Runtime> Assets<R> for NoAssets {
    fn get(&self, _key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        None
    }
    fn iter(&self) -> Box<AssetsIter<'_>> {
        Box::new(std::iter::empty())
    }
    fn csp_hashes(&self, _html_path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        Box::new(std::iter::empty())
    }
}

/// Wraps the built-in assets of `context` so a downloaded web part can replace them.
pub fn install<R: Runtime>(context: &mut tauri::Context<R>) -> Arc<Shared> {
    let shared = Arc::new(Shared::default());
    let embedded = context.set_assets(Box::new(NoAssets));
    context.set_assets(Box::new(OverrideAssets::new(embedded, shared.clone())));
    // Same folder as `app.path().app_data_dir()`, resolved before any window loads a page.
    if let Some(data) = dirs::data_dir() {
        let root = data.join(&context.config().identifier).join("web");
        shared.load(&root);
        if let Ok(mut r) = shared.root.write() {
            *r = Some(root);
        }
    }
    shared
}

pub struct WebUpdateState(pub Arc<Shared>);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub native: String,
    pub embedded: String,
    pub downloaded: Option<String>,
    pub running: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub status: Status,
    pub manifest: Manifest,
    /// A newer web part that this executable can run.
    pub available: bool,
    /// The newest release needs a new executable (install it from the releases page).
    pub needs_installer: bool,
}

fn status(shared: &Shared) -> Status {
    Status {
        native: native_version().into(),
        embedded: shared.embedded(),
        downloaded: shared.active_version(),
        running: shared.running(),
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("STEM-Sim-Lab/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())
}

async fn fetch_manifest() -> Result<Manifest, String> {
    let resp = client()?
        .get(MANIFEST_URL)
        .send()
        .await
        .map_err(|e| format!("không kết nối được máy chủ cập nhật ({e})"))?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("chưa có bản phát hành nào trên máy chủ cập nhật".into());
    }
    if !resp.status().is_success() {
        return Err(format!("máy chủ cập nhật trả lời {}", resp.status()));
    }
    let m: Manifest = resp.json().await.map_err(|e| e.to_string())?;
    verify_manifest(&m, &release_key()?)?;
    Ok(m)
}

fn evaluate(shared: &Shared, m: &Manifest) -> (bool, bool) {
    let running = shared.running();
    let is_newer = newer(&m.web_version, &running);
    let native_ok = !newer(&m.min_native, native_version());
    (is_newer && native_ok, is_newer && !native_ok)
}

#[tauri::command]
pub fn web_update_status(state: State<'_, WebUpdateState>) -> Status {
    status(&state.0)
}

#[tauri::command]
pub async fn web_update_check(state: State<'_, WebUpdateState>) -> Result<CheckResult, String> {
    let manifest = fetch_manifest().await?;
    let (available, needs_installer) = evaluate(&state.0, &manifest);
    Ok(CheckResult {
        status: status(&state.0),
        manifest,
        available,
        needs_installer,
    })
}

/// Downloads, verifies and activates the newest web part. Takes effect after a restart.
#[tauri::command]
pub async fn web_update_apply(state: State<'_, WebUpdateState>) -> Result<String, String> {
    let shared = state.0.clone();
    let m = fetch_manifest().await?;
    let (available, _) = evaluate(&shared, &m);
    if !available {
        return Err("không có bản cập nhật phù hợp".into());
    }
    if m.size > MAX_ZIP_BYTES {
        return Err("gói cập nhật quá lớn".into());
    }
    let bytes = client()?
        .get(&m.url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 != m.size {
        return Err("tải về không đủ dung lượng".into());
    }
    let hash = hex(&Sha256::digest(&bytes));
    if !hash.eq_ignore_ascii_case(&m.sha256) {
        return Err("mã kiểm tra (SHA-256) không khớp — bản tải về bị hỏng".into());
    }
    let root = shared.root()?;
    let partial = root.join(format!("{}.partial", m.web_version));
    let _ = std::fs::remove_dir_all(&partial);
    unpack(&bytes, &partial)?;
    let inner = std::fs::read_to_string(partial.join(VERSION_FILE)).unwrap_or_default();
    if inner.trim() != m.web_version || !partial.join("index.html").is_file() {
        let _ = std::fs::remove_dir_all(&partial);
        return Err("gói cập nhật thiếu tệp hoặc sai phiên bản".into());
    }
    let dir = root.join(&m.web_version);
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::rename(&partial, &dir).map_err(|e| e.to_string())?;
    let record = serde_json::to_vec(&ActiveRecord {
        version: m.web_version.clone(),
    })
    .map_err(|e| e.to_string())?;
    let tmp = root.join("active.json.tmp");
    std::fs::write(&tmp, record).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, root.join(ACTIVE_FILE)).map_err(|e| e.to_string())?;
    // Remove older downloaded versions.
    if let Ok(entries) = std::fs::read_dir(&root) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() && p != dir {
                let _ = std::fs::remove_dir_all(p);
            }
        }
    }
    if let Ok(mut a) = shared.active.write() {
        *a = Some((m.web_version.clone(), dir));
    }
    Ok(m.web_version)
}

/// Removes the downloaded web part: the built-in one is used after a restart.
#[tauri::command]
pub fn web_update_reset(state: State<'_, WebUpdateState>) -> Result<(), String> {
    let root = state.0.root()?;
    let _ = std::fs::remove_file(root.join(ACTIVE_FILE));
    if let Ok(entries) = std::fs::read_dir(&root) {
        for e in entries.flatten() {
            if e.path().is_dir() {
                let _ = std::fs::remove_dir_all(e.path());
            }
        }
    }
    if let Ok(mut a) = state.0.active.write() {
        *a = None;
    }
    Ok(())
}

#[tauri::command]
pub fn app_restart(app: AppHandle) {
    app.restart();
}

#[tauri::command]
pub fn open_releases_page(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(RELEASES_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use std::io::Write;

    fn signed(key: &SigningKey, version: &str, url: &str) -> Manifest {
        let mut m = Manifest {
            web_version: version.into(),
            min_native: "0.2.0".into(),
            sha256: "ab".repeat(32),
            size: 1234,
            url: url.into(),
            notes: String::new(),
            date: String::new(),
            signature: String::new(),
        };
        let sig = key.sign(signed_message(&m).as_bytes());
        m.signature = base64::engine::general_purpose::STANDARD.encode(sig.to_bytes());
        m
    }

    const URL: &str =
        "https://github.com/minhpdnfhh32934-cell/stem-sim-lab/releases/download/v0.2.1/web-bundle.zip";

    #[test]
    fn built_in_public_key_is_valid() {
        assert!(release_key().is_ok());
    }

    #[test]
    fn accepts_a_correct_signature_and_rejects_tampering() {
        let key = SigningKey::from_bytes(&[7u8; 32]);
        let m = signed(&key, "0.2.1", URL);
        assert!(verify_manifest(&m, &key.verifying_key()).is_ok());

        let mut bad = m.clone();
        bad.sha256 = "cd".repeat(32);
        assert!(verify_manifest(&bad, &key.verifying_key()).is_err());

        let other = SigningKey::from_bytes(&[9u8; 32]);
        assert!(verify_manifest(&m, &other.verifying_key()).is_err());

        let foreign = signed(&key, "0.2.1", "https://example.com/web-bundle.zip");
        assert!(verify_manifest(&foreign, &key.verifying_key()).is_err());
    }

    /// Signed by `scripts/release/web-bundle.mjs` (Node) with the real release key.
    #[test]
    fn node_signed_manifest_verifies_with_the_built_in_key() {
        let m: Manifest =
            serde_json::from_str(include_str!("../tests/fixtures/web-update-sample.json")).unwrap();
        assert!(verify_manifest(&m, &release_key().unwrap()).is_ok());
        let mut tampered = m.clone();
        tampered.min_native = "0.0.1".into();
        assert!(verify_manifest(&tampered, &release_key().unwrap()).is_err());
    }

    #[test]
    fn compares_versions() {
        assert!(newer("0.2.1", "0.2.0"));
        assert!(newer("1.0.0", "0.9.9"));
        assert!(newer("v0.10.0", "0.9.0"));
        assert!(!newer("0.2.0", "0.2.0"));
        assert!(!newer("0.1.9", "0.2.0"));
        assert!(!newer("abc", "0.1.0"));
        assert_eq!(parse_version("1.2.3-beta"), Some((1, 2, 3)));
        assert_eq!(parse_version("1.2"), None);
    }

    fn zip_of(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut w = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        for (name, data) in entries {
            w.start_file(*name, zip::write::SimpleFileOptions::default())
                .unwrap();
            w.write_all(data).unwrap();
        }
        w.finish().unwrap().into_inner()
    }

    #[test]
    fn unpacks_and_refuses_path_traversal() {
        let tmp = std::env::temp_dir().join(format!("stemsim-unpack-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        let good = zip_of(&[("index.html", b"<html>"), ("assets/a.js", b"1")]);
        unpack(&good, &tmp.join("ok")).unwrap();
        assert!(tmp.join("ok/assets/a.js").is_file());

        let evil = zip_of(&[("../evil.txt", b"x")]);
        assert!(unpack(&evil, &tmp.join("bad")).is_err());
        assert!(!tmp.join("evil.txt").exists());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn asset_paths_cannot_escape() {
        assert_eq!(safe_rel("/index.html"), Some("index.html"));
        assert_eq!(safe_rel("assets/x.js"), Some("assets/x.js"));
        assert_eq!(safe_rel("/../secret"), None);
        assert_eq!(safe_rel("C:/Windows"), None);
        assert_eq!(safe_rel("a\\b"), None);
    }

    #[test]
    fn downloaded_part_is_used_only_when_newer_than_built_in() {
        let tmp = std::env::temp_dir().join(format!("stemsim-load-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("0.2.1")).unwrap();
        std::fs::write(tmp.join("0.2.1/index.html"), "x").unwrap();
        std::fs::write(tmp.join(ACTIVE_FILE), r#"{"version":"0.2.1"}"#).unwrap();

        let s = Shared::default();
        *s.embedded.write().unwrap() = "0.2.0".into();
        s.load(&tmp);
        assert_eq!(s.running(), "0.2.1");

        // After installing a newer executable (built-in 0.3.0) the download is dropped.
        let s2 = Shared::default();
        *s2.embedded.write().unwrap() = "0.3.0".into();
        s2.load(&tmp);
        assert_eq!(s2.running(), "0.3.0");
        assert!(!tmp.join(ACTIVE_FILE).exists());
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
