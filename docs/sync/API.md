# Echopad Sync API Reference

Base URL: `https://sync.echopad.app/api/v1`

## Authentication

### Get Salt

Retrieve the salt for a user's email (for key derivation).

```http
GET /auth/salt?email={email}
```

**Response:**
```json
{
  "salt": "base64_encoded_salt"
}
```

Note: Returns a deterministic fake salt for non-existent users to prevent email enumeration.

---

### Register

Create a new account.

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "auth_hash": "base64_hashed_auth_key",
  "salt": "base64_salt",
  "device_name": "MacBook Pro",
  "device_type": "desktop"
}
```

**Response (201):**
```json
{
  "access_token": "jwt_token",
  "refresh_token": "jwt_refresh_token",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified": false,
    "subscription_tier": "free",
    "storage_quota_bytes": 104857600,
    "storage_used_bytes": 0
  },
  "device_id": "uuid"
}
```

---

### Login

Authenticate and get tokens.

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "auth_hash": "base64_hashed_auth_key",
  "device_name": "MacBook Pro",
  "device_type": "desktop"
}
```

**Response (200):**
```json
{
  "access_token": "jwt_token",
  "refresh_token": "jwt_refresh_token",
  "expires_in": 86400,
  "user": { ... },
  "device_id": "uuid"
}
```

---

### Refresh Token

Get a new access token using refresh token.

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "jwt_refresh_token"
}
```

**Response (200):**
```json
{
  "access_token": "new_jwt_token",
  "refresh_token": "new_jwt_refresh_token",
  "expires_in": 86400
}
```

---

### Logout

Revoke the current session.

```http
POST /auth/logout
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Devices

### List Devices

Get all registered devices.

```http
GET /devices
Authorization: Bearer {access_token}
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "MacBook Pro",
    "device_type": "desktop",
    "last_sync_at": 1700000000000,
    "created_at": 1699000000000,
    "is_current": true
  }
]
```

---

### Revoke Device

Sign out a device remotely.

```http
DELETE /devices/{device_id}
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Vaults

### List Vaults

Get all user vaults.

```http
GET /vaults
Authorization: Bearer {access_token}
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "encrypted_name",
    "created_at": 1700000000000,
    "file_count": 42,
    "total_size_bytes": 1234567
  }
]
```

---

### Create Vault

Register a new vault for syncing.

```http
POST /vaults
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "encrypted_vault_name",
  "encrypted_key": "base64_encrypted_vault_key",
  "key_nonce": "base64_nonce"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "encrypted_vault_name",
  "created_at": 1700000000000,
  "file_count": 0,
  "total_size_bytes": 0
}
```

---

### Get Vault

Get vault details.

```http
GET /vaults/{vault_id}
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "encrypted_vault_name",
  "created_at": 1700000000000,
  "file_count": 42,
  "total_size_bytes": 1234567
}
```

---

### Delete Vault

Delete a vault and all its files.

```http
DELETE /vaults/{vault_id}
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "success": true
}
```

---

### Get Vault Key

Retrieve the encrypted vault key.

```http
GET /vaults/{vault_id}/key
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "vault_id": "uuid",
  "encrypted_key": "base64_encrypted_key",
  "key_nonce": "base64_nonce"
}
```

---

### Update Vault Key

Update the vault key (for key rotation).

```http
PUT /vaults/{vault_id}/key
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "encrypted_key": "base64_new_encrypted_key",
  "key_nonce": "base64_new_nonce"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Sync

### Pull Changes

Get remote changes since last sync.

```http
POST /vaults/{vault_id}/sync/pull
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "cursor": "1700000000000_uuid",  // null for first sync
  "limit": 100
}
```

**Response (200):**
```json
{
  "changes": [
    {
      "id": "file_uuid",
      "encrypted_path": "base64_encrypted_path",
      "operation": "update",
      "content_hash": "blake3_hash",
      "size": 1234,
      "modified_at": 1700000000000,
      "version": 3,
      "download_url": "/api/v1/vaults/{vault_id}/files/{file_id}/download"
    }
  ],
  "next_cursor": "1700000000000_uuid",
  "has_more": false
}
```

---

### Push Changes

Upload local changes.

```http
POST /vaults/{vault_id}/sync/push
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "changes": [
    {
      "encrypted_path": "base64_encrypted_path",
      "operation": "update",
      "content_hash": "blake3_hash",
      "size": 5678,
      "modified_at": 1700000000000,
      "base_version": 2
    }
  ]
}
```

**Response (200):**
```json
{
  "results": [
    {
      "encrypted_path": "base64_encrypted_path",
      "status": "accepted",
      "upload_url": "/api/v1/vaults/{vault_id}/files/{file_id}/upload",
      "new_version": 3,
      "file_id": "uuid"
    }
  ],
  "conflicts": []
}
```

---

### Confirm Upload

Confirm file uploads completed.

```http
POST /vaults/{vault_id}/sync/confirm
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "file_ids": ["uuid1", "uuid2"]
}
```

**Response (200):**
```json
{
  "confirmed": ["uuid1", "uuid2"],
  "failed": []
}
```

---

### Get Sync Status

Get vault sync statistics.

```http
GET /vaults/{vault_id}/sync/status
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "file_count": 42,
  "total_size_bytes": 1234567,
  "last_modified": 1700000000000
}
```

---

## Files

### Upload File

Upload encrypted file content.

```http
PUT /vaults/{vault_id}/files/{file_id}/upload
Authorization: Bearer {access_token}
Content-Type: application/octet-stream

{binary encrypted content}
```

**Response (200):**
```json
{
  "success": true,
  "size": 1234
}
```

---

### Download File

Download encrypted file content.

```http
GET /vaults/{vault_id}/files/{file_id}/download
Authorization: Bearer {access_token}
```

**Response (200):**
```
Content-Type: application/octet-stream
X-File-Hash: blake3_hash
X-File-Version: 3

{binary encrypted content}
```

---

### Delete File

Permanently delete a file.

```http
DELETE /vaults/{vault_id}/files/{file_id}
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Account

### Get Account

Get current user info.

```http
GET /account
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "email_verified": true,
  "subscription_tier": "free",
  "storage_quota_bytes": 104857600,
  "storage_used_bytes": 5242880
}
```

---

### Get Usage

Get storage usage statistics.

```http
GET /account/usage
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "storage_used_bytes": 5242880,
  "storage_quota_bytes": 104857600,
  "vault_count": 2
}
```

---

### Delete Account

Delete account and all data.

```http
DELETE /account
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `RATE_LIMITED` | 429 | Too many requests |
| `VAULT_NOT_FOUND` | 404 | Vault doesn't exist or not authorized |
| `FILE_NOT_FOUND` | 404 | File doesn't exist |
| `QUOTA_EXCEEDED` | 403 | Storage quota exceeded |
| `INVALID_JSON` | 400 | Malformed JSON body |
| `MISSING_FIELDS` | 400 | Required fields not provided |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/login` | 5 per minute per IP |
| `/auth/register` | 3 per hour per IP |
| `*/sync/pull` | 60 per minute per vault |
| `*/sync/push` | 30 per minute per vault |
| `*/files/*/upload` | 100 per minute per vault |


