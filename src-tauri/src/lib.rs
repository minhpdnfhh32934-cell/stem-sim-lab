//! Rust backend for STEM Sim Lab.
//!
//! - `app_info`: build information
//! - `ai_*`: AI gateway (`AIProvider`: Gemini, Claude, Groq; keys in the OS keychain; retry,
//!   timeout, cancel, daily cap)
//!
//! - `safety_*`: 18+ confirmation and incident log (PROMPT_PHAN_2 A3)
//! - `save_file` / `open_text_file`: native Save/Open dialogs (`.stemsim`, PNG, CSV)
//! - `open_known_page`: opens a fixed list of external pages (Gemma terms, model pages)
//! - `gpu_*`: graphics card for the in-app AI (WebView2 adapter, applied at start-up)
//! - `history_*`: simulation history in SQLite (app data folder)
//! - `web_update_*`: signed in-app updates of the web part (no new executable)

mod ai;
mod app_info;
mod files;
mod gpu;
mod history;
mod links;
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
    // Before any window exists: WebView2 reads its GPU switch only when it starts.
    let gpu = gpu::prepare(&mut context);
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(webupdate::WebUpdateState(web))
        .manage(gpu)
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
            ai::open_groq_key_page,
            safety::safety_status,
            safety::safety_answer_adult,
            safety::safety_log_incident,
            safety::safety_incidents,
            safety::safety_clear_incidents,
            files::save_file,
            files::open_text_file,
            links::open_known_page,
            gpu::gpu_status,
            gpu::gpu_set_choice,
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
