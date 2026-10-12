//! Which graphics card (GPU) runs the in-app AI (Gemma on WebGPU inside WebView2).
//!
//! Measured on a hybrid laptop (AMD Radeon 610M + NVIDIA RTX 5070 Laptop, WebView2 154,
//! 2026-10-12): WebGPU always got the integrated card, whatever `powerPreference` the page asked
//! for. Chromium's `--use-adapter-luid=<high>,<low>` switch moves the whole GPU process (WebGPU
//! included) to one adapter: ~10× faster compute on the RTX. A wrong LUID falls back to the
//! default card; `--use-webgpu-power-preference=force-high-performance` alone left WebGPU with
//! no adapter at all, so it is never used.
//!
//! Browser switches only apply when WebView2 starts, so the choice is read here before the window
//! is created and a change needs a restart. LUIDs change on every boot: the choice is stored as
//! PCI ids (`vendor:device:subsystem`) and resolved to the current LUID at start-up.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// wry's default WebView2 arguments; setting `additional_browser_args` replaces them, so they are
/// repeated here (mini menu, PDF UI and SmartScreen stay off, as in every other build).
const WRY_DEFAULT_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
const FILE_NAME: &str = "gpu.json";
const FILE_VERSION: u32 = 1;

// Built on Windows only (DXGI); other platforms list no adapters.
#[cfg_attr(not(windows), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum GpuKind {
    /// Shares system memory with the CPU (D3D12 UMA).
    Integrated,
    /// Has its own video memory.
    Discrete,
    /// The driver could not be asked (no D3D12 device).
    Unknown,
}

/// One hardware adapter, as shown in Settings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuAdapter {
    /// Stable id `vendor:device:subsystem` (hex), stored in `gpu.json`.
    pub id: String,
    pub name: String,
    pub vendor_id: u32,
    pub device_id: u32,
    pub kind: GpuKind,
    pub dedicated_mb: u64,
    pub shared_mb: u64,
    /// Current-boot LUID (high, low). Never sent to the page.
    #[serde(skip)]
    pub luid: (i32, u32),
}

/// `gpu.json` in the app data folder. `choice: None` = let Windows/WebView2 decide.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChoiceFile {
    version: u32,
    choice: Option<String>,
    name: Option<String>,
}

/// What start-up asked WebView2 for.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Startup {
    /// The stored choice when the app started.
    pub choice: Option<String>,
    /// True when that card was found and passed to WebView2.
    pub applied: bool,
}

pub struct GpuState {
    path: Option<PathBuf>,
    startup: Startup,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuStatus {
    /// False outside Windows: the choice cannot be applied there.
    pub supported: bool,
    pub adapters: Vec<GpuAdapter>,
    /// Saved choice (adapter id), `None` = automatic.
    pub choice: Option<String>,
    /// Name saved with the choice (shown when the card is missing, e.g. turned off).
    pub choice_name: Option<String>,
    /// Choice in effect since the app started.
    pub startup_choice: Option<String>,
    /// The start-up choice was found and given to WebView2.
    pub startup_applied: bool,
    /// The saved choice differs from the one in effect: a restart applies it.
    pub restart_needed: bool,
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn adapter_id(vendor_id: u32, device_id: u32, sub_sys_id: u32) -> String {
    format!("{vendor_id:04x}:{device_id:04x}:{sub_sys_id:08x}")
}

/// Accepts only ids produced by [`adapter_id`].
pub fn valid_id(id: &str) -> bool {
    let parts: Vec<&str> = id.split(':').collect();
    parts.len() == 3
        && [4, 4, 8].iter().zip(&parts).all(|(len, p)| {
            p.len() == *len
                && p.chars()
                    .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
        })
}

/// WebView2 arguments for a chosen adapter (Chromium expects `high,low` in decimal).
pub fn browser_args(base: Option<&str>, luid: (i32, u32)) -> String {
    format!(
        "{} --use-adapter-luid={},{}",
        base.unwrap_or(WRY_DEFAULT_ARGS),
        luid.0,
        luid.1
    )
}

/// The LUID of the chosen adapter on this boot, if it is present.
pub fn resolve(choice: Option<&str>, adapters: &[GpuAdapter]) -> Option<(i32, u32)> {
    let id = choice?;
    adapters.iter().find(|a| a.id == id).map(|a| a.luid)
}

fn read_choice(path: &Path) -> ChoiceFile {
    // Missing, unreadable or broken file → automatic (never block start-up).
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<ChoiceFile>(&bytes).ok())
        .filter(|f| match f.choice.as_deref() {
            Some(id) => valid_id(id),
            None => true,
        })
        .unwrap_or_default()
}

fn write_choice(path: &Path, file: &ChoiceFile) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

impl GpuState {
    fn status(&self, adapters: Vec<GpuAdapter>) -> GpuStatus {
        let saved = self.path.as_deref().map(read_choice).unwrap_or_default();
        GpuStatus {
            supported: cfg!(windows) && self.path.is_some(),
            adapters,
            restart_needed: saved.choice != self.startup.choice,
            choice: saved.choice,
            choice_name: saved.name,
            startup_choice: self.startup.choice.clone(),
            startup_applied: self.startup.applied,
        }
    }
}

/// Reads the saved choice and, when its card is present, passes it to every window's WebView2.
/// Runs before the window exists (same folder as `app.path().app_data_dir()`).
pub fn prepare<R: tauri::Runtime>(context: &mut tauri::Context<R>) -> GpuState {
    let path = dirs::data_dir().map(|d| d.join(&context.config().identifier).join(FILE_NAME));
    let saved = path.as_deref().map(read_choice).unwrap_or_default();
    let mut startup = Startup {
        choice: saved.choice.clone(),
        applied: false,
    };
    if saved.choice.is_some() {
        // Kind detection creates a D3D12 device per card (slow, wakes the discrete GPU):
        // start-up only needs the ids and LUIDs.
        let adapters = list_adapters(false);
        if let Some(luid) = resolve(saved.choice.as_deref(), &adapters) {
            for window in context.config_mut().app.windows.iter_mut() {
                window.additional_browser_args = Some(browser_args(
                    window.additional_browser_args.as_deref(),
                    luid,
                ));
            }
            startup.applied = true;
        }
    }
    GpuState { path, startup }
}

#[tauri::command]
pub async fn gpu_status(state: tauri::State<'_, GpuState>) -> Result<GpuStatus, String> {
    let adapters = tauri::async_runtime::spawn_blocking(|| list_adapters(true))
        .await
        .map_err(|e| e.to_string())?;
    Ok(state.status(adapters))
}

/// Saves the choice (`None` = automatic). Applied on the next start.
#[tauri::command]
pub async fn gpu_set_choice(
    state: tauri::State<'_, GpuState>,
    id: Option<String>,
) -> Result<GpuStatus, String> {
    let path = state.path.clone().ok_or("no app data folder")?;
    let adapters = tauri::async_runtime::spawn_blocking(|| list_adapters(true))
        .await
        .map_err(|e| e.to_string())?;
    let name = match id.as_deref() {
        None => None,
        Some(id) => {
            if !valid_id(id) {
                return Err(format!("invalid gpu id: {id}"));
            }
            let adapter = adapters
                .iter()
                .find(|a| a.id == id)
                .ok_or_else(|| format!("gpu not found: {id}"))?;
            Some(adapter.name.clone())
        }
    };
    let file = ChoiceFile {
        version: FILE_VERSION,
        choice: id,
        name,
    };
    write_choice(&path, &file)?;
    Ok(state.status(adapters))
}

/// Hardware adapters (software renderers skipped). `with_kind` asks D3D12 whether each card
/// shares system memory (integrated) or has its own (discrete).
#[cfg(windows)]
pub fn list_adapters(with_kind: bool) -> Vec<GpuAdapter> {
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE,
    };

    let Ok(factory) = (unsafe { CreateDXGIFactory1::<IDXGIFactory1>() }) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let mut index = 0;
    while let Ok(adapter) = unsafe { factory.EnumAdapters1(index) } {
        index += 1;
        let Ok(desc) = (unsafe { adapter.GetDesc1() }) else {
            continue;
        };
        if desc.Flags & (DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32) != 0 {
            continue;
        }
        let len = desc
            .Description
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(desc.Description.len());
        let name = String::from_utf16_lossy(&desc.Description[..len])
            .trim()
            .to_string();
        let kind = if with_kind {
            match is_uma(&adapter) {
                Some(true) => GpuKind::Integrated,
                Some(false) => GpuKind::Discrete,
                None => GpuKind::Unknown,
            }
        } else {
            GpuKind::Unknown
        };
        out.push(GpuAdapter {
            id: adapter_id(desc.VendorId, desc.DeviceId, desc.SubSysId),
            name,
            vendor_id: desc.VendorId,
            device_id: desc.DeviceId,
            kind,
            dedicated_mb: (desc.DedicatedVideoMemory / (1024 * 1024)) as u64,
            shared_mb: (desc.SharedSystemMemory / (1024 * 1024)) as u64,
            luid: (desc.AdapterLuid.HighPart, desc.AdapterLuid.LowPart),
        });
    }
    out
}

#[cfg(windows)]
fn is_uma(adapter: &windows::Win32::Graphics::Dxgi::IDXGIAdapter1) -> Option<bool> {
    use windows::Win32::Graphics::Direct3D::D3D_FEATURE_LEVEL_11_0;
    use windows::Win32::Graphics::Direct3D12::{
        D3D12CreateDevice, ID3D12Device, D3D12_FEATURE_ARCHITECTURE,
        D3D12_FEATURE_DATA_ARCHITECTURE,
    };

    let mut device: Option<ID3D12Device> = None;
    unsafe { D3D12CreateDevice(adapter, D3D_FEATURE_LEVEL_11_0, &mut device) }.ok()?;
    let device = device?;
    let mut arch = D3D12_FEATURE_DATA_ARCHITECTURE::default();
    unsafe {
        device.CheckFeatureSupport(
            D3D12_FEATURE_ARCHITECTURE,
            (&mut arch as *mut D3D12_FEATURE_DATA_ARCHITECTURE).cast(),
            std::mem::size_of::<D3D12_FEATURE_DATA_ARCHITECTURE>() as u32,
        )
    }
    .ok()?;
    Some(arch.UMA.as_bool())
}

#[cfg(not(windows))]
pub fn list_adapters(_with_kind: bool) -> Vec<GpuAdapter> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn adapter(id: &str, luid: (i32, u32)) -> GpuAdapter {
        GpuAdapter {
            id: id.to_string(),
            name: "Card".to_string(),
            vendor_id: 0,
            device_id: 0,
            kind: GpuKind::Unknown,
            dedicated_mb: 0,
            shared_mb: 0,
            luid,
        }
    }

    fn temp_file(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("stemsim-gpu-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join(FILE_NAME)
    }

    #[test]
    fn ids_are_lowercase_hex_with_fixed_widths() {
        let id = adapter_id(0x10de, 0x2d58, 0x1074_1043);
        assert_eq!(id, "10de:2d58:10741043");
        assert!(valid_id(&id));
        for bad in [
            "",
            "10de:2d58",
            "10DE:2d58:10741043",
            "10de:2d58:1074104",
            "zz10:2d58:10741043",
            "10de:2d58:10741043:00",
        ] {
            assert!(!valid_id(bad), "{bad}");
        }
    }

    #[test]
    fn browser_args_keep_wry_defaults_and_use_decimal_high_low() {
        // RTX 5070 Laptop on the test machine: LUID 0x00000000_0FEBFCC4.
        assert_eq!(
            browser_args(None, (0, 0x0FEB_FCC4)),
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --use-adapter-luid=0,267123908"
        );
        assert_eq!(
            browser_args(Some("--x"), (-1, 5)),
            "--x --use-adapter-luid=-1,5"
        );
    }

    #[test]
    fn resolve_finds_the_current_luid_or_nothing() {
        let list = [
            adapter("1002:164e:10741043", (0, 72141)),
            adapter("10de:2d58:10741043", (0, 267123908)),
        ];
        assert_eq!(
            resolve(Some("10de:2d58:10741043"), &list),
            Some((0, 267123908))
        );
        assert_eq!(resolve(None, &list), None);
        // The chosen card is gone (turned off, removed): no switch, WebView2 keeps its default.
        assert_eq!(resolve(Some("8086:46a6:00000000"), &list), None);
    }

    #[test]
    fn choice_file_round_trips_and_broken_files_mean_automatic() {
        let path = temp_file("roundtrip");
        assert_eq!(read_choice(&path), ChoiceFile::default());
        let file = ChoiceFile {
            version: FILE_VERSION,
            choice: Some("10de:2d58:10741043".to_string()),
            name: Some("NVIDIA GeForce RTX 5070 Laptop GPU".to_string()),
        };
        write_choice(&path, &file).expect("write");
        assert_eq!(read_choice(&path), file);

        std::fs::write(&path, b"{ not json").expect("write");
        assert_eq!(read_choice(&path).choice, None);
        std::fs::write(
            &path,
            br#"{"version":1,"choice":"--use-gl=evil","name":null}"#,
        )
        .expect("write");
        assert_eq!(
            read_choice(&path).choice,
            None,
            "only well-formed ids reach the switch"
        );
        let _ = std::fs::remove_dir_all(path.parent().expect("dir"));
    }

    #[test]
    fn restart_is_needed_only_when_the_saved_choice_changed() {
        let path = temp_file("restart");
        let state = GpuState {
            path: Some(path.clone()),
            startup: Startup::default(),
        };
        assert!(!state.status(Vec::new()).restart_needed);
        let file = ChoiceFile {
            version: FILE_VERSION,
            choice: Some("10de:2d58:10741043".to_string()),
            name: None,
        };
        write_choice(&path, &file).expect("write");
        let status = state.status(Vec::new());
        assert!(status.restart_needed);
        assert_eq!(status.choice.as_deref(), Some("10de:2d58:10741043"));
        let started = GpuState {
            path: Some(path.clone()),
            startup: Startup {
                choice: Some("10de:2d58:10741043".to_string()),
                applied: true,
            },
        };
        assert!(!started.status(Vec::new()).restart_needed);
        let _ = std::fs::remove_dir_all(path.parent().expect("dir"));
    }

    #[test]
    fn status_serializes_camel_case_without_luids() {
        let state = GpuState {
            path: None,
            startup: Startup::default(),
        };
        let json = serde_json::to_value(state.status(vec![adapter("10de:2d58:10741043", (0, 1))]))
            .expect("json");
        assert_eq!(json["adapters"][0]["id"], "10de:2d58:10741043");
        assert_eq!(json["adapters"][0]["kind"], "unknown");
        assert!(json["adapters"][0].get("luid").is_none());
        assert_eq!(json["restartNeeded"], false);
        assert_eq!(json["supported"], false);
    }

    #[cfg(windows)]
    #[test]
    fn lists_hardware_adapters_on_this_machine() {
        // Smoke test: never panics; every listed adapter has a well-formed id and a name.
        for a in list_adapters(true) {
            // Visible with `cargo test gpu -- --nocapture` (checks the kind detection by eye).
            eprintln!("{a:?}");
            assert!(valid_id(&a.id), "{}", a.id);
            assert!(!a.name.is_empty());
        }
    }
}
