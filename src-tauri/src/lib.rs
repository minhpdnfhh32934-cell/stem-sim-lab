//! Rust backend for STEM Sim Lab.
//!
//! - `app_info`: build information
//! - `ai_*`: AI gateway (Gemini / OpenAI / Anthropic; keys in the OS keychain)
//!
//! - `save_file` / `open_text_file`: native Save/Open dialogs (`.stemsim`, PNG, CSV)
//! - `history_*`: simulation history in SQLite (app data folder)
//! - `web_update_*`: signed in-app updates of the web part (no new executable)

mod ai;
mod app_info;
mod files;
mod history;
mod webupdate;

pub use app_info::AppInfo;

/// Tauri command: returns static information about the running build.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo::current()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    let web = webupdate::install(&mut context);
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(webupdate::WebUpdateState(web))
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
            ai::open_gemini_key_page,
            files::save_file,
            files::open_text_file,
            history::history_add,
            history::history_update,
            history::history_list,
            history::history_delete,
            history::history_clear,
            webupdate::web_update_status,
            webupdate::web_update_check,
            webupdate::web_update_apply,
            webupdate::web_update_reset,
            webupdate::app_restart,
            webupdate::open_releases_page
        ])
        .run(context)
        .expect("error while running STEM Sim Lab");
}
