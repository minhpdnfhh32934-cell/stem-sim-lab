//! Safety gates (PROMPT_PHAN_2 A3). Kept in Rust so the web page cannot bypass them:
//!
//! - **Main edition (students 18+):** on first run the user confirms being 18 or older and
//!   accepts the app's terms. Without that confirmation no AI call is made and no Gemini key can
//!   be stored (Gemini API terms: users must be 18+).
//! - **Pilot edition (supervised high-school students):** the student gives a birth year; under 18
//!   the AI stays off until a supervising adult records consent with a PIN. The same PIN protects
//!   "Kết nối AI" (the Claude key) and the incident log.
//! - **Incident log:** only the kind of incident and the time — never the content.
//!
//! State lives in `safety.json` / `incidents.json` in the app data folder.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;

/// Bump when the app's terms change: users are asked to confirm again.
pub const TERMS_VERSION: u32 = 1;
const PIN_ROUNDS: u32 = 100_000;
const MAX_PIN_FAILS: u32 = 5;
const PIN_LOCKOUT: Duration = Duration::from_secs(60);
/// After a correct PIN the supervisor screens stay open this long (or until "Khóa lại").
pub const UNLOCK_FOR: Duration = Duration::from_secs(10 * 60);
const MAX_INCIDENTS: usize = 500;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SafetyFile {
    /// Main edition: terms version the user accepted together with "I am 18 or older".
    pub adult_terms: Option<u32>,
    /// Main edition: the user said they are under 18 (AI stays off, simulations work).
    pub declared_minor: bool,
    /// Pilot edition: birth year given at the age gate.
    pub birth_year: Option<i32>,
    /// Pilot edition: day ("YYYY-MM-DD") a supervising adult recorded consent.
    pub consent_day: Option<String>,
    /// Supervisor PIN: hex salt and hex hash (never the PIN itself).
    pub pin_salt: Option<String>,
    pub pin_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SafetyStatus {
    pub edition: &'static str,
    pub terms_version: u32,
    /// The age question has been answered (either edition).
    pub answered: bool,
    /// AI features may be used (adult confirmed, or consent recorded for a minor).
    pub ai_allowed: bool,
    /// The user is under 18 (main: declared; pilot: from the birth year).
    pub minor: bool,
    pub consent_day: Option<String>,
    pub pin_set: bool,
}

#[derive(Debug, Clone, Serialize, thiserror::Error, PartialEq, Eq)]
#[serde(tag = "code", content = "message", rename_all = "camelCase")]
pub enum SafetyError {
    #[error("wrong PIN")]
    WrongPin(String),
    #[error("too many wrong PINs, wait")]
    Locked(String),
    #[error("not allowed: {0}")]
    NotAllowed(String),
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("storage error: {0}")]
    Storage(String),
}

#[derive(Default)]
pub struct SafetyState {
    lock: Mutex<()>,
    fails: Mutex<(u32, Option<Instant>)>,
    /// Supervisor session: open until this instant (kept in Rust, never a flag in the page).
    unlocked: Mutex<Option<Instant>>,
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

fn current_year() -> i32 {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Good enough for an age gate (no time zone needed): 365.2425 days per year.
    1970 + (secs as f64 / 31_556_952.0) as i32
}

/// Under 18 by birth year (someone born in `current - 18` may still be 17: counted as a minor).
pub fn is_minor_by_year(birth_year: i32, current_year: i32) -> bool {
    current_year - birth_year <= 18
}

/// The rules, as a pure function of the stored file (tested for both editions).
pub fn status_of(f: &SafetyFile, pilot: bool, year: i32) -> SafetyStatus {
    let pin_set = f.pin_hash.is_some();
    if pilot {
        let minor = f.birth_year.map_or(true, |y| is_minor_by_year(y, year));
        SafetyStatus {
            edition: "pilot",
            terms_version: TERMS_VERSION,
            answered: f.birth_year.is_some(),
            ai_allowed: f.birth_year.is_some() && (!minor || f.consent_day.is_some()),
            minor,
            consent_day: f.consent_day.clone(),
            pin_set,
        }
    } else {
        let adult = f.adult_terms == Some(TERMS_VERSION) && !f.declared_minor;
        SafetyStatus {
            edition: "main",
            terms_version: TERMS_VERSION,
            answered: adult || f.declared_minor,
            ai_allowed: adult,
            minor: f.declared_minor,
            consent_day: None,
            pin_set,
        }
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Salted, iterated SHA-256 (the PIN is short, so it is slowed down; it never leaves Rust).
pub fn hash_pin(pin: &str, salt: &str) -> String {
    let mut h = Sha256::digest(format!("{salt}:{pin}").as_bytes()).to_vec();
    for _ in 1..PIN_ROUNDS {
        let mut d = Sha256::new();
        d.update(&h);
        d.update(salt.as_bytes());
        h = d.finalize().to_vec();
    }
    hex(&h)
}

fn new_salt() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let seed = format!("{nanos}:{}:{:p}", std::process::id(), &nanos);
    hex(&Sha256::digest(seed.as_bytes())[..16])
}

/// 4–8 digits.
pub fn valid_pin(pin: &str) -> bool {
    (4..=8).contains(&pin.len()) && pin.bytes().all(|b| b.is_ascii_digit())
}

pub fn pin_matches(f: &SafetyFile, pin: &str) -> bool {
    match (&f.pin_salt, &f.pin_hash) {
        (Some(salt), Some(hash)) => &hash_pin(pin, salt) == hash,
        _ => false,
    }
}

impl SafetyState {
    fn check_pin(&self, f: &SafetyFile, pin: &str, incidents: &Path) -> Result<(), SafetyError> {
        let mut fails = self
            .fails
            .lock()
            .map_err(|e| SafetyError::Storage(e.to_string()))?;
        if let Some(until) = fails.1 {
            if Instant::now() < until {
                return Err(SafetyError::Locked(format!(
                    "{}",
                    (until - Instant::now()).as_secs() + 1
                )));
            }
            *fails = (0, None);
        }
        if pin_matches(f, pin) {
            *fails = (0, None);
            return Ok(());
        }
        fails.0 += 1;
        let _ = log_incident_at(incidents, IncidentKind::PinFailed);
        if fails.0 >= MAX_PIN_FAILS {
            fails.1 = Some(Instant::now() + PIN_LOCKOUT);
        }
        Err(SafetyError::WrongPin(format!(
            "{}",
            MAX_PIN_FAILS.saturating_sub(fails.0)
        )))
    }

    /// Seconds left in the supervisor session (0 = locked).
    pub fn unlocked_secs(&self) -> u64 {
        self.unlocked
            .lock()
            .ok()
            .and_then(|u| *u)
            .and_then(|until| until.checked_duration_since(Instant::now()))
            .map_or(0, |d| d.as_secs().max(1))
    }

    fn unlock(&self) {
        if let Ok(mut u) = self.unlocked.lock() {
            *u = Some(Instant::now() + UNLOCK_FOR);
        }
    }

    fn relock(&self) {
        if let Ok(mut u) = self.unlocked.lock() {
            *u = None;
        }
    }

    /// A supervisor action: allowed inside an open supervisor session, or with the right PIN.
    fn authorize(
        &self,
        f: &SafetyFile,
        pin: Option<&str>,
        incidents: &Path,
    ) -> Result<(), SafetyError> {
        match pin {
            None if self.unlocked_secs() > 0 => Ok(()),
            _ => self.check_pin(f, pin.unwrap_or_default(), incidents),
        }
    }
}

fn paths(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), SafetyError> {
    let dir = data_dir(app)?;
    Ok((dir.join("safety.json"), dir.join("incidents.json")))
}

const PILOT: bool = cfg!(feature = "edition-pilot");

/// Current state of the gates.
pub fn status(app: &tauri::AppHandle) -> SafetyStatus {
    match paths(app) {
        Ok((p, _)) => status_of(&load(&p), PILOT, current_year()),
        Err(_) => status_of(&SafetyFile::default(), PILOT, current_year()),
    }
}

/// Used by the AI gateway: may an AI call be made / a key be stored now?
pub fn ai_allowed(app: &tauri::AppHandle) -> bool {
    status(app).ai_allowed
}

/// Pilot edition: is this the supervisor PIN, or is a supervisor session open (`pin = None`)?
/// Wrong PINs are counted and logged.
pub fn verify_pin(
    app: &tauri::AppHandle,
    state: &SafetyState,
    pin: Option<&str>,
) -> Result<(), SafetyError> {
    let (p, inc) = paths(app)?;
    let f = load(&p);
    if f.pin_hash.is_none() {
        return Err(SafetyError::NotAllowed("no supervisor PIN set".into()));
    }
    state.authorize(&f, pin, &inc)
}

#[tauri::command]
pub fn safety_status(app: tauri::AppHandle) -> SafetyStatus {
    status(&app)
}

/// Main edition: "Tôi đã đủ 18 tuổi và đồng ý Điều khoản" (`adult = true`) or "Tôi chưa đủ 18
/// tuổi" (`adult = false`).
#[tauri::command]
pub fn safety_answer_adult(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    adult: bool,
    terms_version: u32,
) -> Result<SafetyStatus, SafetyError> {
    if PILOT {
        return Err(SafetyError::NotAllowed("main edition only".into()));
    }
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
    Ok(status_of(&f, PILOT, current_year()))
}

/// Pilot edition: the student's birth year. Changing it later needs the supervisor PIN (so a
/// student cannot skip consent by claiming to be older).
#[tauri::command]
pub fn safety_set_birth_year(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    year: i32,
    pin: Option<String>,
) -> Result<SafetyStatus, SafetyError> {
    if !PILOT {
        return Err(SafetyError::NotAllowed("pilot edition only".into()));
    }
    let now = current_year();
    if !(now - 100..=now - 5).contains(&year) {
        return Err(SafetyError::Invalid("birth year".into()));
    }
    let (p, inc) = paths(&app)?;
    let f0 = load(&p);
    if f0.birth_year.is_some() {
        state.authorize(&f0, pin.as_deref(), &inc)?;
    }
    let _g = state
        .lock
        .lock()
        .map_err(|e| SafetyError::Storage(e.to_string()))?;
    let mut f = load(&p);
    f.birth_year = Some(year);
    save(&p, &f)?;
    Ok(status_of(&f, PILOT, now))
}

/// Pilot edition: sets the supervisor PIN (first time), or changes it with the current PIN.
#[tauri::command]
pub fn safety_set_pin(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    new_pin: String,
    current_pin: Option<String>,
) -> Result<SafetyStatus, SafetyError> {
    if !PILOT {
        return Err(SafetyError::NotAllowed("pilot edition only".into()));
    }
    if !valid_pin(&new_pin) {
        return Err(SafetyError::Invalid("PIN must be 4–8 digits".into()));
    }
    let (p, inc) = paths(&app)?;
    let f0 = load(&p);
    if f0.pin_hash.is_some() {
        state.authorize(&f0, current_pin.as_deref(), &inc)?;
    }
    let _g = state
        .lock
        .lock()
        .map_err(|e| SafetyError::Storage(e.to_string()))?;
    let mut f = load(&p);
    let salt = new_salt();
    f.pin_hash = Some(hash_pin(&new_pin, &salt));
    f.pin_salt = Some(salt);
    save(&p, &f)?;
    // The person who just set the PIN is the supervisor: open the session.
    state.unlock();
    Ok(status_of(&f, PILOT, current_year()))
}

/// Pilot edition: a supervising adult records that consent was given (signed form; PIN or an
/// open supervisor session).
/// `day` is the local date ("YYYY-MM-DD").
#[tauri::command]
pub fn safety_record_consent(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    pin: Option<String>,
    day: String,
) -> Result<SafetyStatus, SafetyError> {
    if !PILOT {
        return Err(SafetyError::NotAllowed("pilot edition only".into()));
    }
    if !crate::ai::usage::valid_day(&day) {
        return Err(SafetyError::Invalid("day".into()));
    }
    let (p, inc) = paths(&app)?;
    state.authorize(&load(&p), pin.as_deref(), &inc)?;
    let _g = state
        .lock
        .lock()
        .map_err(|e| SafetyError::Storage(e.to_string()))?;
    let mut f = load(&p);
    f.consent_day = Some(day);
    save(&p, &f)?;
    Ok(status_of(&f, PILOT, current_year()))
}

/// Pilot edition: withdraws consent (AI off again). Needs the PIN.
#[tauri::command]
pub fn safety_withdraw_consent(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    pin: Option<String>,
) -> Result<SafetyStatus, SafetyError> {
    let (p, inc) = paths(&app)?;
    state.authorize(&load(&p), pin.as_deref(), &inc)?;
    let _g = state
        .lock
        .lock()
        .map_err(|e| SafetyError::Storage(e.to_string()))?;
    let mut f = load(&p);
    f.consent_day = None;
    save(&p, &f)?;
    Ok(status_of(&f, PILOT, current_year()))
}

/// Pilot edition: checks the PIN and opens the supervisor session for [`UNLOCK_FOR`].
/// Returns the seconds the session stays open.
#[tauri::command]
pub fn safety_unlock(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    pin: String,
) -> Result<u64, SafetyError> {
    verify_pin(&app, &state, Some(&pin))?;
    state.unlock();
    Ok(state.unlocked_secs())
}

/// Seconds left in the supervisor session (0 = locked).
#[tauri::command]
pub fn safety_unlocked(state: tauri::State<'_, SafetyState>) -> u64 {
    state.unlocked_secs()
}

/// "Khóa lại": closes the supervisor session at once.
#[tauri::command]
pub fn safety_lock(state: tauri::State<'_, SafetyState>) {
    state.relock();
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
    /// A wrong supervisor PIN was entered.
    PinFailed,
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

/// The incident log. Pilot edition: supervisor PIN required.
#[tauri::command]
pub fn safety_incidents(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    pin: Option<String>,
) -> Result<Vec<Incident>, SafetyError> {
    if PILOT {
        verify_pin(&app, &state, pin.as_deref())?;
    }
    let (_, inc) = paths(&app)?;
    Ok(load_incidents(&inc))
}

#[tauri::command]
pub fn safety_clear_incidents(
    app: tauri::AppHandle,
    state: tauri::State<'_, SafetyState>,
    pin: Option<String>,
) -> Result<(), SafetyError> {
    if PILOT {
        verify_pin(&app, &state, pin.as_deref())?;
    }
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
    fn main_edition_needs_the_adult_confirmation_for_ai() {
        let mut f = SafetyFile::default();
        let s = status_of(&f, false, 2026);
        assert!(!s.answered && !s.ai_allowed);
        f.adult_terms = Some(TERMS_VERSION);
        assert!(status_of(&f, false, 2026).ai_allowed);
        // Older terms must be accepted again.
        f.adult_terms = Some(TERMS_VERSION - 1);
        assert!(!status_of(&f, false, 2026).ai_allowed);
        // "I am under 18": answered, no AI.
        let minor = SafetyFile {
            declared_minor: true,
            ..Default::default()
        };
        let s = status_of(&minor, false, 2026);
        assert!(s.answered && s.minor && !s.ai_allowed);
    }

    #[test]
    fn pilot_minors_need_recorded_consent() {
        let mut f = SafetyFile {
            birth_year: Some(2010),
            ..Default::default()
        };
        let s = status_of(&f, true, 2026);
        assert!(s.answered && s.minor && !s.ai_allowed);
        f.consent_day = Some("2026-10-05".into());
        assert!(status_of(&f, true, 2026).ai_allowed);
        // An adult tester does not need the consent step.
        let adult = SafetyFile {
            birth_year: Some(2000),
            ..Default::default()
        };
        let s = status_of(&adult, true, 2026);
        assert!(!s.minor && s.ai_allowed);
        // Not answered yet: no AI.
        assert!(!status_of(&SafetyFile::default(), true, 2026).ai_allowed);
    }

    #[test]
    fn birth_year_boundary_counts_as_minor() {
        assert!(is_minor_by_year(2008, 2026)); // may still be 17
        assert!(!is_minor_by_year(2007, 2026));
    }

    #[test]
    fn pins_are_hashed_with_salt_and_checked() {
        assert!(valid_pin("1234") && valid_pin("12345678"));
        assert!(!valid_pin("123") && !valid_pin("12a4") && !valid_pin("123456789"));
        let salt = "abcd";
        let h = hash_pin("2468", salt);
        assert_ne!(h, hash_pin("2468", "other"));
        assert!(!h.contains("2468"));
        let f = SafetyFile {
            pin_salt: Some(salt.into()),
            pin_hash: Some(h),
            ..Default::default()
        };
        assert!(pin_matches(&f, "2468"));
        assert!(!pin_matches(&f, "1357"));
        assert!(!pin_matches(&SafetyFile::default(), "2468"));
    }

    #[test]
    fn wrong_pins_lock_after_five_tries_and_are_logged() {
        let dir = temp("pin");
        let inc = dir.join("incidents.json");
        let salt = new_salt();
        let f = SafetyFile {
            pin_hash: Some(hash_pin("9999", &salt)),
            pin_salt: Some(salt),
            ..Default::default()
        };
        let st = SafetyState::default();
        for _ in 0..4 {
            assert!(matches!(
                st.check_pin(&f, "0000", &inc),
                Err(SafetyError::WrongPin(_))
            ));
        }
        assert!(matches!(
            st.check_pin(&f, "0000", &inc),
            Err(SafetyError::WrongPin(_))
        ));
        // Locked now, even with the right PIN.
        assert!(matches!(
            st.check_pin(&f, "9999", &inc),
            Err(SafetyError::Locked(_))
        ));
        let log = load_incidents(&inc);
        assert_eq!(log.len(), 5);
        assert!(log.iter().all(|i| i.kind == IncidentKind::PinFailed));
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
    fn safety_file_round_trips() {
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
    }

    #[test]
    fn supervisor_session_allows_actions_without_retyping_the_pin() {
        let dir = temp("session");
        let inc = dir.join("incidents.json");
        let salt = new_salt();
        let f = SafetyFile {
            pin_hash: Some(hash_pin("2468", &salt)),
            pin_salt: Some(salt),
            ..Default::default()
        };
        let st = SafetyState::default();
        // Locked: no PIN means a wrong PIN.
        assert_eq!(st.unlocked_secs(), 0);
        assert!(st.authorize(&f, None, &inc).is_err());
        st.unlock();
        assert!(st.unlocked_secs() > 0);
        assert!(st.authorize(&f, None, &inc).is_ok());
        // A typed PIN is still checked, even inside the session.
        assert!(st.authorize(&f, Some("0000"), &inc).is_err());
        st.relock();
        assert!(st.authorize(&f, None, &inc).is_err());
        assert!(st.authorize(&f, Some("2468"), &inc).is_ok());
    }
}
