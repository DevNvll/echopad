//! Echopad Sync Module
//! 
//! Provides vault synchronization with support for
//! both managed Cloudflare and self-hosted backends.

pub mod crypto;
pub mod auth;
pub mod client;
pub mod state;
pub mod watcher;
pub mod conflict;
pub mod queue;
pub mod error;
pub mod types;
pub mod commands;
pub mod scanner;
pub mod engine;

pub use commands::SyncState;

