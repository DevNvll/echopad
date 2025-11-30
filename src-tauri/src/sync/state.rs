//! Sync state management with JSON file persistence
//! 
//! State is keyed by `vault_id` (remote vault identifier) rather than local path,
//! allowing the same remote vault to be connected from different local paths
//! (e.g., after moving a vault folder or connecting from different devices).

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

/// Sync state for a vault (keyed by vault_id)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultState {
    /// The remote vault ID (primary identifier)
    pub vault_id: String,
    /// Current local path for this vault on this device
    pub vault_path: String,
    pub enabled: bool,
    pub last_cursor: Option<String>,
    pub last_sync_at: Option<u64>,
    pub status: VaultSyncState,
    pub last_error: Option<String>,
}

impl VaultState {
    pub fn new(vault_id: String, vault_path: String) -> Self {
        Self {
            vault_id,
            vault_path,
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
            vault_id: Some(self.vault_id.clone()),
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
/// 
/// Note: vaults and file_states are keyed by `vault_id` (remote vault identifier),
/// not by local file path. This allows the same vault to be connected from
/// different local paths across devices or after moving the vault folder.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PersistedState {
    /// Version of the state format for migration purposes
    #[serde(default)]
    version: u32,
    /// Vault states keyed by vault_id (remote ID)
    vaults: HashMap<String, VaultState>,
    /// File states keyed by vault_id (remote ID), then by relative file path
    file_states: HashMap<String, HashMap<String, FileSyncState>>,
    /// Mapping from local vault paths to vault_ids for quick lookup
    #[serde(default)]
    path_to_vault_id: HashMap<String, String>,
}

/// Current state format version
const STATE_VERSION: u32 = 2;

/// Sync state manager with JSON file persistence
pub struct SyncStateManager {
    /// State for each vault (keyed by vault_id - the remote vault identifier)
    vaults: Arc<RwLock<HashMap<String, VaultState>>>,
    /// File states for each vault (keyed by vault_id, then by relative path)
    file_states: Arc<RwLock<HashMap<String, HashMap<String, FileSyncState>>>>,
    /// Mapping from local vault paths to vault_ids for quick lookup
    path_to_vault_id: Arc<RwLock<HashMap<String, String>>>,
    /// Decrypted vault keys (in memory only, keyed by vault_id)
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
            path_to_vault_id: Arc::new(RwLock::new(HashMap::new())),
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
    // Path to Vault ID mapping
    // ==========================================

    /// Get vault_id for a given local path
    pub fn get_vault_id_for_path(&self, vault_path: &str) -> Option<String> {
        self.path_to_vault_id.read().get(vault_path).cloned()
    }

    /// Register a path-to-vault_id mapping
    fn register_path_mapping(&self, vault_path: &str, vault_id: &str) {
        self.path_to_vault_id.write().insert(vault_path.to_string(), vault_id.to_string());
    }

    /// Remove a path mapping
    fn remove_path_mapping(&self, vault_path: &str) {
        self.path_to_vault_id.write().remove(vault_path);
    }

    /// Update the local path for a vault (e.g., when vault folder is moved)
    pub fn update_vault_path(&self, vault_id: &str, new_path: &str) {
        // Remove old path mapping
        let old_path = {
            let vaults = self.vaults.read();
            vaults.get(vault_id).map(|v| v.vault_path.clone())
        };
        
        if let Some(old) = old_path {
            self.path_to_vault_id.write().remove(&old);
        }
        
        // Update vault state with new path
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_id) {
                state.vault_path = new_path.to_string();
            }
        }
        
        // Add new path mapping
        self.path_to_vault_id.write().insert(new_path.to_string(), vault_id.to_string());
        self.mark_dirty();
    }

    // ==========================================
    // Vault state management
    // ==========================================

    /// Get vault state by vault_id
    pub fn get_vault_state_by_id(&self, vault_id: &str) -> Option<VaultState> {
        self.vaults.read().get(vault_id).cloned()
    }

    /// Get vault state by local path (convenience method)
    pub fn get_vault_state(&self, vault_path: &str) -> Option<VaultState> {
        // First try to find by path mapping
        let vault_id = self.get_vault_id_for_path(vault_path)?;
        self.get_vault_state_by_id(&vault_id)
    }

    /// Set vault state (in memory and mark dirty for persistence)
    pub fn set_vault_state(&self, state: VaultState) {
        // Update path mapping
        self.register_path_mapping(&state.vault_path, &state.vault_id);
        // Store state by vault_id
        self.vaults.write().insert(state.vault_id.clone(), state);
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
                .entry(vault_id.to_string())
                .or_insert_with(|| VaultState::new(vault_id.to_string(), vault_path.to_string()));
            
            // Update the path in case it changed (vault moved)
            state.vault_path = vault_path.to_string();
            state.enabled = true;
            state.status = VaultSyncState::Idle;
        }
        // Register path mapping
        self.register_path_mapping(vault_path, vault_id);
        self.mark_dirty();
    }

    /// Disable sync for a vault (by local path)
    pub fn disable_vault(&self, vault_path: &str) {
        let vault_id = match self.get_vault_id_for_path(vault_path) {
            Some(id) => id,
            None => return,
        };
        self.disable_vault_by_id(&vault_id);
    }

    /// Disable sync for a vault (by vault_id)
    pub fn disable_vault_by_id(&self, vault_id: &str) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_id) {
                state.enabled = false;
                state.status = VaultSyncState::Disabled;
            }
        }
        self.mark_dirty();
    }

    /// Update vault sync status (by local path)
    pub fn update_vault_status(&self, vault_path: &str, status: VaultSyncState) {
        let vault_id = match self.get_vault_id_for_path(vault_path) {
            Some(id) => id,
            None => return,
        };
        self.update_vault_status_by_id(&vault_id, status);
    }

    /// Update vault sync status (by vault_id)
    pub fn update_vault_status_by_id(&self, vault_id: &str, status: VaultSyncState) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_id) {
                state.status = status;
            }
        }
        self.mark_dirty();
    }

    /// Set vault error (by local path)
    pub fn set_vault_error(&self, vault_path: &str, error: Option<String>) {
        let vault_id = match self.get_vault_id_for_path(vault_path) {
            Some(id) => id,
            None => return,
        };
        self.set_vault_error_by_id(&vault_id, error);
    }

    /// Set vault error (by vault_id)
    pub fn set_vault_error_by_id(&self, vault_id: &str, error: Option<String>) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_id) {
                state.last_error = error;
                if state.last_error.is_some() {
                    state.status = VaultSyncState::Error;
                }
            }
        }
        self.mark_dirty();
    }

    /// Update last sync time and cursor (by local path)
    pub fn update_sync_cursor(&self, vault_path: &str, cursor: String) {
        let vault_id = match self.get_vault_id_for_path(vault_path) {
            Some(id) => id,
            None => return,
        };
        self.update_sync_cursor_by_id(&vault_id, cursor);
    }

    /// Update last sync time and cursor (by vault_id)
    pub fn update_sync_cursor_by_id(&self, vault_id: &str, cursor: String) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_id) {
                state.last_cursor = Some(cursor);
                state.last_sync_at = Some(Self::now());
            }
        }
        self.mark_dirty();
    }

    /// Update last sync time (by local path, after successful sync)
    pub fn update_last_sync(&self, vault_path: &str) {
        let vault_id = match self.get_vault_id_for_path(vault_path) {
            Some(id) => id,
            None => return,
        };
        self.update_last_sync_by_id(&vault_id);
    }

    /// Update last sync time (by vault_id, after successful sync)
    pub fn update_last_sync_by_id(&self, vault_id: &str) {
        {
            let mut vaults = self.vaults.write();
            if let Some(state) = vaults.get_mut(vault_id) {
                state.last_sync_at = Some(Self::now());
                state.status = VaultSyncState::Idle;
            }
        }
        self.mark_dirty();
    }

    /// Get last sync cursor for a vault (by local path)
    pub fn get_cursor(&self, vault_path: &str) -> Option<String> {
        let vault_id = self.get_vault_id_for_path(vault_path)?;
        self.get_cursor_by_id(&vault_id)
    }

    /// Get last sync cursor for a vault (by vault_id)
    pub fn get_cursor_by_id(&self, vault_id: &str) -> Option<String> {
        self.vaults.read()
            .get(vault_id)
            .and_then(|s| s.last_cursor.clone())
    }

    // ==========================================
    // File state management (keyed by vault_id)
    // ==========================================

    /// Get file sync state (by vault_id)
    pub fn get_file_state_by_id(&self, vault_id: &str, relative_path: &str) -> Option<FileSyncState> {
        self.file_states.read()
            .get(vault_id)
            .and_then(|files| files.get(relative_path).cloned())
    }

    /// Get file sync state (by local path - convenience method)
    pub fn get_file_state(&self, vault_path: &str, relative_path: &str) -> Option<FileSyncState> {
        let vault_id = self.get_vault_id_for_path(vault_path)?;
        self.get_file_state_by_id(&vault_id, relative_path)
    }

    /// Set file sync state (by vault_id)
    pub fn set_file_state_by_id(&self, vault_id: &str, state: FileSyncState) {
        {
            let mut file_states = self.file_states.write();
            file_states
                .entry(vault_id.to_string())
                .or_insert_with(HashMap::new)
                .insert(state.relative_path.clone(), state);
        }
        self.mark_dirty();
    }

    /// Set file sync state (by local path - convenience method)
    pub fn set_file_state(&self, vault_path: &str, state: FileSyncState) {
        if let Some(vault_id) = self.get_vault_id_for_path(vault_path) {
            self.set_file_state_by_id(&vault_id, state);
        }
    }

    /// Remove file state (by vault_id)
    pub fn remove_file_state_by_id(&self, vault_id: &str, relative_path: &str) {
        {
            let mut file_states = self.file_states.write();
            if let Some(files) = file_states.get_mut(vault_id) {
                files.remove(relative_path);
            }
        }
        self.mark_dirty();
    }

    /// Remove file state (by local path - convenience method)
    pub fn remove_file_state(&self, vault_path: &str, relative_path: &str) {
        if let Some(vault_id) = self.get_vault_id_for_path(vault_path) {
            self.remove_file_state_by_id(&vault_id, relative_path);
        }
    }

    /// Get all file states for a vault (by vault_id)
    pub fn get_all_file_states_by_id(&self, vault_id: &str) -> Vec<FileSyncState> {
        self.file_states.read()
            .get(vault_id)
            .map(|files| files.values().cloned().collect())
            .unwrap_or_default()
    }

    /// Get all file states for a vault (by local path - convenience method)
    pub fn get_all_file_states(&self, vault_path: &str) -> Vec<FileSyncState> {
        match self.get_vault_id_for_path(vault_path) {
            Some(vault_id) => self.get_all_file_states_by_id(&vault_id),
            None => Vec::new(),
        }
    }

    /// Check if a file needs sync (by vault_id)
    pub fn needs_sync_by_id(&self, vault_id: &str, relative_path: &str, current_hash: &str) -> bool {
        match self.get_file_state_by_id(vault_id, relative_path) {
            Some(state) => {
                // File needs sync if local hash differs from what we last synced
                state.local_hash.as_ref() != Some(&current_hash.to_string())
            }
            None => true, // New file always needs sync
        }
    }

    /// Check if a file needs sync (by local path - convenience method)
    pub fn needs_sync(&self, vault_path: &str, relative_path: &str, current_hash: &str) -> bool {
        match self.get_vault_id_for_path(vault_path) {
            Some(vault_id) => self.needs_sync_by_id(&vault_id, relative_path, current_hash),
            None => true, // No vault mapping, assume needs sync
        }
    }

    /// Mark file as synced (by vault_id)
    pub fn mark_synced_by_id(&self, vault_id: &str, relative_path: &str, hash: &str, version: u32) {
        let now = Self::now();

        self.set_file_state_by_id(vault_id, FileSyncState {
            relative_path: relative_path.to_string(),
            local_hash: Some(hash.to_string()),
            remote_hash: Some(hash.to_string()),
            remote_version: Some(version),
            last_synced_at: Some(now),
        });
    }

    /// Mark file as synced (by local path - convenience method)
    pub fn mark_synced(&self, vault_path: &str, relative_path: &str, hash: &str, version: u32) {
        if let Some(vault_id) = self.get_vault_id_for_path(vault_path) {
            self.mark_synced_by_id(&vault_id, relative_path, hash, version);
        }
    }

    // ==========================================
    // Vault key management (in-memory only, keyed by vault_id)
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
        // Check if vault is enabled and get vault_id
        let vault_state = match self.get_vault_state(vault_path) {
            Some(s) if s.enabled => s,
            _ => return 0,
        };
        let vault_id = &vault_state.vault_id;

        // Scan current files
        let path = Path::new(vault_path);
        let scan_result = match scan_vault(path) {
            Ok(r) => r,
            Err(_) => return 0,
        };

        // Get stored file states (keyed by vault_id)
        let file_states = self.file_states.read();
        let stored_states = file_states.get(vault_id);

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

        // Check if migration is needed (version 0 or 1 = old format keyed by path)
        if persisted.version < STATE_VERSION {
            println!("[SyncState] Migrating state from version {} to {}", persisted.version, STATE_VERSION);
            self.migrate_from_v1(persisted)?;
        } else {
            // Load directly into memory (already keyed by vault_id)
            *self.vaults.write() = persisted.vaults;
            *self.file_states.write() = persisted.file_states;
            *self.path_to_vault_id.write() = persisted.path_to_vault_id;
        }

        let vault_count = self.vaults.read().len();
        let file_count: usize = self.file_states.read()
            .values()
            .map(|f| f.len())
            .sum();

        println!("[SyncState] Loaded {} vaults, {} file states from {:?}", 
            vault_count, file_count, self.state_file);

        Ok(())
    }

    /// Migrate from v1 format (keyed by vault_path) to v2 (keyed by vault_id)
    fn migrate_from_v1(&self, old_state: PersistedState) -> SyncResult<()> {
        let mut new_vaults = HashMap::new();
        let mut new_file_states = HashMap::new();
        let mut path_mapping = HashMap::new();

        for (old_key, mut vault_state) in old_state.vaults {
            // In v1, the key was vault_path. Check if vault_id exists.
            // If vault_state.vault_id is empty, use the old key as a fallback identifier
            let vault_id = if vault_state.vault_id.is_empty() {
                // Generate a deterministic ID from the path for migration
                // This is a fallback - normally vault_id should be set
                format!("migrated_{}", compute_simple_hash(&old_key))
            } else {
                vault_state.vault_id.clone()
            };

            // Ensure vault_id field is set
            vault_state.vault_id = vault_id.clone();
            
            // The old key was the vault_path
            vault_state.vault_path = old_key.clone();

            // Create path -> vault_id mapping
            path_mapping.insert(old_key.clone(), vault_id.clone());

            // Store by vault_id
            new_vaults.insert(vault_id.clone(), vault_state);

            // Migrate file states for this vault
            if let Some(files) = old_state.file_states.get(&old_key) {
                new_file_states.insert(vault_id, files.clone());
            }
        }

        // Also migrate any file states that might exist for vaults not in the vaults map
        for (old_key, files) in &old_state.file_states {
            if !path_mapping.contains_key(old_key) {
                // Orphaned file states - try to find their vault_id
                if let Some(vault_id) = path_mapping.get(old_key) {
                    new_file_states.insert(vault_id.clone(), files.clone());
                }
            }
        }

        // Store migrated state
        *self.vaults.write() = new_vaults;
        *self.file_states.write() = new_file_states;
        *self.path_to_vault_id.write() = path_mapping;

        // Save the migrated state immediately
        self.save_sync()?;
        
        println!("[SyncState] Migration complete");
        Ok(())
    }

    /// Save state to JSON file (synchronous)
    fn save_sync(&self) -> SyncResult<()> {
        let persisted = PersistedState {
            version: STATE_VERSION,
            vaults: self.vaults.read().clone(),
            file_states: self.file_states.read().clone(),
            path_to_vault_id: self.path_to_vault_id.read().clone(),
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
        self.path_to_vault_id.write().clear();
        self.vault_keys.write().clear();

        // Delete state file
        if self.state_file.exists() {
            let _ = fs::remove_file(&self.state_file);
        }
    }

    /// Clear file states for a specific vault (by local path)
    pub fn clear_vault_file_states(&self, vault_path: &str) {
        if let Some(vault_id) = self.get_vault_id_for_path(vault_path) {
            self.clear_vault_file_states_by_id(&vault_id);
        }
    }

    /// Clear file states for a specific vault (by vault_id)
    pub fn clear_vault_file_states_by_id(&self, vault_id: &str) {
        {
            let mut file_states = self.file_states.write();
            file_states.remove(vault_id);
        }
        self.mark_dirty();
    }

    /// Remove a vault completely (by local path)
    pub fn remove_vault(&self, vault_path: &str) {
        if let Some(vault_id) = self.get_vault_id_for_path(vault_path) {
            self.remove_vault_by_id(&vault_id);
        }
        // Also remove the path mapping
        self.remove_path_mapping(vault_path);
        self.mark_dirty();
    }

    /// Remove a vault completely (by vault_id)
    pub fn remove_vault_by_id(&self, vault_id: &str) {
        // Get the path before removing so we can clean up the mapping
        let vault_path = self.vaults.read().get(vault_id).map(|v| v.vault_path.clone());
        
        self.vaults.write().remove(vault_id);
        self.file_states.write().remove(vault_id);
        
        if let Some(path) = vault_path {
            self.path_to_vault_id.write().remove(&path);
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
            path_to_vault_id: Arc::clone(&self.path_to_vault_id),
            vault_keys: Arc::clone(&self.vault_keys),
            state_file: self.state_file.clone(),
            dirty: Arc::clone(&self.dirty),
        }
    }
}

/// Simple hash function for migration (not cryptographic, just for generating IDs)
fn compute_simple_hash(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}
