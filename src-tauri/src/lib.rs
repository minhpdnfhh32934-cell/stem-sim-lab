//! Rust backend for STEM Sim Lab.
//!
//! Phase 0 only exposes basic app information. Later phases add:
//! - AI gateway (LM Studio / cloud LLM calls, keys stored in the OS keychain)
//! - SQLite storage (library, history) and `.stemsim` project files
//! - heavy numeric kernels where WASM/JS is too slow

mod app_info;

pub use app_info::AppInfo;

/// Tauri command: returns static information about the running build.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo::current()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running STEM Sim Lab");
}
