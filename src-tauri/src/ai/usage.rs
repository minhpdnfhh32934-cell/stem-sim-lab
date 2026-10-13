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

/// Calls per day when a request names no cap (= `DEFAULT_DAILY_CAP` in `src/ai/aiStore.ts`).
/// A missing cap is never "unlimited": only an explicit 0 from the learner's settings is.
pub const DEFAULT_DAILY_CAP: u32 = 100;

/// Days since 1970-01-01 for a proleptic Gregorian date (H. Hinnant's `days_from_civil`).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// "YYYY-MM-DD" for a day number (inverse of `days_from_civil`).
fn civil_from_days(z: i64) -> String {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

fn day_number(day: &str) -> Option<i64> {
    if !valid_day(day) {
        return None;
    }
    let y = day[0..4].parse().ok()?;
    let m = day[5..7].parse().ok()?;
    let d = day[8..10].parse().ok()?;
    ((1..=12).contains(&m) && (1..=31).contains(&d)).then(|| days_from_civil(y, m, d))
}

/// Today in UTC as a day number, from the system clock.
pub fn utc_today() -> i64 {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    secs.div_euclid(86_400)
}

/// The day the call is counted on (audit SEC-07): the page's local date when it is within one
/// day of the system clock's UTC date (every time zone is), otherwise the UTC date. A wrong or
/// forged date can no longer reset the counter.
pub fn counting_day(page_day: Option<&str>, today: i64) -> String {
    match page_day.and_then(day_number) {
        Some(n) if (n - today).abs() <= 1 => civil_from_days(n),
        _ => civil_from_days(today),
    }
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
    fn dates_round_trip_through_day_numbers() {
        for day in [
            "1970-01-01",
            "2000-02-29",
            "2026-10-13",
            "2026-12-31",
            "2027-01-01",
        ] {
            let n = day_number(day).unwrap();
            assert_eq!(civil_from_days(n), day);
        }
        assert_eq!(day_number("1970-01-02"), Some(1));
        assert_eq!(day_number("2026-13-01"), None);
    }

    #[test]
    fn the_counting_day_cannot_be_forged() {
        let today = day_number("2026-10-13").unwrap();
        // Vietnam is UTC+7: its local date may be one day ahead of UTC.
        assert_eq!(counting_day(Some("2026-10-14"), today), "2026-10-14");
        assert_eq!(counting_day(Some("2026-10-12"), today), "2026-10-12");
        // A date far away (to reset the counter) or a bad one falls back to the clock.
        assert_eq!(counting_day(Some("2030-01-01"), today), "2026-10-13");
        assert_eq!(counting_day(Some("../../x"), today), "2026-10-13");
        assert_eq!(counting_day(None, today), "2026-10-13");
    }

    #[test]
    fn validates_day_strings() {
        assert!(valid_day("2026-10-05"));
        assert!(!valid_day("2026-1-05"));
        assert!(!valid_day("../../etc"));
        assert!(!valid_day("2026-10-05x"));
    }
}
