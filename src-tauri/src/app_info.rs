use serde::Serialize;

/// Basic build information shown in the status bar and the "About" dialog.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub target_os: String,
    pub debug_build: bool,
    /// Always "main" since 0.5.0 (the pilot edition was removed).
    pub edition: String,
    /// "store" (Microsoft Store package) or "github" (installer from GitHub Releases).
    pub channel: String,
}

impl AppInfo {
    pub fn current() -> Self {
        Self {
            name: "SimLab".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            target_os: std::env::consts::OS.to_string(),
            debug_build: cfg!(debug_assertions),
            edition: crate::ai::EDITION.to_string(),
            channel: crate::channel::current().to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_matches_cargo_manifest() {
        let info = AppInfo::current();
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(info.name, "SimLab");
    }

    #[test]
    fn serializes_to_camel_case_for_the_frontend() {
        let json = serde_json::to_value(AppInfo::current()).expect("serializable");
        assert!(json.get("targetOs").is_some());
        assert!(json.get("debugBuild").is_some());
        assert!(json.get("target_os").is_none());
        assert_eq!(json["channel"], "github");
    }
}
