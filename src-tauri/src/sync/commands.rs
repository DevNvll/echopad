//! Tauri commands for sync functionality

#![allow(dead_code)]

use std::sync::Arc;
use parking_lot::RwLock;
use tauri::State;

use super::auth::AuthManager;
use super::client::SyncClient;
use super::state::SyncStateManager;
use super::conflict::{ConflictManager, ConflictResolution};
use super::types::*;
use super::error::SyncResult;

/// Global sync state
pub struct SyncState {
    pub auth: Arc<AuthManager>,
    pub state_manager: Arc<SyncStateManager>,
    pub client: Arc<RwLock<Option<SyncClient>>>,
}

impl SyncState {
    pub fn new(db_path: std::path::PathBuf) -> Self {
        Self {
            auth: Arc::new(AuthManager::new()),
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

    // Initialize client
    state.init_client().map_err(|e| e.to_string())?;

    Ok(auth_response)
}

/// Logout from sync service
#[tauri::command]
pub async fn sync_logout(state: State<'_, SyncState>) -> Result<(), String> {
    // Try to notify server (ignore errors)
    if let Ok(client) = state.get_client() {
        let _ = client.logout().await;
    }

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

    Ok(vault_info.id)
}

/// Disable sync for a vault
#[tauri::command]
pub async fn sync_disable_vault(
    state: State<'_, SyncState>,
    vault_path: String,
) -> Result<(), String> {
    state.state_manager.disable_vault(&vault_path);
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

    // Create sync engine and perform sync
    let engine = super::engine::SyncEngine::new(
        server_url,
        access_token,
        vault_id,
        vault_path.clone(),
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

    // Enable sync for this vault with the existing remote vault ID
    state.state_manager.enable_vault(&vault_path, &remote_vault_id);

    // Trigger initial sync to pull down files
    let server_url = state.auth.get_server_url()
        .ok_or("Not logged in")?;
    
    let access_token = state.auth.get_access_token()
        .ok_or("No access token")?;

    let engine = super::engine::SyncEngine::new(
        server_url,
        access_token,
        remote_vault_id,
        vault_path.clone(),
    );

    // Perform sync to download existing files
    let result = engine.sync().await.map_err(|e| e.to_string())?;

    if result.success {
        state.state_manager.update_last_sync(&vault_path);
    }

    Ok(())
}

