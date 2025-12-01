//! Sync engine - orchestrates the sync process

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::error::{SyncError, SyncResult};
use super::scanner::{compute_hash, detect_changes, scan_vault, ChangeSet, ScanResult};
use super::state::SyncStateManager;
use super::types::SyncOperationResult;

/// Remote file metadata from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFile {
    pub id: String,
    pub encrypted_path: String,
    pub content_hash: String,
    pub size: u64,
    pub modified_at: u64,
    pub version: i32,
    pub download_url: Option<String>,
}

/// Pull response from server
#[derive(Debug, Clone, Deserialize)]
pub struct PullResponse {
    pub changes: Vec<RemoteChange>,
    pub next_cursor: String,
    pub has_more: bool,
}

/// A single remote change
#[derive(Debug, Clone, Deserialize)]
pub struct RemoteChange {
    pub id: String,
    pub encrypted_path: String,
    pub operation: String,
    pub content_hash: String,
    pub size: u64,
    pub modified_at: u64,
    pub version: i32,
    pub download_url: Option<String>,
}

/// Push response from server
#[derive(Debug, Clone, Deserialize)]
pub struct PushResponse {
    pub results: Vec<PushResult>,
    pub conflicts: Vec<serde_json::Value>,
}

/// Result of a single push operation
#[derive(Debug, Clone, Deserialize)]
pub struct PushResult {
    pub encrypted_path: String,
    pub status: String,
    pub upload_url: Option<String>,
    pub new_version: Option<i32>,
    pub file_id: Option<String>,
    pub error: Option<String>,
}

/// Sync engine configuration
/// 
/// The engine uses `vault_id` (remote vault identifier) for all state operations.
/// The `vault_path` is the local filesystem path used for reading/writing files.
pub struct SyncEngine {
    pub server_url: String,
    pub access_token: String,
    /// Remote vault ID - used as primary key for state operations
    pub vault_id: String,
    /// Local filesystem path - used for file operations
    pub vault_path: String,
    pub state_manager: Option<std::sync::Arc<SyncStateManager>>,
    /// When true, pull operations will not overwrite existing local files
    additive_only: bool,
    client: Client,
}

impl SyncEngine {
    pub fn new(
        server_url: String,
        access_token: String,
        vault_id: String,
        vault_path: String,
    ) -> Self {
        Self {
            server_url,
            access_token,
            vault_id,
            vault_path,
            state_manager: None,
            additive_only: false,
            client: Client::new(),
        }
    }

    /// Create engine with state manager for incremental sync
    pub fn with_state_manager(
        server_url: String,
        access_token: String,
        vault_id: String,
        vault_path: String,
        state_manager: std::sync::Arc<SyncStateManager>,
    ) -> Self {
        Self {
            server_url,
            access_token,
            vault_id,
            vault_path,
            state_manager: Some(state_manager),
            additive_only: false,
            client: Client::new(),
        }
    }

    /// Set additive-only mode for pull operations
    /// When enabled, existing local files will not be overwritten
    pub fn set_additive_only(&mut self, additive: bool) {
        self.additive_only = additive;
    }

    /// Perform a full sync cycle
    pub async fn sync(&self) -> SyncResult<SyncOperationResult> {
        let start = std::time::Instant::now();
        let mut files_uploaded = 0u32;
        let mut files_downloaded = 0u32;
        let mut files_deleted = 0u32;
        let mut errors = Vec::new();

        let vault_path = Path::new(&self.vault_path);

        println!("[Sync] Starting sync for vault: {}", self.vault_path);
        println!("[Sync] Server URL: {}", self.server_url);
        println!("[Sync] Vault ID: {}", self.vault_id);

        // 1. Initial scan to know what we have locally before sync
        let initial_scan = scan_vault(vault_path)?;
        println!("[Sync] Found {} local files before pull", initial_scan.file_count);
        
        // 2. Pull remote changes first
        match self.pull_changes(vault_path).await {
            Ok(downloaded) => {
                files_downloaded = downloaded;
                println!("[Sync] Downloaded {} files", downloaded);
            }
            Err(e) => {
                println!("[Sync] Pull error: {}", e);
                errors.push(format!("Pull failed: {}", e));
            }
        }

        // 3. Re-scan AFTER pulling to include downloaded files
        // This is critical - we need to detect changes based on current state,
        // not the state before pulling (which would cause downloaded files to be "deleted")
        let scan_result = scan_vault(vault_path)?;
        println!("[Sync] Found {} local files after pull", scan_result.file_count);

        // 4. Detect local changes (incremental sync if state manager available)
        let change_set = self.get_local_changes(&scan_result);
        println!("[Sync] Detected {} changed files, {} deleted files", 
            change_set.changed.len(), change_set.deleted.len());
        
        // Log the first few changed files for debugging
        for (i, info) in change_set.changed.iter().take(5).enumerate() {
            println!("[Sync]   Changed file {}: {}", i + 1, info.relative_path);
        }
        if change_set.changed.len() > 5 {
            println!("[Sync]   ... and {} more changed files", change_set.changed.len() - 5);
        }

        // 5. Push only changed files
        match self.push_changes_incremental(&change_set, &scan_result).await {
            Ok((uploaded, deleted)) => {
                files_uploaded = uploaded;
                files_deleted = deleted;
                println!("[Sync] Uploaded {} files, deleted {}", uploaded, deleted);
            }
            Err(e) => {
                println!("[Sync] Push error: {}", e);
                errors.push(format!("Push failed: {}", e));
            }
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        println!("[Sync] Completed in {}ms - {} uploads, {} downloads, {} errors", 
            duration_ms, files_uploaded, files_downloaded, errors.len());

        Ok(SyncOperationResult {
            success: errors.is_empty(),
            files_uploaded,
            files_downloaded,
            files_deleted,
            conflicts: vec![],
            errors,
            duration_ms,
        })
    }

    /// Get local changes by comparing with stored state
    fn get_local_changes(&self, scan_result: &ScanResult) -> ChangeSet {
        // If we have a state manager, use it for incremental sync
        if let Some(ref state_manager) = self.state_manager {
            // Use vault_id for state lookups (not vault_path)
            let file_states = state_manager.get_all_file_states_by_id(&self.vault_id);
            
            // Build previous state map from stored file states
            let previous: HashMap<String, String> = file_states
                .iter()
                .filter_map(|fs| {
                    fs.local_hash.as_ref().map(|hash| (fs.relative_path.clone(), hash.clone()))
                })
                .collect();

            detect_changes(scan_result, &previous)
        } else {
            // No state manager - treat all files as changed (full sync)
            ChangeSet {
                changed: scan_result.files.values().cloned().collect(),
                deleted: vec![],
            }
        }
    }

    /// Pull remote changes and apply them locally
    async fn pull_changes(&self, vault_path: &Path) -> SyncResult<u32> {
        let mut downloaded = 0u32;
        let mut cursor: Option<String> = None;

        loop {
            let url = format!(
                "{}/api/v1/vaults/{}/sync/pull",
                self.server_url, self.vault_id
            );

            let response = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", self.access_token))
                .json(&serde_json::json!({
                    "cursor": cursor,
                    "limit": 100
                }))
                .send()
                .await
                .map_err(|e| SyncError::Network(e.to_string()))?;

            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                return Err(SyncError::Server(format!(
                    "Pull failed: {} - {}",
                    status, text
                )));
            }

            let pull_response: PullResponse = response
                .json()
                .await
                .map_err(|e| SyncError::InvalidData(e.to_string()))?;

            // Process each change
            println!("[Sync] Processing {} remote changes", pull_response.changes.len());
            for change in &pull_response.changes {
                match self.apply_remote_change(vault_path, change).await {
                    Ok(()) => {
                        downloaded += 1;
                        // Decode path for logging
                        if let Ok(path) = decode_path(&change.encrypted_path) {
                            println!("[Sync]   Downloaded: {} (op: {})", path, change.operation);
                        }
                    }
                    Err(e) => {
                        if let Ok(path) = decode_path(&change.encrypted_path) {
                            eprintln!("[Sync]   Failed to apply change for {}: {}", path, e);
                        } else {
                            eprintln!("[Sync]   Failed to apply change for {}: {}", change.encrypted_path, e);
                        }
                    }
                }
            }

            if !pull_response.has_more {
                break;
            }
            cursor = Some(pull_response.next_cursor);
        }

        Ok(downloaded)
    }

    /// Apply a single remote change to local filesystem
    async fn apply_remote_change(
        &self,
        vault_path: &Path,
        change: &RemoteChange,
    ) -> SyncResult<()> {
        // Decode the path (it's base64 encoded on server, but for simplified sync it's just the path)
        let relative_path = decode_path(&change.encrypted_path)?;
        let local_path = vault_path.join(&relative_path);

        match change.operation.as_str() {
            "delete" => {
                // In additive-only mode, don't delete local files
                if self.additive_only {
                    println!("[Sync] Skipping delete in additive mode: {}", relative_path);
                    return Ok(());
                }
                
                if local_path.exists() {
                    fs::remove_file(&local_path).map_err(SyncError::Io)?;
                }
                // Remove from local state (use vault_id for state operations)
                if let Some(ref state_manager) = self.state_manager {
                    state_manager.remove_file_state_by_id(&self.vault_id, &relative_path);
                }
            }
            "create" | "update" => {
                // In additive-only mode, skip files that already exist locally
                if self.additive_only && local_path.exists() {
                    println!("[Sync] Skipping existing file in additive mode: {}", relative_path);
                    // Still track the file state so we know it exists on remote
                    if let Some(ref state_manager) = self.state_manager {
                        // Read local file and compute hash to track state
                        if let Ok(local_content) = fs::read(&local_path) {
                            let local_hash = compute_hash(&local_content);
                            // Use vault_id for state operations
                            state_manager.mark_synced_by_id(
                                &self.vault_id,
                                &relative_path,
                                &local_hash,
                                change.version as u32
                            );
                        }
                    }
                    return Ok(());
                }
                
                // Check if we have a download URL
                let download_url = match &change.download_url {
                    Some(url) => url,
                    None => {
                        // File exists in remote database but content is not available
                        // This can happen if push was interrupted after creating the record
                        // but before uploading the file content
                        eprintln!(
                            "[Sync] Warning: No download URL for file '{}' (id: {}). \
                            File may not have been fully uploaded to the server.",
                            relative_path, change.id
                        );
                        return Err(SyncError::InvalidData(format!(
                            "File '{}' has no download URL - content not available on server",
                            relative_path
                        )));
                    }
                };

                // Build full download URL (server returns relative path)
                let full_download_url = if download_url.starts_with('/') {
                    format!("{}{}", self.server_url, download_url)
                } else {
                    download_url.clone()
                };

                // Download the file
                let content = self.download_file(&full_download_url).await?;

                // Verify hash
                let hash = compute_hash(&content);
                if hash != change.content_hash {
                    return Err(SyncError::InvalidData(
                        "Downloaded file hash mismatch".to_string(),
                    ));
                }

                // Ensure parent directory exists
                if let Some(parent) = local_path.parent() {
                    fs::create_dir_all(parent).map_err(SyncError::Io)?;
                }

                // Write file
                fs::write(&local_path, &content).map_err(SyncError::Io)?;

                // Update local state to mark as synced (use vault_id)
                if let Some(ref state_manager) = self.state_manager {
                    state_manager.mark_synced_by_id(
                        &self.vault_id, 
                        &relative_path, 
                        &hash, 
                        change.version as u32
                    );
                }
            }
            _ => {
                return Err(SyncError::InvalidData(format!(
                    "Unknown operation: {}",
                    change.operation
                )));
            }
        }

        Ok(())
    }

    /// Download a file from the given URL
    async fn download_file(&self, url: &str) -> SyncResult<Vec<u8>> {
        let response = self
            .client
            .get(url)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(SyncError::Network(format!(
                "Download failed: {} - {}",
                status, text
            )));
        }

        response
            .bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| SyncError::Network(e.to_string()))
    }

    /// Push local changes to server (incremental - only changed files)
    async fn push_changes_incremental(&self, change_set: &ChangeSet, _scan: &ScanResult) -> SyncResult<(u32, u32)> {
        let mut uploaded = 0u32;
        let mut deleted = 0u32;

        // Build list of changes to push - only changed and deleted files
        let mut changes = Vec::new();
        
        // Add changed files
        for info in &change_set.changed {
            // Get base_version from state manager if available (use vault_id)
            let base_version = self.state_manager.as_ref().and_then(|sm| {
                sm.get_file_state_by_id(&self.vault_id, &info.relative_path)
                    .and_then(|fs| fs.remote_version)
            });

            changes.push(serde_json::json!({
                "encrypted_path": encode_path(&info.relative_path),
                "operation": if base_version.is_some() { "update" } else { "create" },
                "content_hash": info.content_hash,
                "size": info.size_bytes,
                "modified_at": info.modified_at,
                "base_version": base_version
            }));
        }

        // Add deleted files
        for path in &change_set.deleted {
            // Use vault_id for state lookups
            let base_version = self.state_manager.as_ref().and_then(|sm| {
                sm.get_file_state_by_id(&self.vault_id, path)
                    .and_then(|fs| fs.remote_version)
            });

            changes.push(serde_json::json!({
                "encrypted_path": encode_path(path),
                "operation": "delete",
                "content_hash": "",
                "size": 0,
                "modified_at": 0,
                "base_version": base_version
            }));
        }

        if changes.is_empty() {
            println!("[Sync] No changes to push");
            return Ok((0, 0));
        }

        println!("[Sync] Pushing {} changes to server", changes.len());

        // Send push request
        let url = format!(
            "{}/api/v1/vaults/{}/sync/push",
            self.server_url, self.vault_id
        );

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .json(&serde_json::json!({ "changes": changes }))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(SyncError::Server(format!(
                "Push failed: {} - {}",
                status, text
            )));
        }

        let push_response: PushResponse = response
            .json()
            .await
            .map_err(|e| SyncError::InvalidData(e.to_string()))?;

        // Process results and upload files
        for result in push_response.results {
            if result.status == "accepted" {
                let path = decode_path(&result.encrypted_path)?;
                
                if let Some(upload_url) = result.upload_url {
                    // This is a create/update operation that needs file upload
                    let vault_path = Path::new(&self.vault_path);
                    let file_path = vault_path.join(&path);

                    // Build full upload URL (server returns relative path)
                    let full_upload_url = if upload_url.starts_with('/') {
                        format!("{}{}", self.server_url, upload_url)
                    } else {
                        upload_url.clone()
                    };

                    // Read and upload file
                    if let Ok(content) = fs::read(&file_path) {
                        let content_hash = compute_hash(&content);
                        match self.upload_file(&full_upload_url, &content).await {
                            Ok(_) => {
                                uploaded += 1;
                                // Confirm upload
                                if let Some(ref file_id) = result.file_id {
                                    let _ = self.confirm_upload(file_id).await;
                                }
                                // Update local state to mark as synced (use vault_id)
                                if let Some(ref state_manager) = self.state_manager {
                                    let version = result.new_version.unwrap_or(1) as u32;
                                    state_manager.mark_synced_by_id(&self.vault_id, &path, &content_hash, version);
                                }
                            }
                            Err(e) => {
                                eprintln!("Upload failed for {}: {}", path, e);
                            }
                        }
                    }
                } else {
                    // This is a delete operation (no upload needed)
                    deleted += 1;
                    // Remove from local state (use vault_id)
                    if let Some(ref state_manager) = self.state_manager {
                        state_manager.remove_file_state_by_id(&self.vault_id, &path);
                    }
                }
            }
        }

        Ok((uploaded, deleted))
    }

    /// Upload a file to the server
    async fn upload_file(&self, url: &str, content: &[u8]) -> SyncResult<()> {
        let response = self
            .client
            .put(url)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Content-Type", "application/octet-stream")
            .body(content.to_vec())
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(SyncError::Network(format!(
                "Upload failed: {} - {}",
                status, text
            )));
        }

        Ok(())
    }

    /// Confirm that an upload completed successfully
    async fn confirm_upload(&self, file_id: &str) -> SyncResult<()> {
        let url = format!(
            "{}/api/v1/vaults/{}/sync/confirm",
            self.server_url, self.vault_id
        );

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .json(&serde_json::json!({ "file_ids": [file_id] }))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(SyncError::Server("Confirm upload failed".to_string()));
        }

        Ok(())
    }
}

/// Encode a path for transmission (simple base64)
fn encode_path(path: &str) -> String {
    BASE64.encode(path.as_bytes())
}

/// Decode a path from transmission
fn decode_path(encoded: &str) -> SyncResult<String> {
    // Try base64 decode first
    if let Ok(bytes) = BASE64.decode(encoded) {
        if let Ok(s) = String::from_utf8(bytes) {
            return Ok(s);
        }
    }
    // If not base64, assume it's already a plain path
    Ok(encoded.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_path() {
        let path = "notes/test.md";
        let encoded = encode_path(path);
        let decoded = decode_path(&encoded).unwrap();
        assert_eq!(path, decoded);
    }

    #[test]
    fn test_decode_plain_path() {
        let path = "notes/test.md";
        let decoded = decode_path(path).unwrap();
        assert_eq!(path, decoded);
    }
}

