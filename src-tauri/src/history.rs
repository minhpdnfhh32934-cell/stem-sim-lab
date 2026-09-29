//! Simulation history ("Lịch sử") in a small SQLite database in the app data folder.
//!
//! Each entry stores the topic and a `.stemsim` snapshot (JSON text) so the user can reopen
//! a past simulation exactly as it was.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// Oldest entries beyond this are deleted.
pub const MAX_ENTRIES: i64 = 500;

#[derive(Default)]
pub struct HistoryState(Mutex<Option<Connection>>);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryInput {
    pub topic_id: String,
    pub subject: String,
    pub title: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    /// UTC, "YYYY-MM-DD HH:MM:SS".
    pub created_at: String,
    pub topic_id: String,
    pub subject: String,
    pub title: String,
    pub snapshot: String,
}

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            topic_id TEXT NOT NULL,
            subject TEXT NOT NULL,
            title TEXT NOT NULL,
            snapshot TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS history_created ON history(created_at);",
    )
}

pub fn add(conn: &Connection, e: &HistoryInput) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO history (topic_id, subject, title, snapshot) VALUES (?1, ?2, ?3, ?4)",
        params![e.topic_id, e.subject, e.title, e.snapshot],
    )?;
    let id = conn.last_insert_rowid();
    conn.execute(
        "DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT ?1)",
        params![MAX_ENTRIES],
    )?;
    Ok(id)
}

pub fn list(conn: &Connection, limit: i64) -> rusqlite::Result<Vec<HistoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, created_at, topic_id, subject, title, snapshot
         FROM history ORDER BY id DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit.clamp(1, MAX_ENTRIES)], |r| {
        Ok(HistoryEntry {
            id: r.get(0)?,
            created_at: r.get(1)?,
            topic_id: r.get(2)?,
            subject: r.get(3)?,
            title: r.get(4)?,
            snapshot: r.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn update(conn: &Connection, id: i64, snapshot: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE history SET snapshot = ?1 WHERE id = ?2",
        params![snapshot, id],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM history WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn clear(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM history", [])?;
    Ok(())
}

fn with_db<T>(
    app: &AppHandle,
    state: &State<'_, HistoryState>,
    f: impl FnOnce(&Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let conn = Connection::open(dir.join("history.sqlite")).map_err(|e| e.to_string())?;
        migrate(&conn).map_err(|e| e.to_string())?;
        *guard = Some(conn);
    }
    let conn = guard.as_ref().ok_or("database not open")?;
    f(conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn history_add(
    app: AppHandle,
    state: State<'_, HistoryState>,
    entry: HistoryInput,
) -> Result<i64, String> {
    with_db(&app, &state, |c| add(c, &entry))
}

#[tauri::command]
pub fn history_update(
    app: AppHandle,
    state: State<'_, HistoryState>,
    id: i64,
    snapshot: String,
) -> Result<(), String> {
    with_db(&app, &state, |c| update(c, id, &snapshot))
}

#[tauri::command]
pub fn history_list(
    app: AppHandle,
    state: State<'_, HistoryState>,
    limit: i64,
) -> Result<Vec<HistoryEntry>, String> {
    with_db(&app, &state, |c| list(c, limit))
}

#[tauri::command]
pub fn history_delete(
    app: AppHandle,
    state: State<'_, HistoryState>,
    id: i64,
) -> Result<(), String> {
    with_db(&app, &state, |c| delete(c, id))
}

#[tauri::command]
pub fn history_clear(app: AppHandle, state: State<'_, HistoryState>) -> Result<(), String> {
    with_db(&app, &state, clear)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(topic: &str) -> HistoryInput {
        HistoryInput {
            topic_id: topic.into(),
            subject: "physics".into(),
            title: "Ném xiên".into(),
            snapshot: "{\"v\":1}".into(),
        }
    }

    #[test]
    fn add_list_delete_clear() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        let a = add(&c, &entry("projectile")).unwrap();
        let b = add(&c, &entry("pendulum")).unwrap();
        let all = list(&c, 10).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].id, b, "newest first");
        assert_eq!(all[1].title, "Ném xiên");
        update(&c, a, "{\"v\":2}").unwrap();
        assert_eq!(list(&c, 10).unwrap()[1].snapshot, "{\"v\":2}");
        delete(&c, a).unwrap();
        assert_eq!(list(&c, 10).unwrap().len(), 1);
        clear(&c).unwrap();
        assert!(list(&c, 10).unwrap().is_empty());
    }

    #[test]
    fn keeps_at_most_max_entries() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        for _ in 0..(MAX_ENTRIES + 5) {
            add(&c, &entry("x")).unwrap();
        }
        let n: i64 = c
            .query_row("SELECT COUNT(*) FROM history", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, MAX_ENTRIES);
    }
}
