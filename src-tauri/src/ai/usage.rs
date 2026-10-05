//! Daily cap on AI calls (PROMPT_PHAN_2 A2: "giới hạn chi phí — số lượt/ngày có thể cấu
//! hình"). The counter lives in `ai-usage.json` in the app data folder so that restarting the
//! app does not reset it. The day ("YYYY-MM-DD", the user's local date) comes from the page.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::AiError;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub day: String,
    pub count: u32,
}

/// Accepts only "YYYY-MM-DD" (anything else would let the counter be reset by accident).
pub fn valid_day(day: &str) -> bool {
    let b = day.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
}

fn load(path: &Path) -> Usage {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

/// Calls made on `day` so far.
pub fn current(path: &Path, day: &str) -> Usage {
    let u = load(path);
    if u.day == day {
        u
    } else {
        Usage {
            day: day.to_string(),
            count: 0,
        }
    }
}

/// Counts one call. `cap == 0` means no limit. Fails with `DailyLimit` when the cap is reached.
pub fn consume(path: &Path, day: &str, cap: u32) -> Result<Usage, AiError> {
    let mut u = current(path, day);
    if cap > 0 && u.count >= cap {
        return Err(AiError::DailyLimit(format!("{}/{}", u.count, cap)));
    }
    u.count += 1;
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    // Losing the counter is harmless (the provider has its own limits), so a write error
    // does not block the call.
    let _ = fs::write(path, serde_json::to_vec(&u).unwrap_or_default());
    Ok(u)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("stemsim-usage-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir.join("ai-usage.json")
    }

    #[test]
    fn counts_per_day_and_stops_at_the_cap() {
        let p = temp("cap");
        assert_eq!(consume(&p, "2026-10-05", 2).unwrap().count, 1);
        assert_eq!(consume(&p, "2026-10-05", 2).unwrap().count, 2);
        let err = consume(&p, "2026-10-05", 2).unwrap_err();
        assert!(matches!(err, AiError::DailyLimit(_)));
        assert_eq!(current(&p, "2026-10-05").count, 2);
        // A new day starts from zero.
        assert_eq!(consume(&p, "2026-10-06", 2).unwrap().count, 1);
        assert_eq!(current(&p, "2026-10-07").count, 0);
    }

    #[test]
    fn zero_cap_means_unlimited_and_bad_files_are_ignored() {
        let p = temp("zero");
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(&p, b"not json").unwrap();
        for i in 1..=5 {
            assert_eq!(consume(&p, "2026-10-05", 0).unwrap().count, i);
        }
    }

    #[test]
    fn validates_day_strings() {
        assert!(valid_day("2026-10-05"));
        assert!(!valid_day("2026-1-05"));
        assert!(!valid_day("../../etc"));
        assert!(!valid_day("2026-10-05x"));
    }
}
