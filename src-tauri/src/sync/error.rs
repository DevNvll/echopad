//! Sync error types

#![allow(dead_code)]

use thiserror::Error;

#[derive(Error, Debug)]
pub enum SyncError {
    #[error("Authentication required")]
    AuthRequired,

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Session expired")]
    SessionExpired,

    #[error("Device not registered")]
    DeviceNotRegistered,

    #[error("Vault not found: {0}")]
    VaultNotFound(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Sync conflict detected for: {0}")]
    Conflict(String),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Decryption error: {0}")]
    Decryption(String),

    #[error("Key derivation error: {0}")]
    KeyDerivation(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Server error: {0}")]
    Server(String),

    #[error("Rate limited, retry after {0} seconds")]
    RateLimited(u64),

    #[error("Storage quota exceeded")]
    QuotaExceeded,

    #[error("Database error: {0}")]
    Database(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Invalid state: {0}")]
    InvalidState(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),
}

impl From<SyncError> for String {
    fn from(err: SyncError) -> Self {
        err.to_string()
    }
}

// Helper type for sync results
pub type SyncResult<T> = Result<T, SyncError>;

