//! The bundled `llama-server` (#190): one process at a time, on 127.0.0.1 and a free port, with
//! a random key only Rust knows. The key reaches the server through a file deleted once it is
//! ready (never on the command line, where other programs could read it). The flags are the
//! measured ones (`-c 6000 -np 1 --jinja`, `docs/AI_TUTOR.md`), never `--lora`, and the server's
//! web page is off. On Windows the process sits in a job that Windows closes with the app, so
//! it cannot outlive SimLab even after a crash.

use std::ffi::OsString;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;

/// The model name the server answers to.
pub const ALIAS: &str = "qwen3.5-9b";
/// The measured context (`n_ctx_slot` rounds it to 6 144).
pub const CONTEXT: u32 = 6000;
/// Loading 5,6 GB from a slow disk can take minutes.
pub const READY_TIMEOUT: Duration = Duration::from_secs(180);
/// A server unused this long is stopped, to give the card's memory back.
pub const IDLE_STOP: Duration = Duration::from_secs(10 * 60);
const POLL: Duration = Duration::from_millis(250);

/// What one server needs.
pub struct Launch<'a> {
    pub model: &'a Path,
    /// `--device`, e.g. `Vulkan0` ([`super::device::choose`]).
    pub device: &'a str,
    pub port: u16,
    pub key_file: &'a Path,
}

/// The server's command line (the program is `llama-server.exe`).
pub fn args(l: &Launch) -> Vec<OsString> {
    let mut a: Vec<OsString> = Vec::new();
    let mut flag = |name: &str, value: Option<OsString>| {
        a.push(name.into());
        a.extend(value);
    };
    flag("-m", Some(l.model.into()));
    flag("--alias", Some(ALIAS.into()));
    flag("--device", Some(l.device.into()));
    flag("-ngl", Some("99".into()));
    flag("-c", Some(CONTEXT.to_string().into()));
    flag("-np", Some("1".into()));
    flag("--jinja", None);
    flag("--no-webui", None);
    flag("--host", Some("127.0.0.1".into()));
    flag("--port", Some(l.port.to_string().into()));
    flag("--api-key-file", Some(l.key_file.into()));
    a
}

/// A line of the server's log that says the card failed (ggml's Vulkan backend reports
/// `vk::…: ErrorDeviceLost`).
pub fn is_gpu_fault(line: &str) -> bool {
    let l = line.to_ascii_lowercase();
    l.contains("errordevicelost") || l.contains("device lost") || l.contains("device_lost")
}

/// A free port on 127.0.0.1 (the server binds it right after; a race only makes it fail to
/// start, and the next start picks another).
pub fn free_port() -> Option<u16> {
    let l = TcpListener::bind("127.0.0.1:0").ok()?;
    l.local_addr().ok().map(|a| a.port())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// 32 bytes from the system's random generator, as hex.
#[cfg(windows)]
pub fn random_key() -> Option<String> {
    use windows::Win32::Security::Cryptography::{
        BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
    };
    let mut b = [0u8; 32];
    unsafe { BCryptGenRandom(None, &mut b, BCRYPT_USE_SYSTEM_PREFERRED_RNG) }
        .is_ok()
        .then(|| hex(&b))
}

#[cfg(not(windows))]
pub fn random_key() -> Option<String> {
    use std::io::Read;
    let mut b = [0u8; 32];
    std::fs::File::open("/dev/urandom")
        .and_then(|mut f| f.read_exact(&mut b))
        .ok()
        .map(|()| hex(&b))
}

/// Why a server did not start.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum StartError {
    NoPort,
    NoKey,
    Disk {
        detail: String,
    },
    Spawn {
        detail: String,
    },
    /// The process ended before it was ready.
    #[serde(rename_all = "camelCase")]
    Exited {
        code: Option<i32>,
        gpu_fault: bool,
    },
    /// Not ready in time; the process was stopped.
    NotReady,
}

/// Kills the server when SimLab closes, even after a crash (Windows job).
#[cfg(windows)]
struct Job(windows::Win32::Foundation::HANDLE);

// A job handle is a kernel handle: usable from any thread.
#[cfg(windows)]
unsafe impl Send for Job {}
#[cfg(windows)]
unsafe impl Sync for Job {}

#[cfg(windows)]
impl Job {
    fn holding(child: &Child) -> Option<Job> {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };
        let job = Job(unsafe { CreateJobObjectW(None, windows::core::PCWSTR::null()) }.ok()?);
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        unsafe {
            SetInformationJobObject(
                job.0,
                JobObjectExtendedLimitInformation,
                (&info as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .ok()?;
            AssignProcessToJobObject(job.0, HANDLE(child.as_raw_handle())).ok()?;
        }
        Some(job)
    }
}

#[cfg(windows)]
impl Drop for Job {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

#[cfg(not(windows))]
struct Job;

#[cfg(not(windows))]
impl Job {
    fn holding(_child: &Child) -> Option<Job> {
        None
    }
}

/// A running server. Dropping it stops the process.
pub struct Server {
    child: Child,
    _job: Option<Job>,
    pub port: u16,
    key: String,
    fault: Arc<AtomicBool>,
    last_used: Instant,
}

impl Server {
    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// The key requests must send (`Authorization: Bearer`). Stays in Rust.
    pub fn key(&self) -> &str {
        &self.key
    }

    /// The log reported a lost card.
    pub fn gpu_fault(&self) -> bool {
        self.fault.load(Ordering::SeqCst)
    }

    /// The process has ended.
    pub fn exited(&mut self) -> bool {
        !matches!(self.child.try_wait(), Ok(None))
    }

    pub fn touch(&mut self) {
        self.last_used = Instant::now();
    }

    pub fn idle_for(&self) -> Duration {
        self.last_used.elapsed()
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// How to run one server. Tests run a stand-in program here.
pub struct Spawn {
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub envs: Vec<(String, String)>,
    pub port: u16,
    pub key: String,
    pub key_file: PathBuf,
}

/// Starts the server and waits until `/health` answers "ok" with the key, or the process ends,
/// or `ready` passes. The key file exists only until then.
pub async fn start(
    spec: Spawn,
    ready: Duration,
    http: &reqwest::Client,
) -> Result<Server, StartError> {
    if let Some(dir) = spec.key_file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| StartError::Disk {
            detail: e.to_string(),
        })?;
    }
    std::fs::write(&spec.key_file, &spec.key).map_err(|e| StartError::Disk {
        detail: e.to_string(),
    })?;
    let result = spawn_and_wait(&spec, ready, http).await;
    let _ = std::fs::remove_file(&spec.key_file);
    result
}

async fn spawn_and_wait(
    spec: &Spawn,
    ready: Duration,
    http: &reqwest::Client,
) -> Result<Server, StartError> {
    let mut cmd = Command::new(&spec.program);
    cmd.args(&spec.args)
        .envs(spec.envs.iter().map(|(k, v)| (k, v)))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: no console window flashes up.
        cmd.creation_flags(0x0800_0000);
    }
    let mut child = cmd.spawn().map_err(|e| StartError::Spawn {
        detail: e.to_string(),
    })?;
    let job = Job::holding(&child);
    let fault = Arc::new(AtomicBool::new(false));
    if let Some(stderr) = child.stderr.take() {
        let fault = fault.clone();
        // Keeps reading until the process ends, so a full pipe never blocks the server.
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if is_gpu_fault(&line) {
                    fault.store(true, Ordering::SeqCst);
                }
            }
        });
    }
    let mut server = Server {
        child,
        _job: job,
        port: spec.port,
        key: spec.key.clone(),
        fault,
        last_used: Instant::now(),
    };
    let until = Instant::now() + ready;
    let health = format!("{}/health", server.base_url());
    loop {
        if let Ok(Some(status)) = server.child.try_wait() {
            // Let the log reader see the last lines.
            tokio::time::sleep(POLL).await;
            return Err(StartError::Exited {
                code: status.code(),
                gpu_fault: server.gpu_fault(),
            });
        }
        let asked = http
            .get(&health)
            .bearer_auth(&server.key)
            .timeout(Duration::from_secs(2))
            .send()
            .await;
        if asked.is_ok_and(|r| r.status().is_success()) {
            server.touch();
            return Ok(server);
        }
        if Instant::now() >= until {
            return Err(StartError::NotReady);
        }
        tokio::time::sleep(POLL).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    const FAKE: &str = "SIMLAB_FAKE_LLAMA";

    #[test]
    fn runs_the_measured_flags_on_loopback_with_the_key_in_a_file() {
        let model = Path::new("C:/data/Qwen3.5-9B-Q4_K_M.gguf");
        let key_file = Path::new("C:/data/key");
        let a: Vec<String> = args(&Launch {
            model,
            device: "Vulkan0",
            port: 41234,
            key_file,
        })
        .iter()
        .map(|s| s.to_string_lossy().into_owned())
        .collect();
        let line = a.join(" ");
        for part in [
            "-m C:/data/Qwen3.5-9B-Q4_K_M.gguf",
            "--alias qwen3.5-9b",
            "--device Vulkan0",
            "-c 6000",
            "-np 1",
            "--jinja",
            "--no-webui",
            "--host 127.0.0.1",
            "--port 41234",
            "--api-key-file C:/data/key",
        ] {
            assert!(line.contains(part), "{line} lacks {part}");
        }
        assert!(
            !a.iter().any(|s| s == "--api-key" || s.contains("lora")),
            "{line}"
        );
        assert_eq!(a.iter().filter(|s| *s == "--host").count(), 1);
    }

    #[test]
    fn recognises_a_lost_card_in_the_log() {
        assert!(is_gpu_fault(
            "terminate called after throwing 'vk::DeviceLostError' what(): vk::Queue::submit: ErrorDeviceLost"
        ));
        assert!(is_gpu_fault("ggml_vulkan: device lost"));
        assert!(!is_gpu_fault("srv  load_model: loading model"));
        assert!(!is_gpu_fault("ErrorOutOfDeviceMemory"));
    }

    #[test]
    fn makes_a_fresh_key_and_port_each_time() {
        let (a, b) = (random_key().unwrap(), random_key().unwrap());
        assert_eq!(a.len(), 64);
        assert_ne!(a, b);
        assert!(free_port().is_some_and(|p| p > 0));
    }

    /// The stand-in for `llama-server`: this test binary started again with `SIMLAB_FAKE_LLAMA`
    /// set. It reads its key from the key file (as `--api-key-file` does) and answers `/health`
    /// only with that key. In a normal test run it does nothing.
    #[test]
    fn fake_llama_server() {
        let Ok(mode) = std::env::var(FAKE) else {
            return;
        };
        let key = std::fs::read_to_string(std::env::var("FAKE_KEY_FILE").unwrap()).unwrap();
        match mode.as_str() {
            "exit" => std::process::exit(1),
            "devicelost" => {
                eprintln!("ggml_vulkan: vk::Queue::submit: ErrorDeviceLost");
                std::process::exit(3);
            }
            "hang" => loop {
                std::thread::sleep(Duration::from_secs(1));
            },
            _ => {}
        }
        let port: u16 = std::env::var("FAKE_PORT").unwrap().parse().unwrap();
        let auth = format!("authorization: bearer {key}");
        let listener = std::net::TcpListener::bind(("127.0.0.1", port)).unwrap();
        for conn in listener.incoming() {
            let Ok(mut s) = conn else { break };
            let mut head = Vec::new();
            let mut byte = [0u8; 1];
            while !head.ends_with(b"\r\n\r\n") && s.read(&mut byte).is_ok_and(|n| n == 1) {
                head.push(byte[0]);
            }
            let head = String::from_utf8_lossy(&head).to_lowercase();
            let ok = head.starts_with("get /health ") && head.lines().any(|l| l == auth);
            let (status, body) = if ok {
                ("200 OK", r#"{"status":"ok"}"#)
            } else {
                ("401 Unauthorized", r#"{"error":"Invalid API Key"}"#)
            };
            let _ = write!(
                s,
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
        }
    }

    fn fake(mode: &str, dir: &Path) -> Spawn {
        let port = free_port().unwrap();
        let key_file = dir.join("key");
        Spawn {
            program: std::env::current_exe().unwrap(),
            args: [
                "--exact",
                "ai::builtin::server::tests::fake_llama_server",
                "--nocapture",
                "--test-threads=1",
            ]
            .map(OsString::from)
            .to_vec(),
            envs: vec![
                (FAKE.into(), mode.into()),
                ("FAKE_PORT".into(), port.to_string()),
                (
                    "FAKE_KEY_FILE".into(),
                    key_file.to_string_lossy().into_owned(),
                ),
            ],
            port,
            key: random_key().unwrap(),
            key_file,
        }
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("simlab-server-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    fn http() -> reqwest::Client {
        reqwest::Client::builder().no_proxy().build().unwrap()
    }

    #[test]
    fn starts_answers_with_the_key_and_stops() {
        let dir = temp_dir("ok");
        let spec = fake("ok", &dir);
        let key_file = spec.key_file.clone();
        let http = http();
        let health = |key: Option<&str>, port: u16| {
            let mut rb = http.get(format!("http://127.0.0.1:{port}/health"));
            if let Some(k) = key {
                rb = rb.bearer_auth(k);
            }
            tauri::async_runtime::block_on(async move {
                rb.timeout(Duration::from_secs(2)).send().await
            })
            .map(|r| r.status().as_u16())
        };
        let mut server =
            tauri::async_runtime::block_on(start(spec, Duration::from_secs(30), &http)).unwrap();
        let port = server.port;
        assert_eq!(server.base_url(), format!("http://127.0.0.1:{port}"));
        assert!(!key_file.exists(), "the key file outlived the start");
        assert_eq!(health(Some(server.key()), port).unwrap(), 200);
        assert_eq!(health(None, port).unwrap(), 401);
        assert!(!server.exited() && !server.gpu_fault());
        assert!(server.idle_for() < Duration::from_secs(30));
        drop(server);
        assert!(
            health(None, port).is_err(),
            "the server outlived its handle"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reports_a_lost_card_when_the_server_dies_starting() {
        let dir = temp_dir("lost");
        let r = tauri::async_runtime::block_on(start(
            fake("devicelost", &dir),
            Duration::from_secs(30),
            &http(),
        ));
        assert!(
            matches!(
                r,
                Err(StartError::Exited {
                    code: Some(3),
                    gpu_fault: true
                })
            ),
            "{:?}",
            r.err()
        );
        let r = tauri::async_runtime::block_on(start(
            fake("exit", &dir),
            Duration::from_secs(30),
            &http(),
        ));
        assert!(
            matches!(
                r,
                Err(StartError::Exited {
                    code: Some(1),
                    gpu_fault: false
                })
            ),
            "{:?}",
            r.err()
        );
        assert!(!dir.join("key").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn stops_a_server_that_is_not_ready_in_time() {
        let dir = temp_dir("hang");
        let r = tauri::async_runtime::block_on(start(
            fake("hang", &dir),
            Duration::from_millis(1500),
            &http(),
        ));
        assert_eq!(r.err(), Some(StartError::NotReady));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
