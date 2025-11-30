//! Cryptographic operations for E2E encryption
//! 
//! Key hierarchy:
//! - User password → Argon2id → Master Key (32 bytes)
//! - Master Key → HKDF("auth") → Auth Key (for server authentication)
//! - Master Key → HKDF("encrypt") → Account Encryption Key
//! - Account Encryption Key encrypts/decrypts Vault Keys
//! - Vault Key encrypts/decrypts file content and paths

#![allow(dead_code)]

use argon2::{Argon2, Algorithm, Params, Version};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    XChaCha20Poly1305, XNonce,
};
use hkdf::Hkdf;
use sha2::Sha256;
use rand::RngCore;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

use super::error::{SyncError, SyncResult};

/// Size of encryption keys in bytes
pub const KEY_SIZE: usize = 32;
/// Size of salt in bytes
pub const SALT_SIZE: usize = 32;
/// Size of nonce for XChaCha20-Poly1305
pub const NONCE_SIZE: usize = 24;
/// Argon2 memory cost (64 KB)
pub const ARGON2_MEMORY_KB: u32 = 65536;
/// Argon2 iterations
pub const ARGON2_ITERATIONS: u32 = 3;
/// Argon2 parallelism
pub const ARGON2_PARALLELISM: u32 = 1;

/// Cryptographic key wrapper
#[derive(Clone)]
pub struct CryptoKey {
    bytes: [u8; KEY_SIZE],
}

impl CryptoKey {
    /// Create a new key from bytes
    pub fn from_bytes(bytes: [u8; KEY_SIZE]) -> Self {
        Self { bytes }
    }

    /// Get the key bytes
    pub fn as_bytes(&self) -> &[u8; KEY_SIZE] {
        &self.bytes
    }

    /// Generate a random key
    pub fn generate() -> Self {
        let mut bytes = [0u8; KEY_SIZE];
        OsRng.fill_bytes(&mut bytes);
        Self { bytes }
    }

    /// Encode key as base64
    pub fn to_base64(&self) -> String {
        BASE64.encode(self.bytes)
    }

    /// Decode key from base64
    pub fn from_base64(encoded: &str) -> SyncResult<Self> {
        let bytes = BASE64.decode(encoded)
            .map_err(|e| SyncError::Decryption(format!("Invalid base64: {}", e)))?;
        
        if bytes.len() != KEY_SIZE {
            return Err(SyncError::Decryption(format!(
                "Invalid key size: expected {}, got {}",
                KEY_SIZE,
                bytes.len()
            )));
        }

        let mut key_bytes = [0u8; KEY_SIZE];
        key_bytes.copy_from_slice(&bytes);
        Ok(Self { bytes: key_bytes })
    }
}

impl Drop for CryptoKey {
    fn drop(&mut self) {
        // Zero out key memory on drop
        self.bytes.fill(0);
    }
}

/// Salt for key derivation
#[derive(Clone)]
pub struct Salt {
    bytes: [u8; SALT_SIZE],
}

impl Salt {
    /// Generate a random salt
    pub fn generate() -> Self {
        let mut bytes = [0u8; SALT_SIZE];
        OsRng.fill_bytes(&mut bytes);
        Self { bytes }
    }

    /// Create salt from bytes
    pub fn from_bytes(bytes: [u8; SALT_SIZE]) -> Self {
        Self { bytes }
    }

    /// Get the salt bytes
    pub fn as_bytes(&self) -> &[u8; SALT_SIZE] {
        &self.bytes
    }

    /// Encode salt as base64
    pub fn to_base64(&self) -> String {
        BASE64.encode(self.bytes)
    }

    /// Decode salt from base64
    pub fn from_base64(encoded: &str) -> SyncResult<Self> {
        let bytes = BASE64.decode(encoded)
            .map_err(|e| SyncError::KeyDerivation(format!("Invalid salt base64: {}", e)))?;
        
        if bytes.len() != SALT_SIZE {
            return Err(SyncError::KeyDerivation(format!(
                "Invalid salt size: expected {}, got {}",
                SALT_SIZE,
                bytes.len()
            )));
        }

        let mut salt_bytes = [0u8; SALT_SIZE];
        salt_bytes.copy_from_slice(&bytes);
        Ok(Self { bytes: salt_bytes })
    }
}

/// Derived keys from master key
pub struct DerivedKeys {
    pub auth_key: CryptoKey,
    pub encryption_key: CryptoKey,
}

/// Derive master key from password using Argon2id
pub fn derive_master_key(password: &str, salt: &Salt) -> SyncResult<CryptoKey> {
    let params = Params::new(
        ARGON2_MEMORY_KB,
        ARGON2_ITERATIONS,
        ARGON2_PARALLELISM,
        Some(KEY_SIZE),
    ).map_err(|e| SyncError::KeyDerivation(format!("Invalid Argon2 params: {}", e)))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    
    let mut output = [0u8; KEY_SIZE];
    argon2
        .hash_password_into(password.as_bytes(), salt.as_bytes(), &mut output)
        .map_err(|e| SyncError::KeyDerivation(format!("Argon2 failed: {}", e)))?;

    Ok(CryptoKey::from_bytes(output))
}

/// Derive auth and encryption keys from master key using HKDF
pub fn derive_keys(master_key: &CryptoKey) -> SyncResult<DerivedKeys> {
    let hk = Hkdf::<Sha256>::new(None, master_key.as_bytes());
    
    // Derive auth key
    let mut auth_bytes = [0u8; KEY_SIZE];
    hk.expand(b"auth", &mut auth_bytes)
        .map_err(|_| SyncError::KeyDerivation("HKDF expand failed for auth key".into()))?;
    
    // Derive encryption key
    let mut enc_bytes = [0u8; KEY_SIZE];
    hk.expand(b"encrypt", &mut enc_bytes)
        .map_err(|_| SyncError::KeyDerivation("HKDF expand failed for encryption key".into()))?;
    
    Ok(DerivedKeys {
        auth_key: CryptoKey::from_bytes(auth_bytes),
        encryption_key: CryptoKey::from_bytes(enc_bytes),
    })
}

/// Hash auth key for server verification (second Argon2 pass)
pub fn hash_auth_key(auth_key: &CryptoKey) -> SyncResult<String> {
    // Use a fixed salt for the auth hash (deterministic for verification)
    let salt = b"echopad-auth-v1\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
    
    let params = Params::new(
        ARGON2_MEMORY_KB / 4, // Lower memory for faster verification
        2,
        1,
        Some(KEY_SIZE),
    ).map_err(|e| SyncError::KeyDerivation(format!("Invalid Argon2 params: {}", e)))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    
    let mut output = [0u8; KEY_SIZE];
    argon2
        .hash_password_into(auth_key.as_bytes(), salt, &mut output)
        .map_err(|e| SyncError::KeyDerivation(format!("Auth hash failed: {}", e)))?;

    Ok(BASE64.encode(output))
}

/// Encrypt data with XChaCha20-Poly1305
pub fn encrypt(key: &CryptoKey, plaintext: &[u8]) -> SyncResult<Vec<u8>> {
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_bytes())
        .map_err(|e| SyncError::Encryption(format!("Invalid key: {}", e)))?;
    
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| SyncError::Encryption(format!("Encryption failed: {}", e)))?;
    
    // Prepend nonce to ciphertext
    let mut result = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    result.extend_from_slice(nonce.as_slice());
    result.extend_from_slice(&ciphertext);
    
    Ok(result)
}

/// Decrypt data with XChaCha20-Poly1305
pub fn decrypt(key: &CryptoKey, ciphertext: &[u8]) -> SyncResult<Vec<u8>> {
    if ciphertext.len() < NONCE_SIZE {
        return Err(SyncError::Decryption("Ciphertext too short".into()));
    }
    
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_bytes())
        .map_err(|e| SyncError::Decryption(format!("Invalid key: {}", e)))?;
    
    let nonce = XNonce::from_slice(&ciphertext[..NONCE_SIZE]);
    let encrypted = &ciphertext[NONCE_SIZE..];
    
    cipher
        .decrypt(nonce, encrypted)
        .map_err(|e| SyncError::Decryption(format!("Decryption failed: {}", e)))
}

/// Encrypt string and encode as base64
pub fn encrypt_string(key: &CryptoKey, plaintext: &str) -> SyncResult<String> {
    let encrypted = encrypt(key, plaintext.as_bytes())?;
    Ok(BASE64.encode(encrypted))
}

/// Decrypt base64 string
pub fn decrypt_string(key: &CryptoKey, ciphertext_b64: &str) -> SyncResult<String> {
    let ciphertext = BASE64.decode(ciphertext_b64)
        .map_err(|e| SyncError::Decryption(format!("Invalid base64: {}", e)))?;
    
    let decrypted = decrypt(key, &ciphertext)?;
    
    String::from_utf8(decrypted)
        .map_err(|e| SyncError::Decryption(format!("Invalid UTF-8: {}", e)))
}

/// Encrypt a vault key with the account encryption key
pub fn encrypt_vault_key(account_key: &CryptoKey, vault_key: &CryptoKey) -> SyncResult<(String, String)> {
    let cipher = XChaCha20Poly1305::new_from_slice(account_key.as_bytes())
        .map_err(|e| SyncError::Encryption(format!("Invalid key: {}", e)))?;
    
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    
    let ciphertext = cipher
        .encrypt(&nonce, vault_key.as_bytes().as_slice())
        .map_err(|e| SyncError::Encryption(format!("Vault key encryption failed: {}", e)))?;
    
    Ok((BASE64.encode(ciphertext), BASE64.encode(nonce.as_slice())))
}

/// Decrypt a vault key with the account encryption key
pub fn decrypt_vault_key(
    account_key: &CryptoKey,
    encrypted_key_b64: &str,
    nonce_b64: &str,
) -> SyncResult<CryptoKey> {
    let cipher = XChaCha20Poly1305::new_from_slice(account_key.as_bytes())
        .map_err(|e| SyncError::Decryption(format!("Invalid key: {}", e)))?;
    
    let encrypted = BASE64.decode(encrypted_key_b64)
        .map_err(|e| SyncError::Decryption(format!("Invalid encrypted key base64: {}", e)))?;
    
    let nonce_bytes = BASE64.decode(nonce_b64)
        .map_err(|e| SyncError::Decryption(format!("Invalid nonce base64: {}", e)))?;
    
    if nonce_bytes.len() != NONCE_SIZE {
        return Err(SyncError::Decryption(format!(
            "Invalid nonce size: expected {}, got {}",
            NONCE_SIZE,
            nonce_bytes.len()
        )));
    }
    
    let nonce = XNonce::from_slice(&nonce_bytes);
    
    let decrypted = cipher
        .decrypt(nonce, encrypted.as_slice())
        .map_err(|e| SyncError::Decryption(format!("Vault key decryption failed: {}", e)))?;
    
    if decrypted.len() != KEY_SIZE {
        return Err(SyncError::Decryption(format!(
            "Invalid decrypted key size: expected {}, got {}",
            KEY_SIZE,
            decrypted.len()
        )));
    }
    
    let mut key_bytes = [0u8; KEY_SIZE];
    key_bytes.copy_from_slice(&decrypted);
    Ok(CryptoKey::from_bytes(key_bytes))
}

/// Compute BLAKE3 hash of data
pub fn hash_content(data: &[u8]) -> String {
    let hash = blake3::hash(data);
    hash.to_hex().to_string()
}

/// Compute BLAKE3 hash of a file
pub fn hash_file(path: &std::path::Path) -> SyncResult<String> {
    let data = std::fs::read(path)?;
    Ok(hash_content(&data))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let password = "test-password-123";
        let salt = Salt::generate();
        
        let master_key = derive_master_key(password, &salt).unwrap();
        let keys = derive_keys(&master_key).unwrap();
        
        // Keys should be different
        assert_ne!(keys.auth_key.as_bytes(), keys.encryption_key.as_bytes());
        
        // Same password + salt should produce same keys
        let master_key2 = derive_master_key(password, &salt).unwrap();
        assert_eq!(master_key.as_bytes(), master_key2.as_bytes());
    }

    #[test]
    fn test_encryption_roundtrip() {
        let key = CryptoKey::generate();
        let plaintext = b"Hello, World! This is a test message.";
        
        let encrypted = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &encrypted).unwrap();
        
        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_string_encryption() {
        let key = CryptoKey::generate();
        let plaintext = "Test string with unicode: 日本語 🎉";
        
        let encrypted = encrypt_string(&key, plaintext).unwrap();
        let decrypted = decrypt_string(&key, &encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_vault_key_encryption() {
        let account_key = CryptoKey::generate();
        let vault_key = CryptoKey::generate();
        
        let (encrypted, nonce) = encrypt_vault_key(&account_key, &vault_key).unwrap();
        let decrypted = decrypt_vault_key(&account_key, &encrypted, &nonce).unwrap();
        
        assert_eq!(vault_key.as_bytes(), decrypted.as_bytes());
    }

    #[test]
    fn test_content_hash() {
        let data = b"Test data for hashing";
        let hash1 = hash_content(data);
        let hash2 = hash_content(data);
        
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // BLAKE3 produces 32 bytes = 64 hex chars
    }
}

