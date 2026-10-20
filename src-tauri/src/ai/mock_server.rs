//! Mock HTTP servers for tests (local runtimes and cloud streaming). Every server is a std thread
//! bound to a free port on 127.0.0.1 that answers from a script: no real runtime or provider is
//! ever started or contacted.

use std::io::{ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::Value;

pub(crate) struct Req {
    pub method: String,
    pub path: String,
    pub body: String,
}

#[derive(Clone)]
pub(crate) enum Step {
    Send(Vec<u8>),
    Wait(u64),
    /// Waits until the client closes the connection and reports it.
    WaitForClose,
}

pub(crate) struct Mock {
    pub port: u16,
    pub seen: Arc<Mutex<Vec<(String, String)>>>,
    pub closed: mpsc::Receiver<bool>,
}

impl Mock {
    /// `http://127.0.0.1:<port>`
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// "METHOD /path" of every request, in order.
    pub fn seen(&self) -> Vec<String> {
        self.seen
            .lock()
            .unwrap()
            .iter()
            .map(|(r, _)| r.clone())
            .collect()
    }

    pub fn body_of(&self, path: &str) -> Value {
        let seen = self.seen.lock().unwrap();
        let (_, body) = seen
            .iter()
            .find(|(r, _)| r.ends_with(path))
            .unwrap_or_else(|| panic!("no request to {path}"));
        serde_json::from_str(body).unwrap()
    }
}

fn read_request(s: &mut TcpStream) -> Option<Req> {
    let mut head = Vec::new();
    let mut byte = [0u8; 1];
    while !head.ends_with(b"\r\n\r\n") {
        match s.read(&mut byte) {
            Ok(1) => head.push(byte[0]),
            _ => return None,
        }
    }
    let head = String::from_utf8_lossy(&head).into_owned();
    let mut first = head.lines().next()?.split(' ');
    let method = first.next()?.to_string();
    let path = first.next()?.to_string();
    let len = head
        .lines()
        .filter_map(|l| l.split_once(':'))
        .find(|(k, _)| k.eq_ignore_ascii_case("content-length"))
        .and_then(|(_, v)| v.trim().parse::<usize>().ok())
        .unwrap_or(0);
    let mut body = vec![0u8; len];
    s.read_exact(&mut body).ok()?;
    Some(Req {
        method,
        path,
        body: String::from_utf8_lossy(&body).into_owned(),
    })
}

fn closed_by_peer(s: &mut TcpStream) -> bool {
    s.set_read_timeout(Some(Duration::from_secs(5))).ok();
    let mut buf = [0u8; 256];
    loop {
        match s.read(&mut buf) {
            Ok(0) => return true,
            Ok(_) => continue,
            Err(e) => {
                return matches!(
                    e.kind(),
                    ErrorKind::ConnectionReset
                        | ErrorKind::ConnectionAborted
                        | ErrorKind::BrokenPipe
                )
            }
        }
    }
}

pub(crate) fn serve(handler: impl Fn(&Req) -> Vec<Step> + Send + Sync + 'static) -> Mock {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let seen = Arc::new(Mutex::new(Vec::new()));
    let (tx, closed) = mpsc::channel();
    let handler = Arc::new(handler);
    let log = seen.clone();
    thread::spawn(move || {
        for conn in listener.incoming() {
            let Ok(mut stream) = conn else { break };
            let (handler, log, tx) = (handler.clone(), log.clone(), tx.clone());
            thread::spawn(move || {
                stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
                let Some(req) = read_request(&mut stream) else {
                    return;
                };
                let steps = handler(&req);
                log.lock()
                    .unwrap()
                    .push((format!("{} {}", req.method, req.path), req.body));
                for step in steps {
                    match step {
                        Step::Send(bytes) => {
                            if stream
                                .write_all(&bytes)
                                .and_then(|_| stream.flush())
                                .is_err()
                            {
                                let _ = tx.send(true);
                                return;
                            }
                        }
                        Step::Wait(ms) => thread::sleep(Duration::from_millis(ms)),
                        Step::WaitForClose => {
                            let _ = tx.send(closed_by_peer(&mut stream));
                        }
                    }
                }
            });
        }
    });
    Mock { port, seen, closed }
}

/// A whole JSON answer with extra header lines (each ending in "\r\n").
pub(crate) fn json_answer_with(status: &str, headers: &str, body: &str) -> Vec<Step> {
    vec![Step::Send(
        format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\n{headers}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .into_bytes(),
    )]
}

pub(crate) fn json_answer(status: &str, body: &str) -> Vec<Step> {
    json_answer_with(status, "", body)
}

/// Headers of a streamed answer whose body ends when the connection closes.
pub(crate) fn stream_head(content_type: &str) -> Step {
    Step::Send(
        format!("HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nConnection: close\r\n\r\n")
            .into_bytes(),
    )
}
