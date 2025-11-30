// Cloudflare environment bindings
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ENVIRONMENT: string;
  JWT_SECRET?: string;
}

// ==========================================
// User types
// ==========================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  created_at: number;
  email_verified: boolean;
  subscription_tier: SubscriptionTier;
  storage_quota_bytes: number;
  storage_used_bytes: number;
}

export type SubscriptionTier = 'free' | 'pro' | 'team';

export interface UserInfo {
  id: string;
  email: string;
  email_verified: boolean;
  subscription_tier: SubscriptionTier;
  storage_quota_bytes: number;
  storage_used_bytes: number;
}

// ==========================================
// Device types
// ==========================================

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_type: DeviceType;
  public_key: string | null;
  last_sync_at: number | null;
  created_at: number;
  revoked_at: number | null;
}

export type DeviceType = 'desktop' | 'mobile';

export interface DeviceInfo {
  id: string;
  name: string;
  device_type: DeviceType;
  last_sync_at: number | null;
  created_at: number;
  is_current: boolean;
}

// ==========================================
// Session types
// ==========================================

export interface Session {
  id: string;
  user_id: string;
  device_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
  revoked_at: number | null;
}

// ==========================================
// Auth request/response types
// ==========================================

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserInfo;
  device_id: string;
}

export interface TokenRefreshRequest {
  refresh_token: string;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SaltResponse {
  salt: string;
}

// ==========================================
// Vault types
// ==========================================

export interface Vault {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface VaultInfo {
  id: string;
  name: string;
  created_at: number;
  file_count: number;
  total_size_bytes: number;
}

export interface VaultKey {
  id: string;
  vault_id: string;
  user_id: string;
  encrypted_key: string;
  key_nonce: string;
  created_at: number;
  rotated_at: number | null;
}

export interface CreateVaultRequest {
  name: string;
  encrypted_key: string;
  key_nonce: string;
}

export interface PutVaultKeyRequest {
  encrypted_key: string;
  key_nonce: string;
}

export interface EncryptedVaultKey {
  vault_id: string;
  encrypted_key: string;
  key_nonce: string;
}

// ==========================================
// File types
// ==========================================

export interface VaultFile {
  id: string;
  vault_id: string;
  encrypted_path: string;
  content_hash: string;
  encrypted_content_hash: string;
  size_bytes: number;
  modified_at: number;
  deleted_at: number | null;
  version: number;
  storage_key: string;
  created_at: number;
  updated_at: number;
}

// ==========================================
// Sync types
// ==========================================

export interface PullRequest {
  cursor: string | null;
  limit: number;
}

export interface PullResponse {
  changes: RemoteChange[];
  next_cursor: string;
  has_more: boolean;
}

export interface RemoteChange {
  id: string;
  encrypted_path: string;
  operation: ChangeOperation;
  content_hash: string;
  size: number;
  modified_at: number;
  version: number;
  download_url: string | null;
}

export type ChangeOperation = 'create' | 'update' | 'delete';

export interface PushRequest {
  changes: PushChange[];
}

export interface PushChange {
  encrypted_path: string;
  operation: ChangeOperation;
  content_hash: string;
  size: number;
  modified_at: number;
  base_version: number | null;
}

export interface PushResponse {
  results: PushResult[];
  conflicts: ConflictInfo[];
}

export interface PushResult {
  encrypted_path: string;
  status: 'accepted' | 'conflict' | 'error';
  upload_url: string | null;
  new_version: number | null;
  file_id: string | null;
  error: string | null;
}

export interface ConflictInfo {
  original_path: string;
  conflict_path: string;
  local_modified_at: number;
  remote_modified_at: number;
  created_at: number;
}

export interface ConfirmUploadRequest {
  file_ids: string[];
}

export interface VaultSyncStatusResponse {
  file_count: number;
  total_size_bytes: number;
  last_modified: number | null;
}

// ==========================================
// Account types
// ==========================================

export interface UsageResponse {
  storage_used_bytes: number;
  storage_quota_bytes: number;
  vault_count: number;
}

// ==========================================
// JWT types
// ==========================================

export interface JWTPayload {
  sub: string; // user_id
  device_id: string;
  iat: number;
  exp: number;
  scope: string[];
}

// ==========================================
// Rate limit types
// ==========================================

export interface RateLimitEntry {
  key: string;
  count: number;
  window_start: number;
  expires_at: number;
}

// ==========================================
// Audit log types
// ==========================================

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  device_id: string | null;
  action: AuditAction;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}

export type AuditAction = 
  | 'register'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'token_refresh'
  | 'password_change'
  | 'device_register'
  | 'device_revoke'
  | 'vault_create'
  | 'vault_delete'
  | 'sync_pull'
  | 'sync_push';

// ==========================================
// API Error types
// ==========================================

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({
        error: this.message,
        code: this.code,
        details: this.details,
      } satisfies ApiError),
      {
        status: this.status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

