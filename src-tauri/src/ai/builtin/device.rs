//! Which graphics card may run Qwen inside the app (#190, user answer 11/11/2026: only a
//! discrete card with at least 8 GB of its own memory; an integrated card is always refused).
//!
//! The card comes from `gpu.rs` (DXGI: discrete = not UMA, `dedicated_mb`). `llama-server` names
//! its Vulkan devices by the same driver name, so the two lists are matched by name. Vulkan's
//! own memory size is never trusted: an integrated card reports shared system memory (the
//! desktop's Intel UHD 770 says 16 272 MiB, 18/11/2026).

use serde::Serialize;

use crate::gpu::{GpuAdapter, GpuKind};

/// Qwen 3.5 9B Q4_K_M with a 6 000-token context needs about 6,3 GB (measured 18/11/2026);
/// 8 GB leaves room for the screen and the app.
pub const MIN_DEDICATED_MB: u64 = 8192;

/// One line of `llama-server --list-devices`, e.g. `  Vulkan0: NVIDIA GeForce RTX 4080 (…)`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VulkanDevice {
    /// The value for `--device`, e.g. `Vulkan0`.
    pub id: String,
    pub name: String,
}

/// The card Qwen runs on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    /// `--device` value. Never sent to the page.
    #[serde(skip)]
    pub vulkan_id: String,
    pub name: String,
    pub dedicated_mb: u64,
}

/// Why no card may run Qwen. The page explains each one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "reason", rename_all = "camelCase")]
pub enum Ineligible {
    /// No discrete card at all (integrated only, or no card the app can read).
    NoDiscrete,
    /// The largest discrete card has less than [`MIN_DEDICATED_MB`].
    #[serde(rename_all = "camelCase")]
    TooSmall { name: String, dedicated_mb: u64 },
    /// A discrete card is there, but the runtime does not list it (driver without Vulkan).
    NotListed { name: String },
    /// The app could not tell whether a card is integrated (no D3D12 device): refused, as the
    /// card might be integrated.
    #[serde(rename_all = "camelCase")]
    UnknownKind { name: String },
}

/// Parses `llama-server --list-devices` (its output after "Available devices:").
pub fn parse_list_devices(out: &str) -> Vec<VulkanDevice> {
    out.lines()
        .filter_map(|line| {
            let (id, rest) = line.trim().split_once(": ")?;
            let valid = id
                .strip_prefix("Vulkan")
                .is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()));
            if !valid {
                return None;
            }
            // The name ends before the memory, " (16048 MiB, 15280 MiB free)".
            let name = rest.rsplit_once(" (").map_or(rest, |(n, _)| n).trim();
            (!name.is_empty()).then(|| VulkanDevice {
                id: id.to_string(),
                name: name.to_string(),
            })
        })
        .collect()
}

fn same_name(a: &str, b: &str) -> bool {
    let norm = |s: &str| {
        s.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase()
    };
    norm(a) == norm(b)
}

/// The card for Qwen: a discrete adapter with [`MIN_DEDICATED_MB`], matched to its Vulkan
/// device. A name shared with a card that is not eligible is refused (the Vulkan index could be
/// that card).
// shortcut: with two eligible cards the one with more memory wins, not the Settings choice
// (`gpu.json`); read that choice if a learner with two large cards asks for it.
pub fn choose(adapters: &[GpuAdapter], devices: &[VulkanDevice]) -> Result<Device, Ineligible> {
    let eligible =
        |a: &GpuAdapter| a.kind == GpuKind::Discrete && a.dedicated_mb >= MIN_DEDICATED_MB;
    let mut best: Option<Device> = None;
    for a in adapters.iter().filter(|a| eligible(a)) {
        let others_alike = adapters
            .iter()
            .any(|b| !eligible(b) && same_name(&a.name, &b.name));
        let Some(dev) = devices.iter().find(|d| same_name(&d.name, &a.name)) else {
            continue;
        };
        if others_alike {
            continue;
        }
        if best
            .as_ref()
            .map_or(true, |b| a.dedicated_mb > b.dedicated_mb)
        {
            best = Some(Device {
                vulkan_id: dev.id.clone(),
                name: a.name.clone(),
                dedicated_mb: a.dedicated_mb,
            });
        }
    }
    if let Some(device) = best {
        return Ok(device);
    }
    // Explain the closest miss: an eligible card the runtime does not list, a card of unknown
    // kind, the largest discrete card, or none.
    if let Some(a) = adapters.iter().find(|a| eligible(a)) {
        return Err(Ineligible::NotListed {
            name: a.name.clone(),
        });
    }
    if let Some(a) = adapters.iter().find(|a| a.kind == GpuKind::Unknown) {
        return Err(Ineligible::UnknownKind {
            name: a.name.clone(),
        });
    }
    match adapters
        .iter()
        .filter(|a| a.kind == GpuKind::Discrete)
        .max_by_key(|a| a.dedicated_mb)
    {
        Some(a) => Err(Ineligible::TooSmall {
            name: a.name.clone(),
            dedicated_mb: a.dedicated_mb,
        }),
        None => Err(Ineligible::NoDiscrete),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card(name: &str, kind: GpuKind, dedicated_mb: u64) -> GpuAdapter {
        GpuAdapter {
            id: "10de:2704:179510de".into(),
            name: name.into(),
            vendor_id: 0,
            device_id: 0,
            kind,
            dedicated_mb,
            shared_mb: 16_000,
            luid: (0, 0),
        }
    }

    /// The desktop's real output (18/11/2026, llama.cpp b12246).
    const DESKTOP: &str = "Available devices:\n  Vulkan0: NVIDIA GeForce RTX 4080 (16048 MiB, 15280 MiB free)\n  Vulkan1: Intel(R) UHD Graphics 770 (16272 MiB, 15504 MiB free)\n";

    #[test]
    fn reads_the_device_list() {
        assert_eq!(
            parse_list_devices(DESKTOP),
            vec![
                VulkanDevice {
                    id: "Vulkan0".into(),
                    name: "NVIDIA GeForce RTX 4080".into()
                },
                VulkanDevice {
                    id: "Vulkan1".into(),
                    name: "Intel(R) UHD Graphics 770".into()
                },
            ]
        );
        assert!(parse_list_devices("Available devices:\n").is_empty());
        // Only Vulkan devices: a CPU or another backend line is never a `--device` value.
        assert!(parse_list_devices(
            "  CPU: AMD Ryzen (32000 MiB)\n  Vulkan: x (1 MiB)\n  VulkanA: y (1 MiB)"
        )
        .is_empty());
    }

    #[test]
    fn picks_the_discrete_card_never_the_integrated_one() {
        let adapters = [
            card("NVIDIA GeForce RTX 4080", GpuKind::Discrete, 16_376),
            card("Intel(R) UHD Graphics 770", GpuKind::Integrated, 128),
        ];
        let d = choose(&adapters, &parse_list_devices(DESKTOP)).unwrap();
        assert_eq!(d.vulkan_id, "Vulkan0");
        assert_eq!(d.name, "NVIDIA GeForce RTX 4080");
        // The Vulkan index follows the name, not the order.
        let swapped = "  Vulkan0: Intel(R) UHD Graphics 770 (16272 MiB, 1 MiB free)\n  Vulkan1: NVIDIA GeForce RTX 4080 (16048 MiB, 1 MiB free)";
        assert_eq!(
            choose(&adapters, &parse_list_devices(swapped))
                .unwrap()
                .vulkan_id,
            "Vulkan1"
        );
    }

    #[test]
    fn refuses_a_laptop_with_only_an_amd_integrated_card() {
        // The lead's laptop crashed (0x119) running a model on its Radeon 610M; a large UMA
        // carve-out still counts as integrated.
        let adapters = [card("AMD Radeon(TM) 610M", GpuKind::Integrated, 8192)];
        let devices =
            parse_list_devices("  Vulkan0: AMD Radeon(TM) 610M (12000 MiB, 11000 MiB free)");
        assert_eq!(choose(&adapters, &devices), Err(Ineligible::NoDiscrete));
        assert_eq!(choose(&[], &devices), Err(Ineligible::NoDiscrete));
    }

    #[test]
    fn refuses_a_discrete_card_under_8_gb() {
        let adapters = [
            card(
                "NVIDIA GeForce RTX 3050 Laptop GPU",
                GpuKind::Discrete,
                4096,
            ),
            card("AMD Radeon(TM) Graphics", GpuKind::Integrated, 512),
        ];
        let devices = parse_list_devices(
            "  Vulkan0: NVIDIA GeForce RTX 3050 Laptop GPU (3900 MiB, 1 MiB free)",
        );
        assert_eq!(
            choose(&adapters, &devices),
            Err(Ineligible::TooSmall {
                name: "NVIDIA GeForce RTX 3050 Laptop GPU".into(),
                dedicated_mb: 4096
            })
        );
        let just = [card("Arc A750", GpuKind::Discrete, MIN_DEDICATED_MB)];
        let arc = parse_list_devices("  Vulkan0: Arc A750 (8000 MiB, 1 MiB free)");
        assert!(choose(&just, &arc).is_ok());
        let under = [card("Arc A750", GpuKind::Discrete, MIN_DEDICATED_MB - 1)];
        assert!(choose(&under, &arc).is_err());
    }

    #[test]
    fn refuses_a_card_of_unknown_kind_or_one_the_runtime_does_not_list() {
        let unknown = [card("Some GPU", GpuKind::Unknown, 16_000)];
        let devices = parse_list_devices("  Vulkan0: Some GPU (16000 MiB, 1 MiB free)");
        assert_eq!(
            choose(&unknown, &devices),
            Err(Ineligible::UnknownKind {
                name: "Some GPU".into()
            })
        );
        let rtx = [card("NVIDIA GeForce RTX 4080", GpuKind::Discrete, 16_376)];
        assert_eq!(
            choose(&rtx, &devices),
            Err(Ineligible::NotListed {
                name: "NVIDIA GeForce RTX 4080".into()
            })
        );
    }

    #[test]
    fn refuses_a_name_shared_with_an_integrated_card() {
        let adapters = [
            card("Radeon Graphics", GpuKind::Discrete, 16_000),
            card("Radeon Graphics", GpuKind::Integrated, 512),
        ];
        let devices = parse_list_devices("  Vulkan0: Radeon Graphics (512 MiB, 1 MiB free)\n  Vulkan1: Radeon Graphics (16000 MiB, 1 MiB free)");
        assert!(choose(&adapters, &devices).is_err());
    }

    #[test]
    fn with_two_large_cards_takes_the_one_with_more_memory() {
        let adapters = [
            card("Card A", GpuKind::Discrete, 8192),
            card("Card B", GpuKind::Discrete, 24_576),
        ];
        let devices = parse_list_devices(
            "  Vulkan0: Card A (8000 MiB, 1 MiB free)\n  Vulkan1: card  b (24000 MiB, 1 MiB free)",
        );
        assert_eq!(choose(&adapters, &devices).unwrap().vulkan_id, "Vulkan1");
    }
}
