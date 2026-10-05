//! Rust backend for STEM Sim Lab.
//!
//! - `app_info`: build information
//! - `ai_*`: AI gateway (`AIProvider`: Gemini in the main edition, Claude in both; keys in
//!   the OS keychain; retry, timeout, cancel, daily cap)
//!
//! - `safety_*`: age gate, supervisor PIN, consent, incident log (PROMPT_PHAN_2 A3)
//! - `save_file` / `open_text_file`: native Save/Open dialogs (`.stemsim`, PNG, CSV)
//! - `history_*`: simulation history in SQLite (app data folder)
//! - `web_update_*`: signed in-app updates of the web part (no new executable)

mod ai;
mod app_info;
mod files;
mod history;
mod safety;
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
        .manage(safety::SafetyState::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            ai::ai_chat,
            ai::ai_cancel,
            ai::ai_models,
            ai::ai_set_key,
            ai::ai_has_key,
            ai::ai_delete_key,
            ai::ai_usage,
            ai::ai_key_hint,
            ai::ai_test_key,
            ai::ai_edition,
            ai::open_gemini_key_page,
            safety::safety_status,
            safety::safety_answer_adult,
            safety::safety_set_birth_year,
            safety::safety_set_pin,
            safety::safety_record_consent,
            safety::safety_withdraw_consent,
            safety::safety_unlock,
            safety::safety_unlocked,
            safety::safety_lock,
            safety::safety_log_incident,
            safety::safety_incidents,
            safety::safety_clear_incidents,
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
