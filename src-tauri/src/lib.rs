//! Rust backend for STEM Sim Lab.
//!
//! - `app_info`: build information
//! - `ai_*`: AI gateway (LM Studio / OpenAI / Anthropic; keys in the OS keychain)
//!
//! Later phases add:
//! - SQLite storage (library, history) and `.stemsim` project files
//! - heavy numeric kernels where WASM/JS is too slow

mod ai;
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
        .manage(ai::AiState::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            ai::ai_chat,
            ai::ai_cancel,
            ai::ai_models,
            ai::ai_set_key,
            ai::ai_has_key,
            ai::ai_delete_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running STEM Sim Lab");
}
