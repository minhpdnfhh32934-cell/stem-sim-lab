//! Qwen 3.5 9B inside the app (#190, user decisions 10–11/11/2026): a bundled `llama-server`
//! (llama.cpp, Vulkan) that Rust starts itself. Rules, enforced here:
//! - Every command needs the safety gate open (18+), like every other AI command.
//! - Only a card [`device::choose`] accepts (discrete, 8 GB or more); never an integrated one.
//! - The model comes only from the pinned HuggingFace address ([`model`]); the page never
//!   downloads it, so the CSP is unchanged.
//! - One server, on 127.0.0.1 with a key that never leaves Rust ([`server`]); the page knows
//!   neither the port nor the key. It stops when the app closes, after [`server::IDLE_STOP`]
//!   unused, or on request.
//! - Questions go through the local route ([`super::local::chat_cancellable`]): never counted,
//!   never retried, never sent to the cloud.
//! - A lost card (in the log, or a server that died while answering) turns Qwen off until the
//!   learner turns it back on ([`builtin_ai_enable`]), like `gpuSafety.ts` does for Gemma.
//!
//! Errors are [`AiError::Unavailable`] with a tag the page maps to a sentence (constants below),
//! or the local route's own errors for a question.

pub mod device;
pub mod model;
pub mod server;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::Manager;

use super::local::endpoint::{loopback_client, loopback_client_with_bearer};
use super::local::runtime::RuntimeKind;
use super::local::{chat_cancellable, Limits, LocalChatRequest, LocalChatResponse, LocalEvent};
use super::{require_ai_allowed, AiError, AiState};
use device::{Device, Ineligible};
use model::{FileState, MODEL};
use server::{Server, StartError};

// Error tags (the start of the message).
/// Qwen in the app runs on Windows only.
pub const UNSUPPORTED: &str = "builtin-unsupported";
/// This copy of SimLab has no `llama-server` (built without it, or removed by an antivirus).
pub const NO_RUNTIME: &str = "builtin-no-runtime";
/// No card may run Qwen ([`device::Ineligible`] follows as JSON).
pub const NO_CARD: &str = "builtin-no-card";
/// The model is not downloaded.
pub const NO_MODEL: &str = "builtin-no-model";
/// Turned off after a card fault until the learner turns it back on.
pub const GPU_FAULT: &str = "builtin-gpu-fault";
/// The server did not start ([`server::StartError`] follows as JSON).
pub const START_FAILED: &str = "builtin-start-failed";
/// The download stopped ([`model::DownloadError`] follows as JSON).
pub const DOWNLOAD_FAILED: &str = "builtin-download";
/// A download is running (or the model is in use while deleting).
pub const BUSY: &str = "builtin-busy";
/// The app's folders could not be found.
pub const NO_FOLDER: &str = "builtin-no-folder";

const STATE_FILE: &str = "builtin-ai.json";
const WATCH_EVERY: Duration = Duration::from_secs(30);

fn unavailable(tag: &str) -> AiError {
    AiError::Unavailable(tag.into())
}

fn with_detail(tag: &str, detail: &impl Serialize) -> AiError {
    AiError::Unavailable(format!(
        "{tag}: {}",
        serde_json::to_string(detail).unwrap_or_default()
    ))
}

#[derive(Default)]
struct Inner {
    server: Option<Server>,
    /// Questions being answered: the idle stop waits for them.
    busy: u32,
    /// The card, found once per run (it creates a D3D12 device per card and asks the runtime).
    card: Option<Result<Device, Ineligible>>,
}

#[derive(Default)]
pub struct BuiltinState {
    inner: Mutex<Inner>,
    /// Held while a server starts: only one at a time.
    start_lock: tokio::sync::Mutex<()>,
    starting: AtomicBool,
    downloading: AtomicBool,
    cancel: Arc<AtomicBool>,
    watching: AtomicBool,
}

impl BuiltinState {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Stops the server (app exit, "Dừng", delete).
    pub fn stop_now(&self) {
        let server = self.lock().server.take();
        drop(server);
    }
}

struct Paths {
    exe: PathBuf,
    models: PathBuf,
    data: PathBuf,
}

fn paths(app: &tauri::AppHandle) -> Result<Paths, AiError> {
    let resources = app
        .path()
        .resource_dir()
        .map_err(|_| unavailable(NO_FOLDER))?;
    let data = app
        .path()
        .app_data_dir()
        .map_err(|_| unavailable(NO_FOLDER))?;
    let exe = if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    };
    Ok(Paths {
        exe: resources.join("llama-server").join(exe),
        models: data.join("models").join("qwen"),
        data,
    })
}

/// `builtin-ai.json`: only whether a card fault turned Qwen off.
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Saved {
    version: u32,
    gpu_fault: bool,
}

fn gpu_fault(data: &Path) -> bool {
    std::fs::read(data.join(STATE_FILE))
        .ok()
        .and_then(|b| serde_json::from_slice::<Saved>(&b).ok())
        .is_some_and(|s| s.gpu_fault)
}

fn set_gpu_fault(data: &Path, on: bool) -> Result<(), AiError> {
    let saved = Saved {
        version: 1,
        gpu_fault: on,
    };
    std::fs::create_dir_all(data)
        .and_then(|()| {
            std::fs::write(
                data.join(STATE_FILE),
                serde_json::to_vec(&saved).unwrap_or_default(),
            )
        })
        .map_err(|_| unavailable(NO_FOLDER))
}

/// The card for Qwen, found once per run.
async fn card(state: &BuiltinState, exe: &Path) -> Result<Device, Ineligible> {
    if let Some(found) = state.lock().card.clone() {
        return found;
    }
    let exe = exe.to_path_buf();
    let found = tauri::async_runtime::spawn_blocking(move || {
        let adapters = crate::gpu::list_adapters(true);
        let mut cmd = std::process::Command::new(&exe);
        cmd.arg("--list-devices");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: no console window flashes up.
            cmd.creation_flags(0x0800_0000);
        }
        let listed = cmd
            .output()
            .map(|o| {
                let mut text = String::from_utf8_lossy(&o.stdout).into_owned();
                text.push_str(&String::from_utf8_lossy(&o.stderr));
                device::parse_list_devices(&text)
            })
            .unwrap_or_default();
        device::choose(&adapters, &listed)
    })
    .await
    .unwrap_or(Err(Ineligible::NoDiscrete));
    state.lock().card = Some(found.clone());
    found
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ServerStatus {
    Stopped,
    Starting,
    Running,
}

/// What the Qwen card in Settings shows.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinStatus {
    /// Windows only.
    pub supported: bool,
    /// This copy has `llama-server`.
    pub runtime: bool,
    pub card: Option<Device>,
    pub ineligible: Option<Ineligible>,
    pub model: FileState,
    /// The download's size in bytes.
    pub size: u64,
    pub free_bytes: Option<u64>,
    pub downloading: bool,
    pub server: ServerStatus,
    pub gpu_fault: bool,
}

/// Everything a start needs, checked in order: Windows, runtime, no fault, model, card.
async fn ready_to_run(state: &BuiltinState, p: &Paths) -> Result<Device, AiError> {
    if !cfg!(windows) {
        return Err(unavailable(UNSUPPORTED));
    }
    if !p.exe.is_file() {
        return Err(unavailable(NO_RUNTIME));
    }
    if gpu_fault(&p.data) {
        return Err(unavailable(GPU_FAULT));
    }
    if model::file_state(&p.models, &MODEL) != FileState::Ready {
        return Err(unavailable(NO_MODEL));
    }
    card(state, &p.exe)
        .await
        .map_err(|why| with_detail(NO_CARD, &why))
}

/// The running server's address and key, starting it first when needed.
async fn ensure_started(
    app: &tauri::AppHandle,
    state: &BuiltinState,
) -> Result<(String, String), AiError> {
    let p = paths(app)?;
    let card = ready_to_run(state, &p).await?;
    let _one = state.start_lock.lock().await;
    {
        let mut inner = state.lock();
        if let Some(s) = inner.server.as_mut() {
            if !s.exited() {
                s.touch();
                return Ok((s.base_url(), s.key().to_string()));
            }
            let fault = s.gpu_fault();
            inner.server = None;
            if fault {
                set_gpu_fault(&p.data, true)?;
                return Err(unavailable(GPU_FAULT));
            }
        }
    }
    let key = server::random_key().ok_or_else(|| with_detail(START_FAILED, &StartError::NoKey))?;
    let model = model::final_path(&p.models, &MODEL);
    let key_file = p.data.join("builtin-ai").join("key");
    let args = server::args(&server::Launch {
        model: &model,
        device: &card.vulkan_id,
        key_file: &key_file,
    });
    state.starting.store(true, Ordering::SeqCst);
    let started = server::start(
        server::Spawn {
            program: p.exe.clone(),
            args,
            envs: Vec::new(),
            key,
            key_file,
        },
        server::READY_TIMEOUT,
        &loopback_client()?,
    )
    .await;
    state.starting.store(false, Ordering::SeqCst);
    match started {
        Ok(s) => {
            let out = (s.base_url(), s.key().to_string());
            state.lock().server = Some(s);
            watch(app, state);
            Ok(out)
        }
        Err(StartError::Exited {
            gpu_fault: true, ..
        }) => {
            set_gpu_fault(&p.data, true)?;
            Err(unavailable(GPU_FAULT))
        }
        Err(e) => Err(with_detail(START_FAILED, &e)),
    }
}

/// Stops an idle server and notices one that died, every [`WATCH_EVERY`] (started once).
fn watch(app: &tauri::AppHandle, state: &BuiltinState) {
    if state.watching.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(WATCH_EVERY).await;
            let state = app.state::<BuiltinState>();
            let mut inner = state.lock();
            let busy = inner.busy;
            let Some(s) = inner.server.as_mut() else {
                continue;
            };
            let (exited, fault) = (s.exited(), s.gpu_fault());
            if exited && fault {
                if let Ok(p) = paths(&app) {
                    let _ = set_gpu_fault(&p.data, true);
                }
            }
            if exited || (busy == 0 && s.idle_for() >= server::IDLE_STOP) {
                inner.server = None;
            }
        }
    });
}

#[tauri::command]
pub async fn builtin_ai_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuiltinState>,
) -> Result<BuiltinStatus, AiError> {
    require_ai_allowed(&app)?;
    let p = paths(&app)?;
    let supported = cfg!(windows);
    let runtime = p.exe.is_file();
    let found = if supported && runtime {
        Some(card(&state, &p.exe).await)
    } else {
        None
    };
    let server = {
        let mut inner = state.lock();
        let running = inner.server.as_mut().is_some_and(|s| !s.exited());
        if running {
            ServerStatus::Running
        } else if state.starting.load(Ordering::SeqCst) {
            ServerStatus::Starting
        } else {
            ServerStatus::Stopped
        }
    };
    Ok(BuiltinStatus {
        supported,
        runtime,
        card: found.clone().and_then(Result::ok),
        ineligible: found.and_then(Result::err),
        model: model::file_state(&p.models, &MODEL),
        size: MODEL.size,
        free_bytes: model::free_bytes(&p.data),
        downloading: state.downloading.load(Ordering::SeqCst),
        server,
        gpu_fault: gpu_fault(&p.data),
    })
}

/// Downloads the model; progress (bytes on disk) streams through `on_progress`.
#[tauri::command]
pub async fn builtin_ai_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuiltinState>,
    on_progress: tauri::ipc::Channel<u64>,
) -> Result<(), AiError> {
    require_ai_allowed(&app)?;
    let p = paths(&app)?;
    if !cfg!(windows) {
        return Err(unavailable(UNSUPPORTED));
    }
    if !p.exe.is_file() {
        return Err(unavailable(NO_RUNTIME));
    }
    card(&state, &p.exe)
        .await
        .map_err(|why| with_detail(NO_CARD, &why))?;
    if state.downloading.swap(true, Ordering::SeqCst) {
        return Err(unavailable(BUSY));
    }
    state.cancel.store(false, Ordering::SeqCst);
    let result = async {
        std::fs::create_dir_all(&p.models).map_err(|_| unavailable(NO_FOLDER))?;
        let http =
            model::client(model::allowed_url).map_err(|e| with_detail(DOWNLOAD_FAILED, &e))?;
        let free = model::free_bytes(&p.models);
        model::download(
            &http,
            &MODEL.url(),
            &p.models,
            &MODEL,
            free,
            &state.cancel,
            &mut |n| {
                // A closed page simply stops receiving.
                let _ = on_progress.send(n);
            },
        )
        .await
        .map(|_| ())
        .map_err(|e| with_detail(DOWNLOAD_FAILED, &e))
    }
    .await;
    state.downloading.store(false, Ordering::SeqCst);
    result
}

/// Stops a download; its partial file stays for "Tải tiếp".
#[tauri::command]
pub fn builtin_ai_cancel(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuiltinState>,
) -> Result<(), AiError> {
    require_ai_allowed(&app)?;
    state.cancel.store(true, Ordering::SeqCst);
    Ok(())
}

/// Stops the server and deletes the model (and a partial download).
#[tauri::command]
pub fn builtin_ai_delete(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuiltinState>,
) -> Result<(), AiError> {
    require_ai_allowed(&app)?;
    if state.downloading.load(Ordering::SeqCst) || state.lock().busy > 0 {
        return Err(unavailable(BUSY));
    }
    state.stop_now();
    let p = paths(&app)?;
    model::delete(&p.models, &MODEL).map_err(|e| with_detail(DOWNLOAD_FAILED, &e))
}

/// Loads the model ahead of the first question (the learner chose Qwen).
#[tauri::command]
pub async fn builtin_ai_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuiltinState>,
) -> Result<(), AiError> {
    require_ai_allowed(&app)?;
    ensure_started(&app, &state).await.map(|_| ())
}

/// Stops the server (gives the card's memory back, e.g. before Gemma loads).
#[tauri::command]
pub fn builtin_ai_stop(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuiltinState>,
) -> Result<(), AiError> {
    require_ai_allowed(&app)?;
    state.stop_now();
    Ok(())
}

/// "Bật lại" after a card fault.
#[tauri::command]
pub fn builtin_ai_enable(
    app: tauri::AppHandle,
    state: tauri::State<'_, BuiltinState>,
) -> Result<(), AiError> {
    require_ai_allowed(&app)?;
    state.lock().card = None;
    set_gpu_fault(&paths(&app)?.data, false)
}

/// Counts a question in [`Inner::busy`] while it runs.
struct Busy<'a>(&'a BuiltinState);

impl<'a> Busy<'a> {
    fn new(state: &'a BuiltinState) -> Busy<'a> {
        state.lock().busy += 1;
        Busy(state)
    }
}

impl Drop for Busy<'_> {
    fn drop(&mut self) {
        let mut inner = self.0.lock();
        inner.busy = inner.busy.saturating_sub(1);
        if let Some(s) = inner.server.as_mut() {
            s.touch();
        }
    }
}

/// A question to Qwen in the app. The page sends a [`LocalChatRequest`] whose runtime, address
/// and model are ignored: Rust uses its own server. `ai_cancel` with the request id stops it.
#[tauri::command]
pub async fn builtin_ai_chat(
    app: tauri::AppHandle,
    ai: tauri::State<'_, AiState>,
    state: tauri::State<'_, BuiltinState>,
    request: LocalChatRequest,
    on_event: tauri::ipc::Channel<LocalEvent>,
) -> Result<LocalChatResponse, AiError> {
    require_ai_allowed(&app)?;
    let (base_url, key) = ensure_started(&app, &state).await?;
    let req = LocalChatRequest {
        kind: RuntimeKind::LlamaCpp,
        base_url,
        model: server::ALIAS.into(),
        ..request
    };
    let http = loopback_client_with_bearer(&key)?;
    let mut emit = move |e: LocalEvent| {
        // A closed page simply stops receiving; the answer is still returned.
        let _ = on_event.send(e);
    };
    let answer = {
        let _busy = Busy::new(&state);
        let limits = Limits::chat(req.timeout_secs);
        chat_cancellable(ai.inner(), &http, &req, limits, &mut emit).await
    };
    if answer.is_err() {
        // A server that died while answering, or whose log reported a lost card: a card fault.
        let died = {
            let mut inner = state.lock();
            let died = inner
                .server
                .as_mut()
                .is_some_and(|s| s.exited() || s.gpu_fault());
            if died {
                inner.server = None;
            }
            died
        };
        if died {
            set_gpu_fault(&paths(&app)?.data, true)?;
            return Err(unavailable(GPU_FAULT));
        }
    }
    answer
}

#[cfg(test)]
mod tests {
    /// The non-test source of the builtin module.
    fn sources() -> Vec<(&'static str, &'static str)> {
        let strip = |s: &'static str| s.split("#[cfg(test)]").next().unwrap_or_default();
        vec![
            ("mod.rs", strip(include_str!("mod.rs"))),
            ("device.rs", strip(include_str!("device.rs"))),
            ("model.rs", strip(include_str!("model.rs"))),
            ("server.rs", strip(include_str!("server.rs"))),
        ]
    }

    #[test]
    fn every_command_needs_the_safety_gate_first() {
        let code = sources()[0].1;
        let commands: Vec<&str> = code.split("#[tauri::command]").skip(1).collect();
        assert_eq!(commands.len(), 8);
        for c in commands {
            let name = c
                .split("fn ")
                .nth(1)
                .and_then(|s| s.split('(').next())
                .unwrap_or_default();
            let body = c.split_once(") -> ").map(|(_, b)| b).unwrap_or_default();
            let first = body
                .lines()
                .skip(1)
                .map(str::trim)
                .find(|l| !l.is_empty())
                .unwrap_or_default();
            assert_eq!(first, "require_ai_allowed(&app)?;", "{name}");
        }
    }

    #[test]
    fn every_command_is_registered() {
        let lib = include_str!("../../lib.rs");
        for name in [
            "builtin_ai_status",
            "builtin_ai_download",
            "builtin_ai_cancel",
            "builtin_ai_delete",
            "builtin_ai_start",
            "builtin_ai_stop",
            "builtin_ai_enable",
            "builtin_ai_chat",
        ] {
            assert!(lib.contains(&format!("ai::builtin::{name},")), "{name}");
        }
        assert!(
            lib.contains("stop_now()"),
            "the server stops when the app exits"
        );
    }

    #[test]
    fn never_counts_retries_uses_cloud_keys_or_falls_back_to_the_cloud() {
        for (file, code) in sources() {
            for banned in [
                "count_call",
                "count_usage",
                "usage::",
                "send_with_fallback",
                "with_fallback",
                "retry_delay",
                "keyring",
                "Provider::",
                "ai::client()",
                "super::client",
                "super::stream",
            ] {
                assert!(!code.contains(banned), "{file} uses {banned}");
            }
        }
        // The only download client is the model's (HuggingFace hosts only).
        let builders: Vec<&str> = sources()
            .into_iter()
            .filter(|(_, code)| code.contains("Client::builder"))
            .map(|(file, _)| file)
            .collect();
        assert_eq!(builders, vec!["model.rs"]);
    }
}
