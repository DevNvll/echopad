//! Sync type definitions

#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// Authentication response from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub user: UserInfo,
    pub device_id: String,
}

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub email_verified: bool,
    pub subscription_tier: SubscriptionTier,
    pub storage_quota_bytes: u64,
    pub storage_used_bytes: u64,
}

/// Subscription tiers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SubscriptionTier {
    Free,
    Pro,
    Team,
}

impl Default for SubscriptionTier {
    fn default() -> Self {
        Self::Free
    }
}

/// Sync status for a vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_logged_in: bool,
    pub user: Option<UserInfo>,
    pub vaults: Vec<VaultSyncStatus>,
    pub last_error: Option<String>,
}

/// Individual vault sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSyncStatus {
    pub vault_path: String,
    pub vault_id: Option<String>,
    pub enabled: bool,
    pub status: VaultSyncState,
    pub last_sync_at: Option<u64>,
    pub pending_changes: u32,
}

/// Vault sync state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VaultSyncState {
    Idle,
    Syncing,
    Error,
    Disabled,
}

impl Default for VaultSyncState {
    fn default() -> Self {
        Self::Idle
    }
}

/// Sync result after a sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperationResult {
    pub success: bool,
    pub files_uploaded: u32,
    pub files_downloaded: u32,
    pub files_deleted: u32,
    pub conflicts: Vec<ConflictInfo>,
    pub errors: Vec<String>,
    pub duration_ms: u64,
}

/// Conflict file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictInfo {
    pub original_path: String,
    pub conflict_path: String,
    pub local_modified_at: u64,
    pub remote_modified_at: u64,
    pub created_at: u64,
}

/// Device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: DeviceType,
    pub last_sync_at: Option<u64>,
    pub created_at: u64,
    pub is_current: bool,
}

/// Device type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DeviceType {
    Desktop,
    Mobile,
}

impl Default for DeviceType {
    fn default() -> Self {
        Self::Desktop
    }
}

/// Local change record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalChange {
    pub path: String,
    pub operation: ChangeOperation,
    pub content_hash: String,
    pub modified_at: u64,
    pub size: u64,
}

/// Change operation type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ChangeOperation {
    Create,
    Update,
    Delete,
}

/// Remote change from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteChange {
    pub id: String,
    pub encrypted_path: String,
    pub operation: ChangeOperation,
    pub content_hash: String,
    pub size: u64,
    pub modified_at: u64,
    pub version: u32,
    pub download_url: Option<String>,
}

/// Pull response from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullResponse {
    pub changes: Vec<RemoteChange>,
    pub next_cursor: String,
    pub has_more: bool,
}

/// Push request to server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushRequest {
    pub changes: Vec<PushChange>,
}

/// Individual push change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushChange {
    pub encrypted_path: String,
    pub operation: ChangeOperation,
    pub content_hash: String,
    pub size: u64,
    pub modified_at: u64,
    pub base_version: Option<u32>,
}

/// Push response from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushResponse {
    pub results: Vec<PushResult>,
    pub conflicts: Vec<ConflictInfo>,
}

/// Individual push result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushResult {
    pub encrypted_path: String,
    pub status: PushStatus,
    pub upload_url: Option<String>,
    pub new_version: Option<u32>,
    pub error: Option<String>,
}

/// Push status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PushStatus {
    Accepted,
    Conflict,
    Error,
}

/// Vault information from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub file_count: u32,
    pub total_size_bytes: u64,
}

/// Encrypted vault key from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedVaultKey {
    pub vault_id: String,
    pub encrypted_key: String,
    pub key_nonce: String,
}

/// Vault sync manifest stored in .lazuli-sync.json
/// This file is stored in the vault root to persist the vault-to-remote mapping
/// across app reinstalls and to enable automatic reconnection after auth loss.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSyncManifest {
    /// Remote vault ID on the sync server
    pub remote_vault_id: String,
    /// Server URL where this vault is synced
    pub server_url: String,
    /// User ID who owns this vault (for detecting account mismatch)
    pub user_id: String,
    /// Timestamp when the vault was first connected
    pub connected_at: u64,
}

impl VaultSyncManifest {
    /// Create a new manifest
    pub fn new(remote_vault_id: String, server_url: String, user_id: String) -> Self {
        Self {
            remote_vault_id,
            server_url,
            user_id,
            connected_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        }
    }
}

/// The filename for the sync manifest
pub const SYNC_MANIFEST_FILENAME: &str = ".lazuli-sync.json";

