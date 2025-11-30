// Sync-related TypeScript types

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserInfo;
  device_id: string;
}

export interface UserInfo {
  id: string;
  email: string;
  email_verified: boolean;
  subscription_tier: SubscriptionTier;
  storage_quota_bytes: number;
  storage_used_bytes: number;
}

export type SubscriptionTier = 'free' | 'pro' | 'team';

export interface SyncStatus {
  is_logged_in: boolean;
  user: UserInfo | null;
  vaults: VaultSyncStatus[];
  last_error: string | null;
}

export interface VaultSyncStatus {
  vault_path: string;
  vault_id: string | null;
  enabled: boolean;
  status: VaultSyncState;
  last_sync_at: number | null;
  pending_changes: number;
}

export type VaultSyncState = 'idle' | 'syncing' | 'error' | 'disabled';

export interface SyncOperationResult {
  success: boolean;
  files_uploaded: number;
  files_downloaded: number;
  files_deleted: number;
  conflicts: ConflictInfo[];
  errors: string[];
  duration_ms: number;
}

export interface ConflictInfo {
  original_path: string;
  conflict_path: string;
  local_modified_at: number;
  remote_modified_at: number;
  created_at: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  device_type: DeviceType;
  last_sync_at: number | null;
  created_at: number;
  is_current: boolean;
}

export type DeviceType = 'desktop' | 'mobile';

export type ConflictResolution = 'local' | 'remote' | 'both';

export interface VaultInfo {
  id: string;
  name: string;
  created_at: number;
  file_count: number;
  total_size_bytes: number;
}

