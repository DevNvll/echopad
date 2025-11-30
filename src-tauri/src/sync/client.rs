//! HTTP client for sync API communication

#![allow(dead_code)]

use reqwest::{Client, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

use super::auth::AuthManager;
use super::error::{SyncError, SyncResult};
use super::types::*;

/// Sync API client
pub struct SyncClient {
    client: Client,
    auth: Arc<AuthManager>,
}

impl SyncClient {
    /// Create a new sync client
    pub fn new(auth: Arc<AuthManager>) -> SyncResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Echopad/1.0")
            .build()
            .map_err(|e| SyncError::Network(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self { client, auth })
    }

    /// Get the base URL for API requests
    fn base_url(&self) -> SyncResult<String> {
        self.auth.get_server_url()
            .ok_or(SyncError::AuthRequired)
    }

    /// Make an authenticated request
    async fn request<T: DeserializeOwned, B: Serialize>(
        &self,
        method: reqwest::Method,
        endpoint: &str,
        body: Option<&B>,
    ) -> SyncResult<T> {
        let base_url = self.base_url()?;
        let url = format!("{}{}", base_url, endpoint);

        let token = self.auth.get_access_token()
            .ok_or(SyncError::SessionExpired)?;

        let mut request = self.client
            .request(method, &url)
            .header("Authorization", format!("Bearer {}", token));

        if let Some(b) = body {
            request = request.json(b);
        }

        let response = request.send().await
            .map_err(|e| SyncError::Network(format!("Request failed: {}", e)))?;

        let status = response.status();

        if status == StatusCode::UNAUTHORIZED {
            return Err(SyncError::SessionExpired);
        }

        if status == StatusCode::TOO_MANY_REQUESTS {
            let retry_after = response
                .headers()
                .get("Retry-After")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(60);
            return Err(SyncError::RateLimited(retry_after));
        }

        if !status.is_success() {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(SyncError::Server(format!("{}: {}", status, error_text)));
        }

        response.json().await
            .map_err(|e| SyncError::Server(format!("Failed to parse response: {}", e)))
    }

    /// Make an unauthenticated request
    async fn request_unauth<T: DeserializeOwned, B: Serialize>(
        &self,
        method: reqwest::Method,
        url: &str,
        body: Option<&B>,
    ) -> SyncResult<T> {
        let mut request = self.client.request(method, url);

        if let Some(b) = body {
            request = request.json(b);
        }

        let response = request.send().await
            .map_err(|e| SyncError::Network(format!("Request failed: {}", e)))?;

        let status = response.status();

        if status == StatusCode::TOO_MANY_REQUESTS {
            let retry_after = response
                .headers()
                .get("Retry-After")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(60);
            return Err(SyncError::RateLimited(retry_after));
        }

        if !status.is_success() {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(SyncError::Server(format!("{}: {}", status, error_text)));
        }

        response.json().await
            .map_err(|e| SyncError::Server(format!("Failed to parse response: {}", e)))
    }

    // ==========================================
    // Authentication endpoints
    // ==========================================

    /// Get salt for a user email
    pub async fn get_salt(&self, server_url: &str, email: &str) -> SyncResult<SaltResponse> {
        let url = format!("{}/api/v1/auth/salt?email={}", server_url, urlencoding::encode(email));
        self.request_unauth(reqwest::Method::GET, &url, None::<&()>).await
    }

    /// Register a new user
    pub async fn register(
        &self,
        server_url: &str,
        request: &RegisterRequest,
    ) -> SyncResult<AuthResponse> {
        let url = format!("{}/api/v1/auth/register", server_url);
        self.request_unauth(reqwest::Method::POST, &url, Some(request)).await
    }

    /// Login with credentials
    pub async fn login(
        &self,
        server_url: &str,
        request: &LoginRequest,
    ) -> SyncResult<AuthResponse> {
        let url = format!("{}/api/v1/auth/login", server_url);
        self.request_unauth(reqwest::Method::POST, &url, Some(request)).await
    }

    /// Refresh access token
    pub async fn refresh_token(&self, server_url: &str, refresh_token: &str) -> SyncResult<TokenRefreshResponse> {
        let url = format!("{}/api/v1/auth/refresh", server_url);
        let request = TokenRefreshRequest {
            refresh_token: refresh_token.to_string(),
        };
        self.request_unauth(reqwest::Method::POST, &url, Some(&request)).await
    }

    /// Logout (revoke refresh token)
    pub async fn logout(&self) -> SyncResult<()> {
        self.request::<EmptyResponse, ()>(reqwest::Method::POST, "/api/v1/auth/logout", None).await?;
        Ok(())
    }

    // ==========================================
    // Device endpoints
    // ==========================================

    /// List all devices
    pub async fn list_devices(&self) -> SyncResult<Vec<DeviceInfo>> {
        self.request(reqwest::Method::GET, "/api/v1/devices", None::<&()>).await
    }

    /// Revoke a device
    pub async fn revoke_device(&self, device_id: &str) -> SyncResult<()> {
        let endpoint = format!("/api/v1/devices/{}", device_id);
        self.request::<EmptyResponse, ()>(reqwest::Method::DELETE, &endpoint, None).await?;
        Ok(())
    }

    // ==========================================
    // Vault endpoints
    // ==========================================

    /// List all vaults
    pub async fn list_vaults(&self) -> SyncResult<Vec<VaultInfo>> {
        self.request(reqwest::Method::GET, "/api/v1/vaults", None::<&()>).await
    }

    /// Create a new vault
    pub async fn create_vault(&self, request: &CreateVaultRequest) -> SyncResult<VaultInfo> {
        self.request(reqwest::Method::POST, "/api/v1/vaults", Some(request)).await
    }

    /// Get vault details
    pub async fn get_vault(&self, vault_id: &str) -> SyncResult<VaultInfo> {
        let endpoint = format!("/api/v1/vaults/{}", vault_id);
        self.request(reqwest::Method::GET, &endpoint, None::<&()>).await
    }

    /// Delete a vault
    pub async fn delete_vault(&self, vault_id: &str) -> SyncResult<()> {
        let endpoint = format!("/api/v1/vaults/{}", vault_id);
        self.request::<EmptyResponse, ()>(reqwest::Method::DELETE, &endpoint, None).await?;
        Ok(())
    }

    /// Get encrypted vault key
    pub async fn get_vault_key(&self, vault_id: &str) -> SyncResult<EncryptedVaultKey> {
        let endpoint = format!("/api/v1/vaults/{}/key", vault_id);
        self.request(reqwest::Method::GET, &endpoint, None::<&()>).await
    }

    /// Store encrypted vault key
    pub async fn put_vault_key(&self, vault_id: &str, request: &PutVaultKeyRequest) -> SyncResult<()> {
        let endpoint = format!("/api/v1/vaults/{}/key", vault_id);
        self.request::<EmptyResponse, _>(reqwest::Method::PUT, &endpoint, Some(request)).await?;
        Ok(())
    }

    // ==========================================
    // Sync endpoints
    // ==========================================

    /// Pull remote changes
    pub async fn pull(&self, vault_id: &str, request: &PullRequest) -> SyncResult<PullResponse> {
        let endpoint = format!("/api/v1/vaults/{}/sync/pull", vault_id);
        self.request(reqwest::Method::POST, &endpoint, Some(request)).await
    }

    /// Push local changes
    pub async fn push(&self, vault_id: &str, request: &PushRequest) -> SyncResult<PushResponse> {
        let endpoint = format!("/api/v1/vaults/{}/sync/push", vault_id);
        self.request(reqwest::Method::POST, &endpoint, Some(request)).await
    }

    /// Confirm upload completion
    pub async fn confirm_upload(&self, vault_id: &str, request: &ConfirmUploadRequest) -> SyncResult<()> {
        let endpoint = format!("/api/v1/vaults/{}/sync/confirm", vault_id);
        self.request::<EmptyResponse, _>(reqwest::Method::POST, &endpoint, Some(request)).await?;
        Ok(())
    }

    /// Get sync status
    pub async fn get_sync_status(&self, vault_id: &str) -> SyncResult<VaultSyncStatusResponse> {
        let endpoint = format!("/api/v1/vaults/{}/sync/status", vault_id);
        self.request(reqwest::Method::GET, &endpoint, None::<&()>).await
    }

    // ==========================================
    // File operations
    // ==========================================

    /// Upload file to presigned URL
    pub async fn upload_file(&self, upload_url: &str, data: &[u8]) -> SyncResult<()> {
        let response = self.client
            .put(upload_url)
            .header("Content-Type", "application/octet-stream")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| SyncError::Network(format!("Upload failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(SyncError::Server(format!(
                "Upload failed with status: {}",
                response.status()
            )));
        }

        Ok(())
    }

    /// Download file from presigned URL
    pub async fn download_file(&self, download_url: &str) -> SyncResult<Vec<u8>> {
        let response = self.client
            .get(download_url)
            .send()
            .await
            .map_err(|e| SyncError::Network(format!("Download failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(SyncError::Server(format!(
                "Download failed with status: {}",
                response.status()
            )));
        }

        response.bytes().await
            .map(|b| b.to_vec())
            .map_err(|e| SyncError::Network(format!("Failed to read download: {}", e)))
    }

    // ==========================================
    // Account endpoints
    // ==========================================

    /// Get account info
    pub async fn get_account(&self) -> SyncResult<UserInfo> {
        self.request(reqwest::Method::GET, "/api/v1/account", None::<&()>).await
    }

    /// Get storage usage
    pub async fn get_usage(&self) -> SyncResult<UsageResponse> {
        self.request(reqwest::Method::GET, "/api/v1/account/usage", None::<&()>).await
    }
}

// ==========================================
// Request/Response types
// ==========================================

#[derive(Debug, Serialize)]
pub struct RegisterRequest {
    pub email: String,
    pub auth_hash: String,
    pub salt: String,
    pub device_name: String,
    pub device_type: DeviceType,
}

#[derive(Debug, Serialize)]
pub struct LoginRequest {
    pub email: String,
    pub auth_hash: String,
    pub device_name: String,
    pub device_type: DeviceType,
}

#[derive(Debug, Deserialize)]
pub struct SaltResponse {
    pub salt: String,
}

#[derive(Debug, Serialize)]
pub struct TokenRefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct TokenRefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

#[derive(Debug, Serialize)]
pub struct CreateVaultRequest {
    pub name: String,
    pub encrypted_key: String,
    pub key_nonce: String,
}

#[derive(Debug, Serialize)]
pub struct PutVaultKeyRequest {
    pub encrypted_key: String,
    pub key_nonce: String,
}

#[derive(Debug, Serialize)]
pub struct PullRequest {
    pub cursor: Option<String>,
    pub limit: u32,
}

#[derive(Debug, Serialize)]
pub struct ConfirmUploadRequest {
    pub file_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct VaultSyncStatusResponse {
    pub file_count: u32,
    pub total_size_bytes: u64,
    pub last_modified: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct UsageResponse {
    pub storage_used_bytes: u64,
    pub storage_quota_bytes: u64,
    pub vault_count: u32,
}

#[derive(Debug, Deserialize)]
struct EmptyResponse {}

