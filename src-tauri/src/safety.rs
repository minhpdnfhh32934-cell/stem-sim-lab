//! Safety gate (PROMPT_PHAN_2 A3). Kept in Rust so the web page cannot bypass it:
//!
//! - On first run the user confirms being 18 or older and accepts the app's terms. Without that
//!   confirmation no AI call is made and no API key can be stored (Gemini API terms: users must
//!   be 18+). "I am under 18" keeps the simulations and turns the AI off.
//! - **Incident log:** only the kind of incident and the time — never the content.
//!
//! The supervised high-school "pilot" edition (birth year, supervisor PIN, parental consent) was
//! removed at the user's request in 0.5.0. Old fields in `safety.json` are ignored.
//!
//! State lives in `safety.json` / `incidents.json` in the app data folder.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::Manager;

/// Bump when the app's terms change: users are asked to confirm again.
pub const TERMS_VERSION: u32 = 1;
const MAX_INCIDENTS: usize = 500;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SafetyFile {
    /// Terms version the user accepted together with "I am 18 or older".
    pub adult_terms: Option<u32>,
    /// The user said they are under 18 (AI stays off, simulations work).
    pub declared_minor: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SafetyStatus {
    pub terms_version: u32,
    /// The age question has been answered.
    pub answered: bool,
    /// AI features may be used (18+ and the current terms confirmed).
    pub ai_allowed: bool,
    /// The user said they are under 18.
    pub minor: bool,
}

#[derive(Debug, Clone, Serialize, thiserror::Error, PartialEq, Eq)]
#[serde(tag = "code", content = "message", rename_all = "camelCase")]
pub enum SafetyError {
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("storage error: {0}")]
    Storage(String),
}

#[derive(Default)]
pub struct SafetyState {
    lock: Mutex<()>,
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, SafetyError> {
    app.path()
        .app_data_dir()
        .map_err(|e| SafetyError::Storage(e.to_string()))
}

fn load(path: &Path) -> SafetyFile {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save(path: &Path, f: &SafetyFile) -> Result<(), SafetyError> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| SafetyError::Storage(e.to_string()))?;
    }
    let json = serde_json::to_vec_pretty(f).map_err(|e| SafetyError::Storage(e.to_string()))?;
    fs::write(path, json).map_err(|e| SafetyError::Storage(e.to_string()))
}

/// The rule, as a pure function of the stored file (tested).
pub fn status_of(f: &SafetyFile) -> SafetyStatus {
    let adult = f.adult_terms == Some(TERMS_VERSION) && !f.declared_minor;
    SafetyStatus {
        terms_version: TERMS_VERSION,
        answered: adult || f.declared_minor,
        ai_allowed: adult,
        minor: f.declared_minor,
    }
}

fn paths(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), SafetyError> {
    let dir = data_dir(app)?;
    Ok((dir.join("safety.json"), dir.join("incidents.json")))
}

/// Current state of the gate.
pub fn status(app: &tauri::AppHandle) -> SafetyStatus {
    match paths(app) {
        Ok((p, _)) => status_of(&load(&p)),
        Err(_) => status_of(&SafetyFile::default()),
    }
}

/// Used by the AI gateway: may an AI call be made / a key be stored now?
pub fn ai_allowed(app: &tauri::AppHandle) -> bool {
    status(app).ai_allowed
}

#[tauri::command]
pub fn safety_status(app: tauri::AppHandle) -> SafetyStatus {
    status(&app)
}

/// "Tôi đã đủ 18 tuổi và đồng ý Điều khoản" (`adult = true`) or "Tôi chưa đủ 18 tuổi"
/// (`adult = false`).
#[tauri::command]
pub fn safety_answer_adult(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    adult: bool,
    terms_version: u32,
) -> Result<SafetyStatus, SafetyError> {
    if adult && terms_version != TERMS_VERSION {
        return Err(SafetyError::Invalid("terms version".into()));
    }
    let _g = state
        .lock
        .lock()
        .map_err(|e| SafetyError::Storage(e.to_string()))?;
    let (p, _) = paths(&app)?;
    let mut f = load(&p);
    f.adult_terms = adult.then_some(TERMS_VERSION);
    f.declared_minor = !adult;
    save(&p, &f)?;
    Ok(status_of(&f))
}

// ---- Incident log (kind + time only) -----------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IncidentKind {
    /// The problem text looked like it contained personal data and was not sent.
    InputPersonalData,
    /// The input contained clearly unsuitable content and was not sent.
    InputUnsafe,
    /// The input showed signs of a crisis; the support card was shown.
    InputCrisis,
    /// An AI answer was hidden by the output filter.
    OutputUnsafe,
    /// The user pressed "Báo cáo nội dung không phù hợp".
    UserReport,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Incident {
    /// Seconds since 1970 (UTC).
    pub at: u64,
    pub kind: IncidentKind,
}

fn load_incidents(path: &Path) -> Vec<Incident> {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

/// Appends one incident (the newest `MAX_INCIDENTS` are kept). Nothing but kind and time.
pub fn log_incident_at(path: &Path, kind: IncidentKind) -> Result<(), SafetyError> {
    let mut list = load_incidents(path);
    list.push(Incident {
        at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        kind,
    });
    if list.len() > MAX_INCIDENTS {
        list.drain(..list.len() - MAX_INCIDENTS);
    }
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| SafetyError::Storage(e.to_string()))?;
    }
    fs::write(
        path,
        serde_json::to_vec(&list).map_err(|e| SafetyError::Storage(e.to_string()))?,
    )
    .map_err(|e| SafetyError::Storage(e.to_string()))
}

#[tauri::command]
pub fn safety_log_incident(app: tauri::AppHandle, kind: IncidentKind) -> Result<(), SafetyError> {
    let (_, inc) = paths(&app)?;
    log_incident_at(&inc, kind)
}

/// The incident log (kind and time of each entry).
#[tauri::command]
pub fn safety_incidents(app: tauri::AppHandle) -> Result<Vec<Incident>, SafetyError> {
    let (_, inc) = paths(&app)?;
    Ok(load_incidents(&inc))
}

#[tauri::command]
pub fn safety_clear_incidents(app: tauri::AppHandle) -> Result<(), SafetyError> {
    let (_, inc) = paths(&app)?;
    match fs::remove_file(inc) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(SafetyError::Storage(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("stemsim-safety-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn ai_needs_the_adult_confirmation() {
        let mut f = SafetyFile::default();
        let s = status_of(&f);
        assert!(!s.answered && !s.ai_allowed);
        f.adult_terms = Some(TERMS_VERSION);
        assert!(status_of(&f).ai_allowed);
        // Older terms must be accepted again.
        f.adult_terms = Some(TERMS_VERSION - 1);
        assert!(!status_of(&f).ai_allowed);
        // "I am under 18": answered, no AI.
        let minor = SafetyFile {
            declared_minor: true,
            ..Default::default()
        };
        let s = status_of(&minor);
        assert!(s.answered && s.minor && !s.ai_allowed);
    }

    #[test]
    fn incident_log_keeps_only_kind_and_time() {
        let dir = temp("log");
        let inc = dir.join("incidents.json");
        log_incident_at(&inc, IncidentKind::UserReport).unwrap();
        log_incident_at(&inc, IncidentKind::InputPersonalData).unwrap();
        let raw = fs::read_to_string(&inc).unwrap();
        let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let first = v[0].as_object().unwrap();
        let mut keys: Vec<&String> = first.keys().collect();
        keys.sort();
        assert_eq!(keys, vec!["at", "kind"]);
        assert_eq!(v[0]["kind"], "userReport");
        assert_eq!(v[1]["kind"], "inputPersonalData");
    }

    #[test]
    fn safety_file_round_trips_and_ignores_old_pilot_fields() {
        let dir = temp("file");
        let p = dir.join("safety.json");
        let f = SafetyFile {
            adult_terms: Some(1),
            ..Default::default()
        };
        save(&p, &f).unwrap();
        assert_eq!(load(&p), f);
        fs::write(&p, b"broken").unwrap();
        assert_eq!(load(&p), SafetyFile::default());
        // A file written by 0.4.x (pilot fields present) still loads.
        fs::write(
            &p,
            br#"{"adultTerms":1,"declaredMinor":false,"birthYear":2009,"pinHash":"ab","pinSalt":"cd"}"#,
        )
        .unwrap();
        assert!(status_of(&load(&p)).ai_allowed);
    }
}
