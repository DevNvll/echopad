//! Authentication management for sync

#![allow(dead_code)]

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::crypto::{derive_keys, derive_master_key, hash_auth_key, CryptoKey, Salt};
use super::error::SyncResult;
use super::types::{AuthResponse, DeviceType, UserInfo};

/// Authentication state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthState {
    pub user: UserInfo,
    pub device_id: String,
    pub server_url: String,
    pub access_token: String,
    pub refresh_token: String,
    pub token_expires_at: u64,
}

/// Stored credentials (encrypted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub email: String,
    pub salt: String,
    pub device_id: String,
    pub server_url: String,
    pub encrypted_refresh_token: String,
    pub token_nonce: String,
}

/// Authentication manager
pub struct AuthManager {
    state: Arc<RwLock<Option<AuthState>>>,
    encryption_key: Arc<RwLock<Option<CryptoKey>>>,
}

impl AuthManager {
    /// Create a new auth manager
    pub fn new() -> Self {
        Self {
            state: Arc::new(RwLock::new(None)),
            encryption_key: Arc::new(RwLock::new(None)),
        }
    }

    /// Check if user is logged in
    pub fn is_logged_in(&self) -> bool {
        self.state.read().is_some()
    }

    /// Get current user info
    pub fn get_user(&self) -> Option<UserInfo> {
        self.state.read().as_ref().map(|s| s.user.clone())
    }

    /// Get current device ID
    pub fn get_device_id(&self) -> Option<String> {
        self.state.read().as_ref().map(|s| s.device_id.clone())
    }

    /// Get access token (checking expiration)
    pub fn get_access_token(&self) -> Option<String> {
        let state = self.state.read();
        state.as_ref().and_then(|s| {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            if now < s.token_expires_at {
                Some(s.access_token.clone())
            } else {
                None
            }
        })
    }

    /// Get refresh token
    pub fn get_refresh_token(&self) -> Option<String> {
        self.state.read().as_ref().map(|s| s.refresh_token.clone())
    }

    /// Get server URL
    pub fn get_server_url(&self) -> Option<String> {
        self.state.read().as_ref().map(|s| s.server_url.clone())
    }

    /// Get the encryption key
    pub fn get_encryption_key(&self) -> Option<CryptoKey> {
        self.encryption_key.read().clone()
    }

    /// Prepare registration credentials
    pub fn prepare_registration(email: &str, password: &str) -> SyncResult<RegistrationData> {
        let salt = Salt::generate();
        let master_key = derive_master_key(password, &salt)?;
        let keys = derive_keys(&master_key)?;
        let auth_hash = hash_auth_key(&keys.auth_key)?;

        Ok(RegistrationData {
            email: email.to_string(),
            salt: salt.to_base64(),
            auth_hash,
            encryption_key: keys.encryption_key,
        })
    }

    /// Prepare login credentials
    pub fn prepare_login(password: &str, salt_b64: &str) -> SyncResult<LoginData> {
        let salt = Salt::from_base64(salt_b64)?;
        let master_key = derive_master_key(password, &salt)?;
        let keys = derive_keys(&master_key)?;
        let auth_hash = hash_auth_key(&keys.auth_key)?;

        Ok(LoginData {
            auth_hash,
            encryption_key: keys.encryption_key,
        })
    }

    /// Set auth state after successful login (with encryption key for E2E)
    pub fn set_auth_state(
        &self,
        response: AuthResponse,
        server_url: String,
        encryption_key: CryptoKey,
    ) {
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + response.expires_in;

        let state = AuthState {
            user: response.user,
            device_id: response.device_id,
            server_url,
            access_token: response.access_token,
            refresh_token: response.refresh_token,
            token_expires_at: expires_at,
        };

        *self.state.write() = Some(state);
        *self.encryption_key.write() = Some(encryption_key);
    }

    /// Set auth state after successful login (simplified, no E2E encryption)
    pub fn set_auth_state_simple(&self, response: AuthResponse, server_url: String) {
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + response.expires_in;

        let state = AuthState {
            user: response.user,
            device_id: response.device_id,
            server_url,
            access_token: response.access_token,
            refresh_token: response.refresh_token,
            token_expires_at: expires_at,
        };

        *self.state.write() = Some(state);
        // No encryption key for simplified auth
    }

    /// Update tokens after refresh
    pub fn update_tokens(&self, access_token: String, refresh_token: String, expires_in: u64) {
        if let Some(state) = self.state.write().as_mut() {
            state.access_token = access_token;
            state.refresh_token = refresh_token;
            state.token_expires_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
                + expires_in;
        }
    }

    /// Clear auth state (logout)
    pub fn clear(&self) {
        *self.state.write() = None;
        *self.encryption_key.write() = None;
    }

    /// Check if token needs refresh (within 5 minutes of expiry)
    pub fn needs_token_refresh(&self) -> bool {
        let state = self.state.read();
        state.as_ref().map_or(false, |s| {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            now + 300 >= s.token_expires_at
        })
    }
}

impl Default for AuthManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Registration data prepared for server
pub struct RegistrationData {
    pub email: String,
    pub salt: String,
    pub auth_hash: String,
    pub encryption_key: CryptoKey,
}

/// Login data prepared for server
pub struct LoginData {
    pub auth_hash: String,
    pub encryption_key: CryptoKey,
}

/// Device registration request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceRegistration {
    pub name: String,
    pub device_type: DeviceType,
    pub public_key: Option<String>,
}

impl DeviceRegistration {
    /// Create a new device registration for the current platform
    pub fn new_for_current_platform() -> Self {
        let name = Self::get_device_name();
        Self {
            name,
            device_type: DeviceType::Desktop,
            public_key: None,
        }
    }

    fn get_device_name() -> String {
        // Try to get hostname or use a default
        hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "Unknown Device".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registration_preparation() {
        let email = "test@example.com";
        let password = "secure-password-123";

        let reg = AuthManager::prepare_registration(email, password).unwrap();

        assert_eq!(reg.email, email);
        assert!(!reg.salt.is_empty());
        assert!(!reg.auth_hash.is_empty());
    }

    #[test]
    fn test_login_preparation_consistency() {
        let password = "secure-password-123";

        // Simulate registration
        let reg = AuthManager::prepare_registration("test@example.com", password).unwrap();

        // Simulate login with same password and salt
        let login = AuthManager::prepare_login(password, &reg.salt).unwrap();

        // Auth hashes should match
        assert_eq!(reg.auth_hash, login.auth_hash);
    }
}
