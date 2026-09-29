//! Rust backend for STEM Sim Lab.
//!
//! - `app_info`: build information
//! - `ai_*`: AI gateway (LM Studio / OpenAI / Anthropic; keys in the OS keychain)
//!
//! - `save_file` / `open_text_file`: native Save/Open dialogs (`.stemsim`, PNG, CSV)
//! - `history_*`: simulation history in SQLite (app data folder)

mod ai;
mod app_info;
mod files;
mod history;

pub use app_info::AppInfo;

/// Tauri command: returns static information about the running build.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo::current()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ai::AiState::default())
        .manage(history::HistoryState::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            ai::ai_chat,
            ai::ai_cancel,
            ai::ai_models,
            ai::ai_set_key,
            ai::ai_has_key,
            ai::ai_delete_key,
            files::save_file,
            files::open_text_file,
            history::history_add,
            history::history_update,
            history::history_list,
            history::history_delete,
            history::history_clear
        ])
        .run(tauri::generate_context!())
        .expect("error while running STEM Sim Lab");
}
