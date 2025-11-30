//! Tauri commands for sync functionality

#![allow(dead_code)]

use std::fs;
use std::path::Path;
use std::sync::Arc;
use parking_lot::RwLock;
use tauri::State;

use super::auth::AuthManager;
use super::client::SyncClient;
use super::state::SyncStateManager;
use super::conflict::{ConflictManager, ConflictResolution};
use super::types::*;
use super::error::SyncResult;

/// Write the sync manifest to a vault folder
fn write_sync_manifest(vault_path: &str, manifest: &VaultSyncManifest) -> Result<(), String> {
    let manifest_path = Path::new(vault_path).join(SYNC_MANIFEST_FILENAME);
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    fs::write(&manifest_path, json)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;
    
    // On Windows, set the hidden attribute
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;
        use std::process::Command;
        let _ = Command::new("attrib")
            .args(["+H", manifest_path.to_str().unwrap_or_default()])
            .output();
    }
    
    Ok(())
}

/// Read the sync manifest from a vault folder
fn read_sync_manifest(vault_path: &str) -> Option<VaultSyncManifest> {
    let manifest_path = Path::new(vault_path).join(SYNC_MANIFEST_FILENAME);
    if !manifest_path.exists() {
        return None;
    }
    
    let json = fs::read_to_string(&manifest_path).ok()?;
    serde_json::from_str(&json).ok()
}

/// Delete the sync manifest from a vault folder
fn delete_sync_manifest(vault_path: &str) -> Result<(), String> {
    let manifest_path = Path::new(vault_path).join(SYNC_MANIFEST_FILENAME);
    if manifest_path.exists() {
        fs::remove_file(&manifest_path)
            .map_err(|e| format!("Failed to delete manifest: {}", e))?;
    }
    Ok(())
}

/// Global sync state
pub struct SyncState {
    pub auth: Arc<AuthManager>,
    pub state_manager: Arc<SyncStateManager>,
    pub client: Arc<RwLock<Option<SyncClient>>>,
}

impl SyncState {
    pub fn new(db_path: std::path::PathBuf) -> Self {
        // Use the parent directory of db_path as the data directory
        let data_dir = db_path.parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        
        Self {
            auth: Arc::new(AuthManager::new(data_dir)),
            state_manager: Arc::new(SyncStateManager::new(db_path)),
            client: Arc::new(RwLock::new(None)),
        }
    }

    fn get_client(&self) -> SyncResult<SyncClient> {
        let client = self.client.read();
        match client.as_ref() {
            Some(_) => Ok(SyncClient::new(Arc::clone(&self.auth))?),
            None => Err(super::error::SyncError::AuthRequired),
        }
    }

    fn init_client(&self) -> SyncResult<()> {
        let client = SyncClient::new(Arc::clone(&self.auth))?;
        *self.client.write() = Some(client);
        Ok(())
    }
}

/// Login to sync service
#[tauri::command]
pub async fn sync_login(
    state: State<'_, SyncState>,
    email: String,
    password: String,
    server_url: String,
) -> Result<AuthResponse, String> {
    let client = reqwest::Client::new();
    let login_url = format!("{}/api/v1/auth/login", server_url);
    
    let login_response = client
        .post(&login_url)
        .json(&serde_json::json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .map_err(|e| format!("Login request failed: {}", e))?;

    if !login_response.status().is_success() {
        let error_text = login_response.text().await.unwrap_or_default();
        return Err(format!("Login failed: {}", error_text));
    }

    let auth_response: AuthResponse = login_response.json().await
        .map_err(|e| format!("Failed to parse login response: {}", e))?;

    // Store auth state (no encryption key needed for simplified auth)
    state.auth.set_auth_state_simple(
        auth_response.clone(),
        server_url,
    );

    // Save auth to disk for persistence across restarts
    state.auth.save_to_disk().map_err(|e| e.to_string())?;

    // Initialize client
    state.init_client().map_err(|e| e.to_string())?;

    Ok(auth_response)
}

/// Register new account
#[tauri::command]
pub async fn sync_register(
    state: State<'_, SyncState>,
    email: String,
    password: String,
    server_url: String,
) -> Result<AuthResponse, String> {
    let client = reqwest::Client::new();
    let register_url = format!("{}/api/v1/auth/register", server_url);
    
    let register_response = client
        .post(&register_url)
        .json(&serde_json::json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
        .map_err(|e| format!("Registration request failed: {}", e))?;

    if !register_response.status().is_success() {
        let error_text = register_response.text().await.unwrap_or_default();
        return Err(format!("Registration failed: {}", error_text));
    }

    let auth_response: AuthResponse = register_response.json().await
        .map_err(|e| format!("Failed to parse registration response: {}", e))?;

    // Store auth state
    state.auth.set_auth_state_simple(
        auth_response.clone(),
        server_url,
    );

    // Save auth to disk for persistence across restarts
    state.auth.save_to_disk().map_err(|e| e.to_string())?;

    // Initialize client
    state.init_client().map_err(|e| e.to_string())?;

    Ok(auth_response)
}

/// Restored session response (includes server URL)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RestoredSession {
    pub user: UserInfo,
    pub device_id: String,
    pub server_url: String,
}

/// Restore session from stored credentials
#[tauri::command]
pub async fn sync_restore_session(
    state: State<'_, SyncState>,
) -> Result<Option<RestoredSession>, String> {
    // Try to load persisted auth
    let persisted = match state.auth.load_from_disk() {
        Ok(Some(p)) => p,
        Ok(None) => return Ok(None), // No stored auth
        Err(e) => {
            println!("[Sync] Failed to load persisted auth: {}", e);
            return Ok(None);
        }
    };

    println!("[Sync] Found persisted auth for {}, attempting token refresh", persisted.user.email);

    // Try to refresh the token
    let client = reqwest::Client::new();
    let refresh_url = format!("{}/api/v1/auth/refresh", persisted.server_url);
    
    let refresh_response = client
        .post(&refresh_url)
        .json(&serde_json::json!({
            "refresh_token": persisted.refresh_token,
        }))
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {}", e))?;

    if !refresh_response.status().is_success() {
        // Token refresh failed - clear stored auth
        println!("[Sync] Token refresh failed, clearing stored auth");
        let _ = state.auth.clear_from_disk();
        return Ok(None);
    }

    #[derive(serde::Deserialize)]
    struct TokenRefreshResponse {
        access_token: String,
        refresh_token: String,
        expires_in: u64,
    }

    let token_response: TokenRefreshResponse = refresh_response.json().await
        .map_err(|e| format!("Failed to parse token refresh response: {}", e))?;

    // Restore auth state with new tokens
    state.auth.restore_from_persisted(
        &persisted,
        token_response.access_token.clone(),
        token_response.refresh_token.clone(),
        token_response.expires_in,
    );

    // Save updated tokens to disk
    state.auth.save_to_disk().map_err(|e| e.to_string())?;

    // Initialize client
    state.init_client().map_err(|e| e.to_string())?;

    println!("[Sync] Session restored successfully for {}", persisted.user.email);

    // Return restored session info for frontend
    Ok(Some(RestoredSession {
        user: persisted.user,
        device_id: persisted.device_id,
        server_url: persisted.server_url,
    }))
}

/// Logout from sync service
#[tauri::command]
pub async fn sync_logout(state: State<'_, SyncState>) -> Result<(), String> {
    // Try to notify server (ignore errors)
    if let Ok(client) = state.get_client() {
        let _ = client.logout().await;
    }

    // Clear persisted auth from disk
    let _ = state.auth.clear_from_disk();

    // Clear local state
    state.auth.clear();
    state.state_manager.clear();
    state.state_manager.clear_vault_keys();
    *state.client.write() = None;

    Ok(())
}

/// Get sync status
#[tauri::command]
pub async fn sync_get_status(state: State<'_, SyncState>) -> Result<SyncStatus, String> {
    let is_logged_in = state.auth.is_logged_in();
    let user = state.auth.get_user();

    let vault_states = state.state_manager.get_all_vault_states();
    let vaults: Vec<VaultSyncStatus> = vault_states
        .iter()
        .map(|v| {
            let pending = state.state_manager.count_pending_changes(&v.vault_path);
            v.to_status(pending)
        })
        .collect();

    Ok(SyncStatus {
        is_logged_in,
        user,
        vaults,
        last_error: None,
    })
}

/// Enable sync for a vault
#[tauri::command]
pub async fn sync_enable_vault(
    state: State<'_, SyncState>,
    vault_path: String,
    vault_name: String,
) -> Result<String, String> {
    if !state.auth.is_logged_in() {
        return Err("Not logged in".to_string());
    }

    let server_url = state.auth.get_server_url().ok_or("No server URL")?;
    let token = state.auth.get_access_token().ok_or("No access token")?;
    let user = state.auth.get_user().ok_or("No user info")?;

    let client = reqwest::Client::new();
    let create_url = format!("{}/api/v1/vaults", server_url);
    
    let create_response = client
        .post(&create_url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "name": vault_name,
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to create vault: {}", e))?;

    if !create_response.status().is_success() {
        let error_text = create_response.text().await.unwrap_or_default();
        return Err(format!("Failed to create vault: {}", error_text));
    }

    let vault_info: VaultInfo = create_response.json().await
        .map_err(|e| format!("Failed to parse vault response: {}", e))?;

    // Enable sync for this vault
    state.state_manager.enable_vault(&vault_path, &vault_info.id);

    // Write the sync manifest to the vault folder for reconnection
    let manifest = VaultSyncManifest::new(
        vault_info.id.clone(),
        server_url,
        user.id,
    );
    write_sync_manifest(&vault_path, &manifest)?;

    Ok(vault_info.id)
}

/// Disable sync for a vault
#[tauri::command]
pub async fn sync_disable_vault(
    state: State<'_, SyncState>,
    vault_path: String,
) -> Result<(), String> {
    // Disable sync in state manager
    state.state_manager.disable_vault(&vault_path);
    
    // Clear file states for this vault
    state.state_manager.clear_vault_file_states(&vault_path);
    
    // Delete the sync manifest from the vault folder
    delete_sync_manifest(&vault_path)?;
    
    Ok(())
}

/// Trigger sync for a vault
#[tauri::command]
pub async fn sync_now(
    state: State<'_, SyncState>,
    vault_path: String,
) -> Result<SyncOperationResult, String> {
    let vault_state = state.state_manager.get_vault_state(&vault_path)
        .ok_or("Vault not found")?;

    if !vault_state.enabled {
        return Err("Sync not enabled for this vault".to_string());
    }

    let vault_id = vault_state.vault_id
        .ok_or("Vault not registered with server")?;

    let server_url = state.auth.get_server_url()
        .ok_or("Not logged in")?;
    
    let access_token = state.auth.get_access_token()
        .ok_or("No access token")?;

    // Create sync engine with state manager for incremental sync
    let engine = super::engine::SyncEngine::with_state_manager(
        server_url,
        access_token,
        vault_id,
        vault_path.clone(),
        Arc::clone(&state.state_manager),
    );

    let result = engine.sync().await.map_err(|e| e.to_string())?;

    // Update last sync time on success
    if result.success {
        state.state_manager.update_last_sync(&vault_path);
    }

    Ok(result)
}

/// Get conflicts for a vault
#[tauri::command]
pub async fn sync_get_conflicts(
    state: State<'_, SyncState>,
    vault_path: String,
) -> Result<Vec<ConflictInfo>, String> {
    let device_id = state.auth.get_device_id()
        .unwrap_or_else(|| "unknown".to_string());
    
    let conflict_manager = ConflictManager::new(device_id);
    let path = std::path::Path::new(&vault_path);
    
    conflict_manager.list_conflicts(path)
        .map_err(|e| e.to_string())
}

/// Resolve a sync conflict
#[tauri::command]
pub async fn sync_resolve_conflict(
    state: State<'_, SyncState>,
    vault_path: String,
    conflict_path: String,
    keep: String,
) -> Result<(), String> {
    let device_id = state.auth.get_device_id()
        .unwrap_or_else(|| "unknown".to_string());
    
    let conflict_manager = ConflictManager::new(device_id);
    let vault = std::path::Path::new(&vault_path);
    
    let resolution: ConflictResolution = keep.parse()
        .map_err(|e: super::error::SyncError| e.to_string())?;
    
    conflict_manager.resolve_conflict(vault, &conflict_path, resolution)
        .map_err(|e| e.to_string())
}

/// Get list of devices
#[tauri::command]
pub async fn sync_get_devices(state: State<'_, SyncState>) -> Result<Vec<DeviceInfo>, String> {
    let client = state.get_client().map_err(|e| e.to_string())?;
    client.list_devices().await.map_err(|e| e.to_string())
}

/// Revoke a device
#[tauri::command]
pub async fn sync_revoke_device(
    state: State<'_, SyncState>,
    device_id: String,
) -> Result<(), String> {
    let client = state.get_client().map_err(|e| e.to_string())?;
    client.revoke_device(&device_id).await.map_err(|e| e.to_string())
}

/// Get user info
#[tauri::command]
pub async fn sync_get_user(state: State<'_, SyncState>) -> Result<Option<UserInfo>, String> {
    Ok(state.auth.get_user())
}

/// Check if logged in
#[tauri::command]
pub fn sync_is_logged_in(state: State<'_, SyncState>) -> bool {
    state.auth.is_logged_in()
}

/// List remote vaults (for connecting to existing synced vaults)
#[tauri::command]
pub async fn sync_list_remote_vaults(
    state: State<'_, SyncState>,
) -> Result<Vec<VaultInfo>, String> {
    if !state.auth.is_logged_in() {
        return Err("Not logged in".to_string());
    }

    let server_url = state.auth.get_server_url()
        .ok_or("No server URL")?;
    
    let access_token = state.auth.get_access_token()
        .ok_or("No access token")?;

    let client = reqwest::Client::new();
    let url = format!("{}/api/v1/vaults", server_url);
    
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Failed to list vaults: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to list vaults: {}", error_text));
    }

    let vaults: Vec<VaultInfo> = response.json().await
        .map_err(|e| format!("Failed to parse vaults: {}", e))?;

    Ok(vaults)
}

/// Connect local folder to existing remote vault
#[tauri::command]
pub async fn sync_connect_vault(
    state: State<'_, SyncState>,
    vault_path: String,
    remote_vault_id: String,
) -> Result<(), String> {
    if !state.auth.is_logged_in() {
        return Err("Not logged in".to_string());
    }

    let server_url = state.auth.get_server_url()
        .ok_or("Not logged in")?;
    
    let access_token = state.auth.get_access_token()
        .ok_or("No access token")?;
    
    let user = state.auth.get_user().ok_or("No user info")?;

    // Enable sync for this vault with the existing remote vault ID
    state.state_manager.enable_vault(&vault_path, &remote_vault_id);

    // Write the sync manifest to the vault folder for reconnection
    let manifest = VaultSyncManifest::new(
        remote_vault_id.clone(),
        server_url.clone(),
        user.id,
    );
    write_sync_manifest(&vault_path, &manifest)?;

    // Create sync engine with additive pull mode (won't overwrite existing files)
    let mut engine = super::engine::SyncEngine::with_state_manager(
        server_url,
        access_token,
        remote_vault_id,
        vault_path.clone(),
        Arc::clone(&state.state_manager),
    );
    
    // Enable additive-only mode for initial connection
    engine.set_additive_only(true);

    // Perform sync to download existing files (additive only)
    let result = engine.sync().await.map_err(|e| e.to_string())?;

    if result.success {
        state.state_manager.update_last_sync(&vault_path);
    }

    Ok(())
}

/// Detection result for vault connection
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultConnectionInfo {
    /// Remote vault ID from the manifest
    pub remote_vault_id: String,
    /// Server URL where this vault is synced
    pub server_url: String,
    /// User ID who owns this vault
    pub user_id: String,
    /// Whether the current user matches the manifest user
    pub is_same_user: bool,
    /// Whether sync is already enabled for this vault in memory
    pub is_already_enabled: bool,
}

/// Detect if a vault has a sync manifest (was previously connected)
/// Returns connection info if a manifest exists, None otherwise
#[tauri::command]
pub async fn sync_detect_vault_connection(
    state: State<'_, SyncState>,
    vault_path: String,
) -> Result<Option<VaultConnectionInfo>, String> {
    // Check for existing manifest
    let manifest = match read_sync_manifest(&vault_path) {
        Some(m) => m,
        None => return Ok(None),
    };

    // Check if current user matches
    let current_user_id = state.auth.get_user().map(|u| u.id);
    let is_same_user = current_user_id.as_ref() == Some(&manifest.user_id);

    // Check if sync is already enabled in memory
    let is_already_enabled = state.state_manager
        .get_vault_state(&vault_path)
        .map(|s| s.enabled)
        .unwrap_or(false);

    Ok(Some(VaultConnectionInfo {
        remote_vault_id: manifest.remote_vault_id,
        server_url: manifest.server_url,
        user_id: manifest.user_id,
        is_same_user,
        is_already_enabled,
    }))
}

/// Auto-reconnect a vault using its manifest
/// This should be called after session restore if a manifest is detected
#[tauri::command]
pub async fn sync_auto_reconnect_vault(
    state: State<'_, SyncState>,
    vault_path: String,
) -> Result<bool, String> {
    if !state.auth.is_logged_in() {
        return Err("Not logged in".to_string());
    }

    // Read the manifest
    let manifest = match read_sync_manifest(&vault_path) {
        Some(m) => m,
        None => return Ok(false), // No manifest, nothing to reconnect
    };

    // Verify current user matches
    let current_user = state.auth.get_user().ok_or("No user info")?;
    if current_user.id != manifest.user_id {
        // Different user - don't auto-reconnect
        println!("[Sync] Vault manifest user {} doesn't match current user {}", 
            manifest.user_id, current_user.id);
        return Ok(false);
    }

    // Check if already enabled
    if let Some(vault_state) = state.state_manager.get_vault_state(&vault_path) {
        if vault_state.enabled && vault_state.vault_id == Some(manifest.remote_vault_id.clone()) {
            println!("[Sync] Vault already connected to {}", manifest.remote_vault_id);
            return Ok(true);
        }
    }

    // Re-enable sync for this vault
    println!("[Sync] Auto-reconnecting vault {} to remote {}", vault_path, manifest.remote_vault_id);
    state.state_manager.enable_vault(&vault_path, &manifest.remote_vault_id);

    // Update manifest with current server URL if it changed
    let current_server_url = state.auth.get_server_url().ok_or("No server URL")?;
    if current_server_url != manifest.server_url {
        let updated_manifest = VaultSyncManifest::new(
            manifest.remote_vault_id.clone(),
            current_server_url,
            current_user.id,
        );
        write_sync_manifest(&vault_path, &updated_manifest)?;
    }

    Ok(true)
}
