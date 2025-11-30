-- Echopad Sync API - D1 Database Schema
-- Authentication & Sync Metadata

-- ============================================
-- AUTHENTICATION TABLES
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                          -- UUID
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                  -- Argon2id hash of auth_key
  salt TEXT NOT NULL,                           -- Base64-encoded 32-byte salt
  created_at INTEGER NOT NULL,                  -- Unix timestamp ms
  email_verified INTEGER NOT NULL DEFAULT 0,    -- Boolean
  subscription_tier TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'team'
  storage_quota_bytes INTEGER NOT NULL DEFAULT 104857600, -- 100MB default
  storage_used_bytes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,                          -- UUID
  user_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,                    -- 'desktop' | 'mobile'
  public_key TEXT,                              -- Base64-encoded X25519 public key
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,                           -- Null if active
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- Sessions table (refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                          -- UUID (refresh token ID)
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,                     -- SHA-256 hash of refresh token
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,                           -- 6-digit code
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);

-- ============================================
-- VAULT & SYNC TABLES
-- ============================================

-- Vaults table
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,                          -- UUID
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                           -- Encrypted vault name
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,                           -- Soft delete
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vaults_user ON vaults(user_id);

-- Vault encryption keys
CREATE TABLE IF NOT EXISTS vault_keys (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,                  -- Base64 vault key encrypted with account key
  key_nonce TEXT NOT NULL,                      -- Base64 24-byte nonce
  created_at INTEGER NOT NULL,
  rotated_at INTEGER,
  FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_keys_vault ON vault_keys(vault_id);

-- Vault files metadata
CREATE TABLE IF NOT EXISTS vault_files (
  id TEXT PRIMARY KEY,                          -- UUID
  vault_id TEXT NOT NULL,
  encrypted_path TEXT NOT NULL,                 -- Base64 encrypted relative path
  content_hash TEXT NOT NULL,                   -- BLAKE3 hash of plaintext
  encrypted_content_hash TEXT NOT NULL,         -- BLAKE3 hash of ciphertext
  size_bytes INTEGER NOT NULL,
  modified_at INTEGER NOT NULL,
  deleted_at INTEGER,                           -- Soft delete timestamp
  version INTEGER NOT NULL DEFAULT 1,
  storage_key TEXT NOT NULL,                    -- R2 object key
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_files_vault ON vault_files(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_sync ON vault_files(vault_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_vault_files_path ON vault_files(vault_id, encrypted_path);

-- Sync cursors (track sync state per device per vault)
CREATE TABLE IF NOT EXISTS sync_cursors (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  cursor TEXT NOT NULL,                         -- Last sync cursor
  updated_at INTEGER NOT NULL,
  UNIQUE(vault_id, device_id),
  FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_cursors_vault_device ON sync_cursors(vault_id, device_id);

-- Conflict records
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  conflict_path TEXT NOT NULL,                  -- Path of conflict file
  original_path TEXT NOT NULL,                  -- Original file path (encrypted)
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES vault_files(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_vault ON sync_conflicts(vault_id);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_id TEXT,
  action TEXT NOT NULL,                         -- 'login' | 'logout' | 'register' | etc.
  details TEXT,                                 -- JSON details
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- RATE LIMITING
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,                         -- e.g., "login:192.168.1.1" or "register:email@example.com"
  count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL,                -- Unix timestamp of window start
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

