//! Sync engine - orchestrates the sync process

use std::fs;
use std::path::Path;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::error::{SyncError, SyncResult};
use super::scanner::{compute_hash, scan_vault, ScanResult};
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
pub struct SyncEngine {
    pub server_url: String,
    pub access_token: String,
    pub vault_id: String,
    pub vault_path: String,
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
            client: Client::new(),
        }
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

        // 1. Scan local files
        let scan_result = scan_vault(vault_path)?;
        println!("[Sync] Found {} local files", scan_result.file_count);
        
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

        // 3. Push local changes
        match self.push_changes(&scan_result).await {
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
            for change in &pull_response.changes {
                if let Err(e) = self.apply_remote_change(vault_path, change).await {
                    eprintln!("Failed to apply change for {}: {}", change.encrypted_path, e);
                } else {
                    downloaded += 1;
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
                if local_path.exists() {
                    fs::remove_file(&local_path).map_err(SyncError::Io)?;
                }
            }
            "create" | "update" => {
                // Check if we need to download
                if let Some(download_url) = &change.download_url {
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
                    fs::write(&local_path, content).map_err(SyncError::Io)?;
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

    /// Push local changes to server
    async fn push_changes(&self, scan: &ScanResult) -> SyncResult<(u32, u32)> {
        let mut uploaded = 0u32;
        let mut deleted = 0u32;

        // Build list of changes to push
        let mut changes = Vec::new();
        for (path, info) in &scan.files {
            changes.push(serde_json::json!({
                "encrypted_path": encode_path(path),
                "operation": "update",
                "content_hash": info.content_hash,
                "size": info.size_bytes,
                "modified_at": info.modified_at,
                "base_version": null
            }));
        }

        if changes.is_empty() {
            return Ok((0, 0));
        }

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
                if let Some(upload_url) = result.upload_url {
                    // Get the file path from encrypted_path
                    let path = decode_path(&result.encrypted_path)?;
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
                        match self.upload_file(&full_upload_url, &content).await {
                            Ok(_) => {
                                uploaded += 1;
                                // Confirm upload
                                if let Some(ref file_id) = result.file_id {
                                    let _ = self.confirm_upload(file_id).await;
                                }
                            }
                            Err(e) => {
                                eprintln!("Upload failed for {}: {}", path, e);
                            }
                        }
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

