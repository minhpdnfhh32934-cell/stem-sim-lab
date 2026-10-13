//! Keeps the app window on the app itself (audit SEC-03, 2026-10-13).
//!
//! The page shows text written by an AI, which may come from untrusted sources (Wikipedia
//! excerpts, imported files). Whatever that text contains, the window never navigates to
//! another site: external pages open in the system browser only through `open_known_page`
//! (fixed list of ids).

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, Url};

/// The Vite dev server (`tauri.conf.json` → `build.devUrl`), allowed in debug builds only.
const DEV_HOST: &str = "localhost";
const DEV_PORT: u16 = 1420;

/// True for the app's own pages: the bundled or updated web part (`tauri://localhost` on
/// macOS/Linux, `http(s)://tauri.localhost` on Windows) and, in debug builds, the dev server.
pub fn is_app_url(url: &Url, debug: bool) -> bool {
    match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" => match url.host_str() {
            Some("tauri.localhost") => true,
            Some(DEV_HOST) => debug && url.port() == Some(DEV_PORT),
            _ => false,
        },
        "about" => url.as_str() == "about:blank",
        _ => false,
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("navigation-guard")
        .on_navigation(|_webview, url| {
            let allowed = is_app_url(url, cfg!(debug_assertions));
            if !allowed {
                // Only the scheme and host: a URL can carry personal data in its path or query.
                eprintln!(
                    "[navigation] blocked {}://{}",
                    url.scheme(),
                    url.host_str().unwrap_or("")
                );
            }
            allowed
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).expect("valid url")
    }

    #[test]
    fn the_app_itself_is_allowed() {
        assert!(is_app_url(&url("http://tauri.localhost/index.html"), false));
        assert!(is_app_url(&url("https://tauri.localhost/"), false));
        assert!(is_app_url(&url("tauri://localhost/index.html"), false));
        assert!(is_app_url(&url("about:blank"), false));
    }

    #[test]
    fn the_dev_server_only_in_debug_builds() {
        assert!(is_app_url(&url("http://localhost:1420/"), true));
        assert!(!is_app_url(&url("http://localhost:1420/"), false));
        assert!(!is_app_url(&url("http://localhost:8080/"), true));
    }

    #[test]
    fn every_other_page_is_refused() {
        for s in [
            "https://evil.example/login",
            "http://tauri.localhost.evil.example/",
            "https://vi.wikipedia.org/wiki/Nguy%C3%AAn_ph%C3%A2n",
            "file:///C:/Windows/System32/",
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "tauri://evil.example/",
            "ms-settings:speech",
        ] {
            assert!(!is_app_url(&url(s), true), "{s} must be refused");
        }
    }
}
