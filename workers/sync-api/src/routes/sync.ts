/**
 * Sync routes for pull/push operations
 */

import type {
  Env,
  Vault,
  VaultFile,
  User,
  PullRequest,
  PullResponse,
  RemoteChange,
  PushRequest,
  PushResponse,
  PushResult,
  PushChange,
  ConfirmUploadRequest,
  VaultSyncStatusResponse,
  ChangeOperation,
} from '../types';
import { generateUUID } from '../utils/crypto';
import { checkRateLimit } from '../utils/rate-limit';
import { logAudit, getClientIP, getUserAgent } from '../utils/audit';

const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Generate cursor from timestamp and ID
 */
function generateCursor(updatedAt: number, id: string): string {
  return `${updatedAt}_${id}`;
}

/**
 * Parse cursor into timestamp and ID
 */
function parseCursor(cursor: string): { updatedAt: number; id: string } | null {
  const parts = cursor.split('_');
  if (parts.length !== 2) return null;
  const updatedAt = parseInt(parts[0], 10);
  if (isNaN(updatedAt)) return null;
  return { updatedAt, id: parts[1] };
}

/**
 * Pull remote changes
 */
export async function pull(
  request: Request,
  env: Env,
  userId: string,
  deviceId: string,
  vaultId: string
): Promise<Response> {
  const ip = getClientIP(request);

  // Rate limit
  const retryAfter = await checkRateLimit(env.DB, 'sync_pull', `${userId}:${vaultId}`);
  if (retryAfter > 0) {
    return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    });
  }

  // Verify vault ownership
  const vault = await env.DB
    .prepare('SELECT id FROM vaults WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(vaultId, userId)
    .first<Vault>();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: PullRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { cursor, limit = 100 } = body;
  const effectiveLimit = Math.min(limit, 500);

  let query: string;
  let params: unknown[];

  if (cursor) {
    const parsed = parseCursor(cursor);
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Invalid cursor', code: 'INVALID_CURSOR' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get changes after cursor (using updated_at and id for pagination)
    query = `
      SELECT * FROM vault_files 
      WHERE vault_id = ? AND (updated_at > ? OR (updated_at = ? AND id > ?))
      ORDER BY updated_at ASC, id ASC
      LIMIT ?
    `;
    params = [vaultId, parsed.updatedAt, parsed.updatedAt, parsed.id, effectiveLimit + 1];
  } else {
    // Get all files
    query = `
      SELECT * FROM vault_files 
      WHERE vault_id = ?
      ORDER BY updated_at ASC, id ASC
      LIMIT ?
    `;
    params = [vaultId, effectiveLimit + 1];
  }

  const files = await env.DB
    .prepare(query)
    .bind(...params)
    .all<VaultFile>();

  const results = files.results ?? [];
  const hasMore = results.length > effectiveLimit;
  const pageFiles = hasMore ? results.slice(0, effectiveLimit) : results;

  // Generate presigned URLs for downloads and filter out incomplete files
  const changesWithStatus = await Promise.all(
    pageFiles.map(async (file) => {
      let downloadUrl: string | null = null;
      let hasContent = true;
      
      if (!file.deleted_at) {
        // Check if file content exists in R2 storage
        const object = await env.STORAGE.head(file.storage_key);
        if (object) {
          // For R2, we use a custom download endpoint instead of presigned URLs
          downloadUrl = `/api/v1/vaults/${vaultId}/files/${file.id}/download`;
        } else {
          // File record exists but content is missing from R2
          // This can happen if push was interrupted after creating the DB record
          // but before the file was uploaded
          console.warn(`[Sync] File ${file.id} (${file.encrypted_path}) has no content in R2 storage - skipping`);
          hasContent = false;
        }
      }

      const operation: ChangeOperation = file.deleted_at ? 'delete' : 
        (cursor ? 'update' : 'create');

      return {
        change: {
          id: file.id,
          encrypted_path: file.encrypted_path,
          operation,
          content_hash: file.content_hash,
          size: file.size_bytes,
          modified_at: file.modified_at,
          version: file.version,
          download_url: downloadUrl,
        },
        hasContent,
        isDeleted: !!file.deleted_at,
      };
    })
  );

  // Filter out files that don't have content (but include deleted files)
  const changes: RemoteChange[] = changesWithStatus
    .filter(item => item.hasContent || item.isDeleted)
    .map(item => item.change);

  // Generate next cursor
  const lastFile = pageFiles[pageFiles.length - 1];
  const nextCursor = lastFile 
    ? generateCursor(lastFile.updated_at, lastFile.id)
    : cursor ?? '';

  // Audit log
  await logAudit(env.DB, 'sync_pull', {
    userId,
    deviceId,
    details: { vault_id: vaultId, changes_count: changes.length },
    ipAddress: ip,
    userAgent: getUserAgent(request),
  });

  const response: PullResponse = {
    changes,
    next_cursor: nextCursor,
    has_more: hasMore,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Push local changes
 */
export async function push(
  request: Request,
  env: Env,
  userId: string,
  deviceId: string,
  vaultId: string
): Promise<Response> {
  const ip = getClientIP(request);

  // Rate limit
  const retryAfter = await checkRateLimit(env.DB, 'sync_push', `${userId}:${vaultId}`);
  if (retryAfter > 0) {
    return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    });
  }

  // Verify vault ownership
  const vault = await env.DB
    .prepare('SELECT id FROM vaults WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(vaultId, userId)
    .first<Vault>();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get user for storage quota check
  const user = await env.DB
    .prepare('SELECT storage_quota_bytes, storage_used_bytes FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: PushRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { changes } = body;

  if (!changes || !Array.isArray(changes)) {
    return new Response(JSON.stringify({ error: 'Invalid changes', code: 'INVALID_CHANGES' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: PushResult[] = [];
  const conflicts: any[] = [];
  const now = Date.now();

  // Calculate total size change
  let sizeChange = 0;

  for (const change of changes) {
    const result = await processChange(env, vaultId, deviceId, change, now, user);
    results.push(result);
    
    if (result.status === 'accepted' && change.operation !== 'delete') {
      sizeChange += change.size;
    }
  }

  // Update user storage
  if (sizeChange !== 0) {
    await env.DB
      .prepare('UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?')
      .bind(sizeChange, userId)
      .run();
  }

  // Audit log
  await logAudit(env.DB, 'sync_push', {
    userId,
    deviceId,
    details: { 
      vault_id: vaultId, 
      changes_count: changes.length,
      accepted: results.filter(r => r.status === 'accepted').length,
      conflicts: results.filter(r => r.status === 'conflict').length,
    },
    ipAddress: ip,
    userAgent: getUserAgent(request),
  });

  const response: PushResponse = {
    results,
    conflicts,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function processChange(
  env: Env,
  vaultId: string,
  deviceId: string,
  change: PushChange,
  now: number,
  user: User
): Promise<PushResult> {
  const { encrypted_path, operation, content_hash, size, modified_at, base_version } = change;

  // Check for existing file with same path
  const existing = await env.DB
    .prepare('SELECT * FROM vault_files WHERE vault_id = ? AND encrypted_path = ?')
    .bind(vaultId, encrypted_path)
    .first<VaultFile>();

  // Handle delete operation
  if (operation === 'delete') {
    if (!existing) {
      return {
        encrypted_path,
        status: 'accepted',
        upload_url: null,
        new_version: null,
        file_id: null,
        error: null,
      };
    }

    // Soft delete
    await env.DB
      .prepare('UPDATE vault_files SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, existing.id)
      .run();

    // Delete from R2
    await env.STORAGE.delete(existing.storage_key);

    return {
      encrypted_path,
      status: 'accepted',
      upload_url: null,
      new_version: existing.version + 1,
      file_id: existing.id,
      error: null,
    };
  }

  // Handle create/update
  if (existing) {
    // Check if file content exists in R2 storage
    const r2Object = await env.STORAGE.head(existing.storage_key);
    const hasR2Content = !!r2Object;

    // Check for conflict
    if (base_version !== null && base_version !== existing.version) {
      // Content hash match means no actual conflict
      if (content_hash === existing.content_hash) {
        if (hasR2Content) {
          // Content exists, no need to re-upload
          return {
            encrypted_path,
            status: 'accepted',
            upload_url: null,
            new_version: existing.version,
            file_id: existing.id,
            error: null,
          };
        }
        // Content missing from R2 - need to allow upload, fall through
      } else {
        // Real conflict - different content hashes
        return {
          encrypted_path,
          status: 'conflict',
          upload_url: null,
          new_version: null,
          file_id: existing.id,
          error: `Version conflict: expected ${base_version}, found ${existing.version}`,
        };
      }
    }

    // If content exists in R2 and hashes match, no need to re-upload
    if (hasR2Content && content_hash === existing.content_hash) {
      return {
        encrypted_path,
        status: 'accepted',
        upload_url: null,
        new_version: existing.version,
        file_id: existing.id,
        error: null,
      };
    }

    // Check storage quota
    const sizeDiff = size - existing.size_bytes;
    if (sizeDiff > 0 && user.storage_used_bytes + sizeDiff > user.storage_quota_bytes) {
      return {
        encrypted_path,
        status: 'error',
        upload_url: null,
        new_version: null,
        file_id: null,
        error: 'Storage quota exceeded',
      };
    }

    // Update existing file
    const newVersion = existing.version + 1;
    const storageKey = `vaults/${vaultId}/${existing.id}`;

    await env.DB
      .prepare(
        `UPDATE vault_files 
         SET content_hash = ?, size_bytes = ?, modified_at = ?, version = ?, updated_at = ?, deleted_at = NULL
         WHERE id = ?`
      )
      .bind(content_hash, size, modified_at, newVersion, now, existing.id)
      .run();

    // Generate upload URL (using custom endpoint)
    const uploadUrl = `/api/v1/vaults/${vaultId}/files/${existing.id}/upload`;

    return {
      encrypted_path,
      status: 'accepted',
      upload_url: uploadUrl,
      new_version: newVersion,
      file_id: existing.id,
      error: null,
    };
  }

  // Create new file
  // Check storage quota
  if (user.storage_used_bytes + size > user.storage_quota_bytes) {
    return {
      encrypted_path,
      status: 'error',
      upload_url: null,
      new_version: null,
      file_id: null,
      error: 'Storage quota exceeded',
    };
  }

  const fileId = generateUUID();
  const storageKey = `vaults/${vaultId}/${fileId}`;

  await env.DB
    .prepare(
      `INSERT INTO vault_files 
       (id, vault_id, encrypted_path, content_hash, encrypted_content_hash, size_bytes, modified_at, version, storage_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .bind(fileId, vaultId, encrypted_path, content_hash, '', size, modified_at, storageKey, now, now)
    .run();

  // Generate upload URL
  const uploadUrl = `/api/v1/vaults/${vaultId}/files/${fileId}/upload`;

  return {
    encrypted_path,
    status: 'accepted',
    upload_url: uploadUrl,
    new_version: 1,
    file_id: fileId,
    error: null,
  };
}

/**
 * Confirm upload completion
 */
export async function confirmUpload(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string
): Promise<Response> {
  // Verify vault ownership
  const vault = await env.DB
    .prepare('SELECT id FROM vaults WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(vaultId, userId)
    .first<Vault>();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: ConfirmUploadRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { file_ids } = body;

  if (!file_ids || !Array.isArray(file_ids)) {
    return new Response(JSON.stringify({ error: 'Invalid file_ids', code: 'INVALID_FILE_IDS' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify all files exist and have been uploaded
  const confirmed: string[] = [];
  const failed: string[] = [];

  for (const fileId of file_ids) {
    const file = await env.DB
      .prepare('SELECT storage_key FROM vault_files WHERE id = ? AND vault_id = ?')
      .bind(fileId, vaultId)
      .first<VaultFile>();

    if (!file) {
      failed.push(fileId);
      continue;
    }

    // Check if file exists in R2
    const object = await env.STORAGE.head(file.storage_key);
    if (object) {
      confirmed.push(fileId);
    } else {
      failed.push(fileId);
    }
  }

  return new Response(JSON.stringify({ confirmed, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Get sync status for a vault
 */
export async function getSyncStatus(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string
): Promise<Response> {
  // Verify vault ownership
  const vault = await env.DB
    .prepare('SELECT id FROM vaults WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(vaultId, userId)
    .first<Vault>();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stats = await env.DB
    .prepare(
      `SELECT COUNT(*) as file_count, 
              COALESCE(SUM(size_bytes), 0) as total_size_bytes,
              MAX(modified_at) as last_modified
       FROM vault_files 
       WHERE vault_id = ? AND deleted_at IS NULL`
    )
    .bind(vaultId)
    .first<{ file_count: number; total_size_bytes: number; last_modified: number | null }>();

  const response: VaultSyncStatusResponse = {
    file_count: stats?.file_count ?? 0,
    total_size_bytes: stats?.total_size_bytes ?? 0,
    last_modified: stats?.last_modified ?? null,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

