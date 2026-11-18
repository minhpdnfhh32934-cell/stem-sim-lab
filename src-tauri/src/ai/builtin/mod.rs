//! Qwen 3.5 9B inside the app (#190): a bundled `llama-server` (llama.cpp, Vulkan) that Rust
//! starts on loopback with a key only Rust knows, on a discrete card with 8 GB or more.

// Wired into the commands in step 5 of #190; until then only the tests use these items.
#![allow(dead_code)]

pub mod device;
pub mod model;
