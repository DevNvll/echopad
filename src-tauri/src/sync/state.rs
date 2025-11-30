//! Sync state management

#![allow(dead_code)]

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use super::crypto::CryptoKey;
use super::error::SyncResult;
use super::types::{VaultSyncState, VaultSyncStatus};

/// Sync state for a vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultState {
    pub vault_path: String,
    pub vault_id: Option<String>,
    pub enabled: bool,
    pub last_cursor: Option<String>,
    pub last_sync_at: Option<u64>,
    pub status: VaultSyncState,
    pub last_error: Option<String>,
}

impl VaultState {
    pub fn new(vault_path: String) -> Self {
        Self {
            vault_path,
            vault_id: None,
            enabled: false,
            last_cursor: None,
            last_sync_at: None,
            status: VaultSyncState::Disabled,
            last_error: None,
        }
    }

    pub fn to_status(&self, pending_changes: u32) -> VaultSyncStatus {
        VaultSyncStatus {
            vault_path: self.vault_path.clone(),
            vault_id: self.vault_id.clone(),
            enabled: self.enabled,
            status: self.status.clone(),
            last_sync_at: self.last_sync_at,
            pending_changes,
        }
    }
}

/// File sync state entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSyncState {
    pub relative_path: String,
    pub local_hash: Option<String>,
    pub remote_hash: Option<String>,
    pub remote_version: Option<u32>,
    pub last_synced_at: Option<u64>,
}

/// Sync state manager
pub struct SyncStateManager {
    /// State for each vault (keyed by vault path)
    vaults: Arc<RwLock<HashMap<String, VaultState>>>,
    /// File states for each vault
    file_states: Arc<RwLock<HashMap<String, HashMap<String, FileSyncState>>>>,
    /// Decrypted vault keys (in memory only)
    vault_keys: Arc<RwLock<HashMap<String, CryptoKey>>>,
    /// Database path for persistence
    db_path: PathBuf,
}

impl SyncStateManager {
    /// Create a new sync state manager
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            vaults: Arc::new(RwLock::new(HashMap::new())),
            file_states: Arc::new(RwLock::new(HashMap::new())),
            vault_keys: Arc::new(RwLock::new(HashMap::new())),
            db_path,
        }
    }

    /// Get vault state
    pub fn get_vault_state(&self, vault_path: &str) -> Option<VaultState> {
        self.vaults.read().get(vault_path).cloned()
    }

    /// Set vault state
    pub fn set_vault_state(&self, state: VaultState) {
        self.vaults.write().insert(state.vault_path.clone(), state);
    }

    /// Get all vault states
    pub fn get_all_vault_states(&self) -> Vec<VaultState> {
        self.vaults.read().values().cloned().collect()
    }

    /// Enable sync for a vault
    pub fn enable_vault(&self, vault_path: &str, vault_id: &str) {
        let mut vaults = self.vaults.write();
        let state = vaults
            .entry(vault_path.to_string())
            .or_insert_with(|| VaultState::new(vault_path.to_string()));
        
        state.enabled = true;
        state.vault_id = Some(vault_id.to_string());
        state.status = VaultSyncState::Idle;
    }

    /// Disable sync for a vault
    pub fn disable_vault(&self, vault_path: &str) {
        let mut vaults = self.vaults.write();
        if let Some(state) = vaults.get_mut(vault_path) {
            state.enabled = false;
            state.status = VaultSyncState::Disabled;
        }
    }

    /// Update vault sync status
    pub fn update_vault_status(&self, vault_path: &str, status: VaultSyncState) {
        let mut vaults = self.vaults.write();
        if let Some(state) = vaults.get_mut(vault_path) {
            state.status = status;
        }
    }

    /// Set vault error
    pub fn set_vault_error(&self, vault_path: &str, error: Option<String>) {
        let mut vaults = self.vaults.write();
        if let Some(state) = vaults.get_mut(vault_path) {
            state.last_error = error;
            if state.last_error.is_some() {
                state.status = VaultSyncState::Error;
            }
        }
    }

    /// Update last sync time and cursor
    pub fn update_sync_cursor(&self, vault_path: &str, cursor: String) {
        let mut vaults = self.vaults.write();
        if let Some(state) = vaults.get_mut(vault_path) {
            state.last_cursor = Some(cursor);
            state.last_sync_at = Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64
            );
        }
    }

    /// Update last sync time (after successful sync)
    pub fn update_last_sync(&self, vault_path: &str) {
        let mut vaults = self.vaults.write();
        if let Some(state) = vaults.get_mut(vault_path) {
            state.last_sync_at = Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64
            );
            state.status = super::types::VaultSyncState::Idle;
        }
    }

    /// Get last sync cursor for a vault
    pub fn get_cursor(&self, vault_path: &str) -> Option<String> {
        self.vaults.read()
            .get(vault_path)
            .and_then(|s| s.last_cursor.clone())
    }

    // ==========================================
    // File state management
    // ==========================================

    /// Get file sync state
    pub fn get_file_state(&self, vault_path: &str, relative_path: &str) -> Option<FileSyncState> {
        self.file_states.read()
            .get(vault_path)
            .and_then(|files| files.get(relative_path).cloned())
    }

    /// Set file sync state
    pub fn set_file_state(&self, vault_path: &str, state: FileSyncState) {
        let mut file_states = self.file_states.write();
        file_states
            .entry(vault_path.to_string())
            .or_insert_with(HashMap::new)
            .insert(state.relative_path.clone(), state);
    }

    /// Remove file state
    pub fn remove_file_state(&self, vault_path: &str, relative_path: &str) {
        let mut file_states = self.file_states.write();
        if let Some(files) = file_states.get_mut(vault_path) {
            files.remove(relative_path);
        }
    }

    /// Get all file states for a vault
    pub fn get_all_file_states(&self, vault_path: &str) -> Vec<FileSyncState> {
        self.file_states.read()
            .get(vault_path)
            .map(|files| files.values().cloned().collect())
            .unwrap_or_default()
    }

    /// Check if a file needs sync
    pub fn needs_sync(&self, vault_path: &str, relative_path: &str, current_hash: &str) -> bool {
        match self.get_file_state(vault_path, relative_path) {
            Some(state) => {
                // File needs sync if local hash differs from what we last synced
                state.local_hash.as_ref() != Some(&current_hash.to_string())
            }
            None => true, // New file always needs sync
        }
    }

    /// Mark file as synced
    pub fn mark_synced(&self, vault_path: &str, relative_path: &str, hash: &str, version: u32) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        self.set_file_state(vault_path, FileSyncState {
            relative_path: relative_path.to_string(),
            local_hash: Some(hash.to_string()),
            remote_hash: Some(hash.to_string()),
            remote_version: Some(version),
            last_synced_at: Some(now),
        });
    }

    // ==========================================
    // Vault key management (in-memory only)
    // ==========================================

    /// Store decrypted vault key
    pub fn set_vault_key(&self, vault_id: &str, key: CryptoKey) {
        self.vault_keys.write().insert(vault_id.to_string(), key);
    }

    /// Get decrypted vault key
    pub fn get_vault_key(&self, vault_id: &str) -> Option<CryptoKey> {
        self.vault_keys.read().get(vault_id).cloned()
    }

    /// Clear all vault keys
    pub fn clear_vault_keys(&self) {
        self.vault_keys.write().clear();
    }

    // ==========================================
    // Pending changes tracking
    // ==========================================

    /// Count pending changes for a vault
    pub fn count_pending_changes(&self, vault_path: &str) -> u32 {
        // This would normally scan files and compare hashes
        // For now, return 0 as a placeholder
        0
    }

    // ==========================================
    // Persistence
    // ==========================================

    /// Load state from database
    pub async fn load(&self) -> SyncResult<()> {
        // TODO: Implement SQLite persistence
        // This will load vault states and file states from the database
        Ok(())
    }

    /// Save state to database
    pub async fn save(&self) -> SyncResult<()> {
        // TODO: Implement SQLite persistence
        // This will save vault states and file states to the database
        Ok(())
    }

    /// Clear all state
    pub fn clear(&self) {
        self.vaults.write().clear();
        self.file_states.write().clear();
        self.vault_keys.write().clear();
    }
}

impl Clone for SyncStateManager {
    fn clone(&self) -> Self {
        Self {
            vaults: Arc::clone(&self.vaults),
            file_states: Arc::clone(&self.file_states),
            vault_keys: Arc::clone(&self.vault_keys),
            db_path: self.db_path.clone(),
        }
    }
}

