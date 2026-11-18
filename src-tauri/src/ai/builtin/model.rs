//! The Qwen model file (#190): the exact GGUF of the 10/11/2026 measurement, pinned here and in
//! `docs/AI_TUTOR.md`. Rust downloads it (the page never does, so the CSP is unchanged), only
//! from HuggingFace and the hosts it redirects to, after checking the free disk space. A broken
//! or cancelled download keeps its `.partial` file and resumes with an HTTP range; the finished
//! file is kept only when its SHA-256 matches.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Pinned {
    pub repo: &'static str,
    pub revision: &'static str,
    pub file: &'static str,
    pub sha256: &'static str,
    pub size: u64,
}

pub const MODEL: Pinned = Pinned {
    repo: "lmstudio-community/Qwen3.5-9B-GGUF",
    revision: "1379f25c6b505a3fc737bd7818cb09389cf807c1",
    file: "Qwen3.5-9B-Q4_K_M.gguf",
    sha256: "cd76ec205963b3b33350093e6904d9de16c4e666fd104e1f632d25c7f15f2a13",
    size: 5_627_044_256,
};

impl Pinned {
    /// The one address a download starts from.
    pub fn url(&self) -> String {
        format!(
            "https://huggingface.co/{}/resolve/{}/{}",
            self.repo, self.revision, self.file
        )
    }
}

/// HuggingFace and the CDN hosts it redirects to: the model hosts of the production CSP
/// (`tests/tauri-config.test.ts`), nothing else.
pub fn allowed_host(host: &str) -> bool {
    matches!(
        host,
        "huggingface.co" | "cdn-lfs.huggingface.co" | "cas-bridge.xethub.huggingface.co"
    ) || (host.ends_with(".hf.co") && host.len() > ".hf.co".len())
}

/// A download address is allowed: HTTPS to an [`allowed_host`].
pub fn allowed_url(url: &reqwest::Url) -> bool {
    url.scheme() == "https" && url.host_str().is_some_and(allowed_host)
}

/// Left free on the disk after the download.
pub const SPARE_BYTES: u64 = 1 << 30;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
/// The longest wait for the next bytes; the download itself has no total limit.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);
/// Progress is reported at most every this many bytes (and at the end).
const PROGRESS_STEP: u64 = 4 << 20;

/// Why a download stopped. `Offline`, `Stalled` and `Cancelled` keep the `.partial` file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DownloadError {
    NoSpace {
        need: u64,
        free: u64,
    },
    Offline {
        detail: String,
    },
    Stalled,
    Http {
        status: u16,
    },
    /// A redirect to a host outside [`allowed_host`].
    BadHost,
    /// The server's file is not the pinned size.
    BadSize,
    BadHash,
    Cancelled,
    Disk {
        detail: String,
    },
}

/// What is on disk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum FileState {
    Missing,
    Partial { bytes: u64 },
    Ready,
}

pub fn final_path(dir: &Path, pin: &Pinned) -> PathBuf {
    dir.join(pin.file)
}

pub fn partial_path(dir: &Path, pin: &Pinned) -> PathBuf {
    dir.join(format!("{}.partial", pin.file))
}

fn len(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .filter(|m| m.is_file())
        .map(|m| m.len())
}

/// The finished file is only ever written by a checked rename, so its size is enough here.
pub fn file_state(dir: &Path, pin: &Pinned) -> FileState {
    if len(&final_path(dir, pin)) == Some(pin.size) {
        FileState::Ready
    } else {
        match len(&partial_path(dir, pin)) {
            Some(bytes) => FileState::Partial { bytes },
            None => FileState::Missing,
        }
    }
}

/// Deletes the model and any partial download.
pub fn delete(dir: &Path, pin: &Pinned) -> Result<(), DownloadError> {
    for p in [final_path(dir, pin), partial_path(dir, pin)] {
        match fs::remove_file(&p) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(disk(&e)),
            _ => {}
        }
    }
    Ok(())
}

/// The download client: every redirect must stay on an allowed address (`allow`; HTTPS to
/// HuggingFace in the app, the test server in tests).
pub fn client(allow: fn(&reqwest::Url) -> bool) -> Result<reqwest::Client, DownloadError> {
    reqwest::Client::builder()
        .user_agent(concat!("STEM-Sim-Lab/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(IDLE_TIMEOUT)
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() >= 10 {
                attempt.error("too many redirects")
            } else if allow(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("redirect to a host outside the list")
            }
        }))
        .build()
        .map_err(|e| DownloadError::Offline {
            detail: e.to_string(),
        })
}

fn disk(e: &std::io::Error) -> DownloadError {
    DownloadError::Disk {
        detail: e.to_string(),
    }
}

fn net(e: &reqwest::Error) -> DownloadError {
    if e.is_redirect() {
        DownloadError::BadHost
    } else if e.is_timeout() {
        DownloadError::Stalled
    } else {
        DownloadError::Offline {
            detail: match std::error::Error::source(e) {
                Some(s) => format!("{e}: {s}"),
                None => e.to_string(),
            },
        }
    }
}

/// Free bytes on the disk that holds `dir` (`None` when Windows cannot say, or off Windows).
#[cfg(windows)]
pub fn free_bytes(dir: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let wide: Vec<u16> = dir.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut free = 0u64;
    unsafe { GetDiskFreeSpaceExW(PCWSTR(wide.as_ptr()), Some(&mut free), None, None) }.ok()?;
    Some(free)
}

#[cfg(not(windows))]
pub fn free_bytes(_dir: &Path) -> Option<u64> {
    None
}

/// The start of a `Content-Range: bytes <start>-<end>/<total>` answer.
fn range_start_total(value: &str) -> Option<(u64, u64)> {
    let (range, total) = value.strip_prefix("bytes ")?.split_once('/')?;
    let start = range.split_once('-')?.0.trim().parse().ok()?;
    Some((start, total.trim().parse().ok()?))
}

fn sha256_of(path: &Path) -> Result<String, DownloadError> {
    let mut f = File::open(path).map_err(|e| disk(&e))?;
    let mut hash = Sha256::new();
    let mut buf = vec![0u8; 8 << 20];
    loop {
        let n = f.read(&mut buf).map_err(|e| disk(&e))?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
    }
    Ok(hash.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Checks the finished `.partial` file and renames it; a wrong hash deletes it.
async fn finish(dir: &Path, pin: &Pinned) -> Result<PathBuf, DownloadError> {
    let partial = partial_path(dir, pin);
    let check = partial.clone();
    let sha = tauri::async_runtime::spawn_blocking(move || sha256_of(&check))
        .await
        .map_err(|e| DownloadError::Disk {
            detail: e.to_string(),
        })??;
    if sha != pin.sha256 {
        let _ = fs::remove_file(&partial);
        return Err(DownloadError::BadHash);
    }
    let done = final_path(dir, pin);
    fs::rename(&partial, &done).map_err(|e| disk(&e))?;
    Ok(done)
}

/// Downloads `pin` from `url` into `dir`, resuming a `.partial` file. `free` is the free space
/// of `dir`'s disk ([`free_bytes`]); `progress` gets the bytes on disk so far.
pub async fn download(
    http: &reqwest::Client,
    url: &str,
    dir: &Path,
    pin: &Pinned,
    free: Option<u64>,
    cancel: &AtomicBool,
    progress: &mut (dyn FnMut(u64) + Send),
) -> Result<PathBuf, DownloadError> {
    fs::create_dir_all(dir).map_err(|e| disk(&e))?;
    if file_state(dir, pin) == FileState::Ready {
        return Ok(final_path(dir, pin));
    }
    let partial = partial_path(dir, pin);
    let mut have = len(&partial).unwrap_or(0);
    if have > pin.size {
        fs::remove_file(&partial).map_err(|e| disk(&e))?;
        have = 0;
    }
    let need = pin.size - have + SPARE_BYTES;
    if let Some(free) = free.filter(|&f| f < need) {
        return Err(DownloadError::NoSpace { need, free });
    }
    if have < pin.size {
        let mut rb = http.get(url);
        if have > 0 {
            rb = rb.header(reqwest::header::RANGE, format!("bytes={have}-"));
        }
        let mut resp = rb.send().await.map_err(|e| net(&e))?;
        let status = resp.status().as_u16();
        let append = match status {
            206 => {
                let range = resp
                    .headers()
                    .get(reqwest::header::CONTENT_RANGE)
                    .and_then(|v| v.to_str().ok())
                    .and_then(range_start_total);
                if range != Some((have, pin.size)) {
                    let _ = fs::remove_file(&partial);
                    return Err(DownloadError::BadSize);
                }
                true
            }
            200 => {
                if resp.content_length().is_some_and(|n| n != pin.size) {
                    return Err(DownloadError::BadSize);
                }
                have = 0;
                false
            }
            _ => return Err(DownloadError::Http { status }),
        };
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .append(append)
            .truncate(!append)
            .open(&partial)
            .map_err(|e| disk(&e))?;
        progress(have);
        let mut reported = have;
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err(DownloadError::Cancelled);
            }
            let Some(chunk) = resp.chunk().await.map_err(|e| net(&e))? else {
                break;
            };
            if have + chunk.len() as u64 > pin.size {
                drop(file);
                let _ = fs::remove_file(&partial);
                return Err(DownloadError::BadSize);
            }
            file.write_all(&chunk).map_err(|e| disk(&e))?;
            have += chunk.len() as u64;
            if have - reported >= PROGRESS_STEP || have == pin.size {
                progress(have);
                reported = have;
            }
        }
        file.sync_all().map_err(|e| disk(&e))?;
        if have < pin.size {
            return Err(DownloadError::Offline {
                detail: format!("connection closed at {have} of {} bytes", pin.size),
            });
        }
    }
    finish(dir, pin).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::mock_server::{serve, Mock, Req, Step};

    fn bytes() -> Vec<u8> {
        (0..200_000u32).map(|i| (i * 7 % 251) as u8).collect()
    }

    fn pin_of(data: &[u8]) -> Pinned {
        let sha: String = Sha256::digest(data)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        Pinned {
            repo: "test/repo",
            revision: "0",
            file: "model.gguf",
            sha256: Box::leak(sha.into_boxed_str()),
            size: data.len() as u64,
        }
    }

    fn loopback(url: &reqwest::Url) -> bool {
        url.host_str() == Some("127.0.0.1")
    }

    fn range_of(r: &Req) -> Option<u64> {
        r.head
            .lines()
            .find_map(|l| {
                l.strip_prefix("Range: bytes=")
                    .or(l.strip_prefix("range: bytes="))
            })
            .and_then(|v| v.trim_end_matches('-').parse().ok())
    }

    fn head(status: &str, extra: &str, len: usize) -> Step {
        Step::Send(
            format!(
                "HTTP/1.1 {status}\r\n{extra}Content-Length: {len}\r\nConnection: close\r\n\r\n"
            )
            .into_bytes(),
        )
    }

    /// A file server with ranges; `cut` stops the first answer after that many bytes. A whole
    /// answer waits for the client to close: closing right after a large write sometimes reset
    /// the loopback connection on Windows (body error after ~19 s, 18/11/2026).
    fn files(data: Vec<u8>, cut: Option<usize>) -> Mock {
        let first = std::sync::atomic::AtomicBool::new(true);
        serve(move |r| {
            let from = range_of(r).unwrap_or(0) as usize;
            let rest = &data[from..];
            let mut steps = vec![if from > 0 {
                head(
                    "206 Partial Content",
                    &format!(
                        "Content-Range: bytes {from}-{}/{}\r\n",
                        data.len() - 1,
                        data.len()
                    ),
                    rest.len(),
                )
            } else {
                head("200 OK", "", rest.len())
            }];
            match cut.filter(|_| first.swap(false, Ordering::SeqCst)) {
                Some(n) => steps.push(Step::Send(rest[..n].to_vec())),
                None => steps.extend([Step::Send(rest.to_vec()), Step::WaitForClose]),
            }
            steps
        })
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("simlab-model-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn run(
        mock: &Mock,
        dir: &Path,
        pin: &Pinned,
        free: Option<u64>,
        cancel: &AtomicBool,
    ) -> (Result<PathBuf, DownloadError>, Vec<u64>) {
        let http = client(loopback).unwrap();
        let mut seen = Vec::new();
        let r = tauri::async_runtime::block_on(async {
            download(
                &http,
                &format!("{}/model.gguf", mock.url()),
                dir,
                pin,
                free,
                cancel,
                &mut |n| seen.push(n),
            )
            .await
        });
        (r, seen)
    }

    #[test]
    fn pins_the_measured_file_and_the_same_values_as_the_docs() {
        assert_eq!(
            MODEL.url(),
            "https://huggingface.co/lmstudio-community/Qwen3.5-9B-GGUF/resolve/1379f25c6b505a3fc737bd7818cb09389cf807c1/Qwen3.5-9B-Q4_K_M.gguf"
        );
        let doc = include_str!("../../../../docs/AI_TUTOR.md");
        for v in [
            MODEL.repo,
            MODEL.revision,
            MODEL.file,
            MODEL.sha256,
            "5 627 044 256 bytes",
        ] {
            assert!(doc.contains(v), "docs/AI_TUTOR.md lacks {v}");
        }
        assert_eq!(MODEL.size, 5_627_044_256);
    }

    #[test]
    fn only_huggingface_hosts_over_https() {
        for ok in [
            "https://huggingface.co/x",
            "https://cdn-lfs.huggingface.co/x",
            "https://cas-bridge.xethub.huggingface.co/x",
            "https://us.aws.cdn.hf.co/x",
        ] {
            assert!(allowed_url(&reqwest::Url::parse(ok).unwrap()), "{ok}");
        }
        for bad in [
            "http://huggingface.co/x",
            "https://huggingface.co.example.com/x",
            "https://evilhf.co/x",
            "https://hf.co/x",
            "https://.hf.co/x",
            "https://example.com/x",
            "https://127.0.0.1/x",
        ] {
            assert!(!allowed_url(&reqwest::Url::parse(bad).unwrap()), "{bad}");
        }
    }

    #[test]
    fn downloads_checks_and_keeps_the_file() {
        let data = bytes();
        let pin = pin_of(&data);
        let mock = files(data.clone(), None);
        let dir = temp_dir("ok");
        let (r, seen) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert_eq!(r.unwrap(), final_path(&dir, &pin));
        assert_eq!(fs::read(final_path(&dir, &pin)).unwrap(), data);
        assert!(!partial_path(&dir, &pin).exists());
        assert_eq!(seen.first(), Some(&0));
        assert_eq!(seen.last(), Some(&pin.size));
        assert_eq!(file_state(&dir, &pin), FileState::Ready);
        // Ready: no second request.
        let (r, _) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert!(r.is_ok());
        assert_eq!(mock.seen().len(), 1);
        delete(&dir, &pin).unwrap();
        assert_eq!(file_state(&dir, &pin), FileState::Missing);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resumes_a_broken_download_with_a_range() {
        let data = bytes();
        let pin = pin_of(&data);
        let mock = files(data.clone(), Some(70_000));
        let dir = temp_dir("resume");
        let (r, _) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert!(matches!(r, Err(DownloadError::Offline { .. })), "{r:?}");
        assert_eq!(file_state(&dir, &pin), FileState::Partial { bytes: 70_000 });
        let (r, seen) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert!(r.is_ok(), "{r:?}");
        assert_eq!(seen.first(), Some(&70_000));
        assert_eq!(fs::read(final_path(&dir, &pin)).unwrap(), data);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn starts_again_when_the_server_ignores_the_range() {
        let data = bytes();
        let pin = pin_of(&data);
        let whole = data.clone();
        let mock = serve(move |_| {
            vec![
                head("200 OK", "", whole.len()),
                Step::Send(whole.clone()),
                Step::WaitForClose,
            ]
        });
        let dir = temp_dir("norange");
        fs::create_dir_all(&dir).unwrap();
        fs::write(partial_path(&dir, &pin), &data[..1000]).unwrap();
        let (r, _) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert!(r.is_ok(), "{r:?}");
        assert_eq!(fs::read(final_path(&dir, &pin)).unwrap(), data);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_wrong_hash_deletes_the_file() {
        let data = bytes();
        let mut pin = pin_of(&data);
        pin.sha256 = "00";
        let mock = files(data, None);
        let dir = temp_dir("hash");
        let (r, _) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert_eq!(r, Err(DownloadError::BadHash));
        assert_eq!(file_state(&dir, &pin), FileState::Missing);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_wrong_size_is_refused() {
        let data = bytes();
        let mut pin = pin_of(&data);
        pin.size -= 1;
        let mock = files(data, None);
        let dir = temp_dir("size");
        let (r, _) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert_eq!(r, Err(DownloadError::BadSize));
        assert!(!final_path(&dir, &pin).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn checks_the_free_space_before_asking() {
        let data = bytes();
        let pin = pin_of(&data);
        let mock = files(data, None);
        let dir = temp_dir("space");
        let free = pin.size + SPARE_BYTES - 1;
        let (r, _) = run(&mock, &dir, &pin, Some(free), &AtomicBool::new(false));
        assert_eq!(
            r,
            Err(DownloadError::NoSpace {
                need: pin.size + SPARE_BYTES,
                free
            })
        );
        assert!(mock.seen().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_cancel_stops_and_keeps_the_partial_file() {
        let data = bytes();
        let pin = pin_of(&data);
        let mock = files(data, None);
        let dir = temp_dir("cancel");
        let (r, _) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(true));
        assert_eq!(r, Err(DownloadError::Cancelled));
        assert!(partial_path(&dir, &pin).exists());
        assert!(!final_path(&dir, &pin).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn never_follows_a_redirect_off_the_list() {
        let data = bytes();
        let pin = pin_of(&data);
        let mock = serve(|_| {
            vec![Step::Send(
                b"HTTP/1.1 302 Found\r\nLocation: https://example.com/model.gguf\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec(),
            )]
        });
        let dir = temp_dir("redirect");
        let (r, _) = run(&mock, &dir, &pin, Some(u64::MAX), &AtomicBool::new(false));
        assert_eq!(r, Err(DownloadError::BadHost));
        let _ = fs::remove_dir_all(&dir);
    }
}
