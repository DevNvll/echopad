# Echopad Sync Architecture

## Overview

Echopad Sync provides end-to-end encrypted synchronization of notes across devices. The architecture follows a zero-knowledge design where the server never sees plaintext data.

## System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ECHOPAD SYNC ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                      ┌──────────────────┐             │
│  │                  │      HTTPS/TLS       │                  │             │
│  │  Echopad Client  │ ◄──────────────────► │   Sync Backend   │             │
│  │  (Tauri + React) │                      │  (Workers/API)   │             │
│  │                  │                      │                  │             │
│  └────────┬─────────┘                      └────────┬─────────┘             │
│           │                                         │                        │
│           │                                         │                        │
│           ▼                                         ▼                        │
│  ┌──────────────────┐                      ┌──────────────────┐             │
│  │   Local Vault    │                      │   Encrypted      │             │
│  │   (Plaintext)    │                      │   Blob Storage   │             │
│  │   - Notes (.md)  │                      │   (R2/S3)        │             │
│  │   - Attachments  │                      │                  │             │
│  └────────┬─────────┘                      └──────────────────┘             │
│           │                                         │                        │
│           ▼                                         ▼                        │
│  ┌──────────────────┐                      ┌──────────────────┐             │
│  │  Local SQLite    │                      │   Metadata DB    │             │
│  │  (echopad.db)    │                      │   (D1/Postgres)  │             │
│  │  - Sync state    │                      │   - Users        │             │
│  │  - File hashes   │                      │   - Vaults       │             │
│  │  - Credentials   │                      │   - File meta    │             │
│  └──────────────────┘                      └──────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Encryption Flow

### Key Derivation Hierarchy

```
User Password
      │
      ▼
┌─────────────────────────────────┐
│         Argon2id KDF            │
│  - Memory: 64KB                 │
│  - Iterations: 3                │
│  - Salt: 32 bytes (random)      │
└────────────┬────────────────────┘
             │
             ▼
      Master Key (32 bytes)
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐    ┌─────────────────┐
│Auth Key │    │ Encryption Key  │
│(HKDF)   │    │ (HKDF)          │
└────┬────┘    └───────┬─────────┘
     │                 │
     ▼                 ▼
┌─────────────┐  ┌─────────────────┐
│Server Auth  │  │ Vault Keys      │
│(verifies    │  │ (encrypted with │
│ identity)   │  │  encryption key)│
└─────────────┘  └───────┬─────────┘
                         │
                         ▼
                  ┌─────────────────┐
                  │ File Content &  │
                  │ Path Encryption │
                  │ (XChaCha20-     │
                  │  Poly1305)      │
                  └─────────────────┘
```

### File Encryption Process

1. **Content Encryption**
   ```
   nonce = random(24 bytes)
   ciphertext = XChaCha20-Poly1305(vault_key, nonce, plaintext)
   stored = nonce || ciphertext
   ```

2. **Path Encryption**
   ```
   encrypted_path = encrypt(vault_key, relative_path)
   ```

3. **Content Hashing**
   ```
   content_hash = BLAKE3(plaintext)  # For sync comparison
   ```

## Sync Protocol

### Sync Cycle Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYNC CYCLE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PULL PHASE                                                   │
│     │                                                            │
│     ├──► Request changes since last_cursor                       │
│     │                                                            │
│     ├──► For each change:                                        │
│     │    ├── Download encrypted content                          │
│     │    ├── Decrypt with vault key                              │
│     │    ├── Write to local vault                                │
│     │    └── Update file sync state                              │
│     │                                                            │
│     └──► Update cursor                                           │
│                                                                  │
│  2. DETECT LOCAL CHANGES                                         │
│     │                                                            │
│     ├──► Scan vault directory                                    │
│     ├──► Compute BLAKE3 hashes                                   │
│     ├──► Compare with sync state                                 │
│     └──► Build change list                                       │
│                                                                  │
│  3. PUSH PHASE                                                   │
│     │                                                            │
│     ├──► Send change manifest                                    │
│     │                                                            │
│     ├──► For each accepted change:                               │
│     │    ├── Encrypt content with vault key                      │
│     │    ├── Upload to presigned URL                             │
│     │    └── Confirm upload                                      │
│     │                                                            │
│     └──► Handle any conflicts                                    │
│                                                                  │
│  4. FINALIZE                                                     │
│     │                                                            │
│     ├──► Update sync state                                       │
│     └──► Clear pending queues                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Conflict Resolution

When a conflict is detected (same file modified on multiple devices):

1. Server compares `base_version` with current version
2. If versions match: Normal update
3. If versions differ:
   - Compare content hashes
   - If hashes match: No actual conflict (same edit)
   - If hashes differ: Create conflict file

Conflict files are named: `{filename}.sync-conflict-{device_id_short}{timestamp}.md`

## Backend Architecture

### Cloudflare Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE INFRASTRUCTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │  Cloudflare     │                                            │
│  │  Workers        │──────┐                                     │
│  │  (sync-api)     │      │                                     │
│  └────────┬────────┘      │                                     │
│           │               │                                     │
│           ▼               ▼                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │     D1      │  │     R2      │  │   Queues    │             │
│  │  (SQLite)   │  │   (S3)      │  │  (Tasks)    │             │
│  │             │  │             │  │             │             │
│  │ - users     │  │ - vaults/   │  │ - cleanup   │             │
│  │ - devices   │  │   {id}/     │  │ - webhooks  │             │
│  │ - vaults    │  │   {file}    │  │             │             │
│  │ - files     │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Self-Hosted Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-HOSTED INFRASTRUCTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │  API Server     │                                            │
│  │  (Rust/Go)      │──────┐                                     │
│  │                 │      │                                     │
│  └────────┬────────┘      │                                     │
│           │               │                                     │
│           ▼               ▼                                     │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ PostgreSQL  │  │   MinIO     │                               │
│  │             │  │   (S3)      │                               │
│  │ - users     │  │             │                               │
│  │ - devices   │  │ - vaults/   │                               │
│  │ - vaults    │  │   {id}/     │                               │
│  │ - files     │  │   {file}    │                               │
│  └─────────────┘  └─────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Client Architecture

### Tauri Sync Module

```
src-tauri/src/sync/
├── mod.rs           # Module entry point
├── crypto.rs        # Encryption/decryption (XChaCha20-Poly1305, Argon2)
├── auth.rs          # Authentication state management
├── client.rs        # HTTP client for API communication
├── state.rs         # Local sync state management
├── watcher.rs       # File system change detection (notify)
├── conflict.rs      # Conflict detection and resolution
├── queue.rs         # Upload/download queue with retry logic
├── commands.rs      # Tauri IPC commands
├── error.rs         # Error types
└── types.rs         # Type definitions
```

### React Components

```
components/sync/
├── SyncLogin.tsx      # Login/register modal
├── SyncSettings.tsx   # Main settings panel
├── SyncStatus.tsx     # Status indicator
├── VaultSyncToggle.tsx# Per-vault toggle
├── DeviceManager.tsx  # Device list
├── ConflictResolver.tsx# Conflict UI
├── SyncProgress.tsx   # Progress overlay
└── index.ts           # Exports
```

## Security Model

### Zero-Knowledge Design

1. Server never receives plaintext content
2. Server cannot decrypt vault keys (encrypted with user's key)
3. Server stores only:
   - Email + hashed auth key
   - Encrypted vault metadata
   - Encrypted file blobs
   - Content hashes (for sync comparison)

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|------------|
| Server compromise | E2E encryption - all data encrypted |
| MITM | TLS + optional certificate pinning |
| Brute force | Argon2id + rate limiting |
| Credential theft | Keys derived from password, never stored |
| Replay attacks | Nonces, timestamps, JWT expiry |
| Device theft | Re-auth required, device revocation |

## Data Flow

### Registration Flow

```
Client                              Server
  │                                    │
  │──── 1. Generate salt ─────────────►│
  │                                    │
  │──── 2. Derive keys (Argon2+HKDF) ──│
  │                                    │
  │──── 3. Register(email, hash, salt)►│
  │                                    │
  │◄─── 4. Return JWT + device_id ─────│
  │                                    │
```

### Sync Flow

```
Client                              Server                    R2
  │                                    │                       │
  │──── 1. Pull(cursor) ──────────────►│                       │
  │                                    │                       │
  │◄─── 2. Changes + download URLs ────│                       │
  │                                    │                       │
  │──── 3. Download encrypted files ───┼──────────────────────►│
  │                                    │                       │
  │◄─── 4. Encrypted content ──────────┼───────────────────────│
  │                                    │                       │
  │ (Decrypt locally)                  │                       │
  │                                    │                       │
  │──── 5. Push(changes) ─────────────►│                       │
  │                                    │                       │
  │◄─── 6. Upload URLs ────────────────│                       │
  │                                    │                       │
  │──── 7. Upload encrypted files ─────┼──────────────────────►│
  │                                    │                       │
  │──── 8. Confirm() ─────────────────►│                       │
  │                                    │                       │
```


