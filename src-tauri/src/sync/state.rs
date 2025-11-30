//! Sync state management with JSON file persistence

#![allow(dead_code)]

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::crypto::CryptoKey;
use super::error::{SyncError, SyncResult};
use super::scanner::scan_vault;
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

/// Persisted state structure (saved to JSON)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PersistedState {
    vaults: HashMap<String, VaultState>,
    file_states: HashMap<String, HashMap<String, FileSyncState>>,
}

/// Sync state manager with JSON file persistence
pub struct SyncStateManager {
    /// State for each vault (keyed by vault path)
    vaults: Arc<RwLock<HashMap<String, VaultState>>>,
    /// File states for each vault
    file_states: Arc<RwLock<HashMap<String, HashMap<String, FileSyncState>>>>,
    /// Decrypted vault keys (in memory only)
    vault_keys: Arc<RwLock<HashMap<String, CryptoKey>>>,
    /// Path to the JSON state file
    state_file: PathBuf,
    /// Dirty flag to track if we need to save
    dirty: Arc<RwLock<bool>>,
}

impl SyncStateManager {
    /// Create a new sync state manager and load existing state
    pub fn new(db_path: PathBuf) -> Self {
        // Use the parent directory and create a sync_state.json file
        let state_file = db_path.parent()
            .map(|p| p.join("sync_state.json"))
            .unwrap_or_else(|| PathBuf::from("sync_state.json"));

        let manager = Self {
            vaults: Arc::new(RwLock::new(HashMap::new())),
            file_states: Arc::new(RwLock::new(HashMap::new())),
            vault_keys: Arc::new(RwLock::new(HashMap::new())),
            state_file,
            dirty: Arc::new(RwLock::new(false)),
        };

        // Load existing state
        if let Err(e) = manager.load_sync() {
            eprintln!("[SyncState] Failed to load state: {}", e);
        }

        manager
    }

    // ==========================================
    // Vault state management
    // ==========================================

    /// Get vault state
    pub fn get_vault_state(&self, vault_path: &str) -> Option<VaultState> {
        self.vaults.read().get(vault_path).cloned()
    }

    /// Set vault state (in memory and mark dirty for persistence)
    pub fn set_vault_state(&self, state: VaultState) {
        self.vaults.write().insert(state.vault_path.clone(), state);
        self.mark_dirty();
    }

    /// Get all vault states
    pub fn get_all_vault_states(&self) -> Vec<VaultState> {
        self.vaults.read().values().cloned().collect()
    }

    /// Enable sync for a vault
    pub fn enable_vault(&self, vault_path: &str, vault_id: &str) {
        {
            let mut vaults = self.vaults.write();
            let state = vaults
                .entry(vault_path.to_string())
                .or_insert_with(|| VaultState::new(vault_path.to_string()));
            
            state.enabled = true;
            state.vault_id = Some(vault_id.to_string());
            state.status = VaultSyncState::Idle;
        }
        self.mark_dirty();
    }

    /// Disable sync for a vault
    pub fn disable_vault(&self, vault_path: &str) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_path) {
                state.enabled = false;
                state.status = VaultSyncState::Disabled;
            }
        }
        self.mark_dirty();
    }

    /// Update vault sync status
    pub fn update_vault_status(&self, vault_path: &str, status: VaultSyncState) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_path) {
                state.status = status;
            }
        }
        self.mark_dirty();
    }

    /// Set vault error
    pub fn set_vault_error(&self, vault_path: &str, error: Option<String>) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_path) {
                state.last_error = error;
                if state.last_error.is_some() {
                    state.status = VaultSyncState::Error;
                }
            }
        }
        self.mark_dirty();
    }

    /// Update last sync time and cursor
    pub fn update_sync_cursor(&self, vault_path: &str, cursor: String) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_path) {
                state.last_cursor = Some(cursor);
                state.last_sync_at = Some(Self::now());
            }
        }
        self.mark_dirty();
    }

    /// Update last sync time (after successful sync)
    pub fn update_last_sync(&self, vault_path: &str) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_path) {
                state.last_sync_at = Some(Self::now());
                state.status = VaultSyncState::Idle;
            }
        }
        self.mark_dirty();
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
        {
            let mut file_states = self.file_states.write();
            file_states
                .entry(vault_path.to_string())
                .or_insert_with(HashMap::new)
                .insert(state.relative_path.clone(), state);
        }
        self.mark_dirty();
    }

    /// Remove file state
    pub fn remove_file_state(&self, vault_path: &str, relative_path: &str) {
        {
            let mut file_states = self.file_states.write();
            if let Some(files) = file_states.get_mut(vault_path) {
                files.remove(relative_path);
            }
        }
        self.mark_dirty();
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
        let now = Self::now();

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

    /// Count pending changes for a vault by comparing current files with stored state
    pub fn count_pending_changes(&self, vault_path: &str) -> u32 {
        // Check if vault is enabled
        let _vault_state = match self.get_vault_state(vault_path) {
            Some(s) if s.enabled => s,
            _ => return 0,
        };

        // Scan current files
        let path = Path::new(vault_path);
        let scan_result = match scan_vault(path) {
            Ok(r) => r,
            Err(_) => return 0,
        };

        // Get stored file states
        let file_states = self.file_states.read();
        let stored_states = file_states.get(vault_path);

        let mut pending = 0u32;

        // Count new and modified files
        for (rel_path, info) in &scan_result.files {
            let needs_sync = match stored_states {
                Some(states) => match states.get(rel_path) {
                    Some(stored) => stored.local_hash.as_ref() != Some(&info.content_hash),
                    None => true, // New file
                },
                None => true, // No stored states at all
            };

            if needs_sync {
                pending += 1;
            }
        }

        // Count deleted files (files in stored state but not on disk)
        if let Some(states) = stored_states {
            for rel_path in states.keys() {
                if !scan_result.files.contains_key(rel_path) {
                    pending += 1;
                }
            }
        }

        pending
    }

    // ==========================================
    // JSON File Persistence
    // ==========================================

    /// Mark state as dirty (needs saving)
    fn mark_dirty(&self) {
        *self.dirty.write() = true;
        // Auto-save on changes
        if let Err(e) = self.save_sync() {
            eprintln!("[SyncState] Auto-save failed: {}", e);
        }
    }

    /// Load state from JSON file (synchronous)
    fn load_sync(&self) -> SyncResult<()> {
        if !self.state_file.exists() {
            println!("[SyncState] No existing state file, starting fresh");
            return Ok(());
        }

        let content = fs::read_to_string(&self.state_file)
            .map_err(SyncError::Io)?;

        let persisted: PersistedState = serde_json::from_str(&content)
            .map_err(SyncError::Json)?;

        // Load into memory
        *self.vaults.write() = persisted.vaults;
        *self.file_states.write() = persisted.file_states;

        let vault_count = self.vaults.read().len();
        let file_count: usize = self.file_states.read()
            .values()
            .map(|f| f.len())
            .sum();

        println!("[SyncState] Loaded {} vaults, {} file states from {:?}", 
            vault_count, file_count, self.state_file);

        Ok(())
    }

    /// Save state to JSON file (synchronous)
    fn save_sync(&self) -> SyncResult<()> {
        let persisted = PersistedState {
            vaults: self.vaults.read().clone(),
            file_states: self.file_states.read().clone(),
        };

        // Ensure parent directory exists
        if let Some(parent) = self.state_file.parent() {
            fs::create_dir_all(parent).map_err(SyncError::Io)?;
        }

        let content = serde_json::to_string_pretty(&persisted)
            .map_err(SyncError::Json)?;

        fs::write(&self.state_file, content)
            .map_err(SyncError::Io)?;

        *self.dirty.write() = false;
        Ok(())
    }

    /// Load state from file (async wrapper)
    pub async fn load(&self) -> SyncResult<()> {
        self.load_sync()
    }

    /// Save state to file (async wrapper)
    pub async fn save(&self) -> SyncResult<()> {
        self.save_sync()
    }

    /// Clear all state (memory and file)
    pub fn clear(&self) {
        self.vaults.write().clear();
        self.file_states.write().clear();
        self.vault_keys.write().clear();

        // Delete state file
        if self.state_file.exists() {
            let _ = fs::remove_file(&self.state_file);
        }
    }

    /// Clear file states for a specific vault
    pub fn clear_vault_file_states(&self, vault_path: &str) {
        {
            let mut file_states = self.file_states.write();
            file_states.remove(vault_path);
        }
        self.mark_dirty();
    }

    /// Get current timestamp in milliseconds
    fn now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

impl Clone for SyncStateManager {
    fn clone(&self) -> Self {
        Self {
            vaults: Arc::clone(&self.vaults),
            file_states: Arc::clone(&self.file_states),
            vault_keys: Arc::clone(&self.vault_keys),
            state_file: self.state_file.clone(),
            dirty: Arc::clone(&self.dirty),
        }
    }
}
