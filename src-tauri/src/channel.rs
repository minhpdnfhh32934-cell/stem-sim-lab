//! Where this copy of the app came from. One executable serves both channels:
//!
//! - `github`: the NSIS/MSI installer from GitHub Releases. The web part updates itself
//!   (`webupdate.rs`).
//! - `store`: the MSIX package from the Microsoft Store. Windows gives a packaged app a
//!   "package identity"; the Store installs and updates it, so the in-app web update is off
//!   (user decision 2026-10-13: Store copies update only through the Store).

use std::sync::OnceLock;

/// "store" when the app runs from an MSIX package, else "github".
pub fn current() -> &'static str {
    static CHANNEL: OnceLock<&'static str> = OnceLock::new();
    CHANNEL.get_or_init(|| if packaged() { "store" } else { "github" })
}

pub fn is_store() -> bool {
    current() == "store"
}

#[cfg(windows)]
fn packaged() -> bool {
    use windows::Win32::Foundation::{APPMODEL_ERROR_NO_PACKAGE, WIN32_ERROR};
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFullName;
    let mut len = 0u32;
    // SAFETY: a null buffer with length 0 only asks for the required length.
    let rc: WIN32_ERROR = unsafe { GetCurrentPackageFullName(&mut len, None) };
    rc != APPMODEL_ERROR_NO_PACKAGE
}

#[cfg(not(windows))]
fn packaged() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tests_run_outside_a_package() {
        // `cargo test` never runs inside an MSIX package.
        assert_eq!(current(), "github");
        assert!(!is_store());
    }
}
