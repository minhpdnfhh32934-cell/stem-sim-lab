//! Keeps the app window on the app itself (audit SEC-03, 2026-10-13).
//!
//! The page shows text written by an AI, which may come from untrusted sources (Wikipedia
//! excerpts, imported files). Whatever that text contains, the window never navigates to
//! another site: external pages open in the system browser only through `open_known_page`
//! (fixed list of ids).

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime, Url};

/// True for the app's own pages: the bundled or updated web part (`tauri://localhost` on
/// macOS/Linux, `http(s)://tauri.localhost` on Windows) and, when there is one, the dev server
/// (same origin as `dev_server`, see [`dev_server`]).
pub fn is_app_url(url: &Url, dev_server: Option<&Url>) -> bool {
    match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" if url.host_str() == Some("tauri.localhost") => true,
        "about" => url.as_str() == "about:blank",
        // Opaque origins (`data:`, `file:`, `javascript:` …) never equal anything.
        _ => dev_server.is_some_and(|dev| dev.origin() == url.origin()),
    }
}

/// The dev server the window may show: `build.devUrl` from `tauri.conf.json`, in Tauri dev mode
/// only. `tauri dev` loads it in every profile (also `--release`); `tauri build` (also
/// `--debug`) serves the bundled files, so there the dev server's address is refused like any
/// other site. The build profile says nothing about this, `tauri::is_dev()` does.
fn dev_server(dev_mode: bool, dev_url: Option<&Url>) -> Option<&Url> {
    dev_url.filter(|_| dev_mode)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("navigation-guard")
        .on_navigation(|webview, url| {
            let dev = dev_server(tauri::is_dev(), webview.config().build.dev_url.as_ref());
            let allowed = is_app_url(url, dev);
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
        assert!(is_app_url(&url("http://tauri.localhost/index.html"), None));
        assert!(is_app_url(&url("https://tauri.localhost/"), None));
        assert!(is_app_url(&url("tauri://localhost/index.html"), None));
        assert!(is_app_url(&url("about:blank"), None));
    }

    #[test]
    fn the_dev_server_only_in_dev_mode() {
        let dev = url("http://localhost:1420");
        assert!(is_app_url(&url("http://localhost:1420/"), Some(&dev)));
        assert!(is_app_url(
            &url("http://localhost:1420/src/main.tsx?t=1"),
            Some(&dev)
        ));
        assert!(!is_app_url(&url("http://localhost:1420/"), None));
        assert!(!is_app_url(&url("http://localhost:8080/"), Some(&dev)));
        assert!(!is_app_url(&url("https://localhost:1420/"), Some(&dev)));
        // `tauri dev --release` is dev mode; `tauri build --debug` is not.
        assert_eq!(dev_server(true, Some(&dev)), Some(&dev));
        assert_eq!(dev_server(false, Some(&dev)), None);
        assert_eq!(dev_server(true, None), None);
    }

    #[test]
    fn the_configured_dev_url_is_the_one_allowed() {
        let dev = url("http://127.0.0.1:5173/");
        assert!(is_app_url(
            &url("http://127.0.0.1:5173/index.html"),
            Some(&dev)
        ));
        assert!(!is_app_url(&url("http://localhost:1420/"), Some(&dev)));
    }

    #[test]
    fn the_guard_follows_tauri_dev_mode_not_the_build_profile() {
        // The plugin cannot run without a window, so check its wiring in the source.
        let code = include_str!("navigation.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap_or_default();
        assert!(code.contains("dev_server(tauri::is_dev(), webview.config().build.dev_url"));
        assert!(!code.contains("debug_assertions"));
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
            assert!(
                !is_app_url(&url(s), Some(&url("http://localhost:1420"))),
                "{s} must be refused"
            );
        }
    }
}
