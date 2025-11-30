/**
 * Vault management routes
 */

import type {
  Env,
  Vault,
  VaultInfo,
  VaultKey,
  CreateVaultRequest,
  PutVaultKeyRequest,
  EncryptedVaultKey,
} from '../types';
import { generateUUID } from '../utils/crypto';
import { logAudit, getClientIP, getUserAgent } from '../utils/audit';

/**
 * List all vaults for the authenticated user
 */
export async function listVaults(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const vaults = await env.DB
    .prepare(
      `SELECT v.id, v.name, v.created_at,
              COUNT(vf.id) as file_count,
              COALESCE(SUM(vf.size_bytes), 0) as total_size_bytes
       FROM vaults v
       LEFT JOIN vault_files vf ON v.id = vf.vault_id AND vf.deleted_at IS NULL
       WHERE v.user_id = ? AND v.deleted_at IS NULL
       GROUP BY v.id
       ORDER BY v.created_at DESC`
    )
    .bind(userId)
    .all<Vault & { file_count: number; total_size_bytes: number }>();

  const vaultInfos: VaultInfo[] = (vaults.results ?? []).map(v => ({
    id: v.id,
    name: v.name,
    created_at: v.created_at,
    file_count: v.file_count,
    total_size_bytes: v.total_size_bytes,
  }));

  return new Response(JSON.stringify(vaultInfos), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create a new vault
 */
export async function createVault(
  request: Request,
  env: Env,
  userId: string,
  deviceId: string
): Promise<Response> {
  let body: Partial<CreateVaultRequest>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name, encrypted_key, key_nonce } = body;

  if (!name) {
    return new Response(JSON.stringify({ error: 'Vault name is required', code: 'MISSING_NAME' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  const vaultId = generateUUID();

  // Create vault
  await env.DB
    .prepare(
      `INSERT INTO vaults (id, user_id, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(vaultId, userId, name, now, now)
    .run();

  // Store encrypted vault key if provided (for E2E encryption)
  if (encrypted_key && key_nonce) {
    const keyId = generateUUID();
    await env.DB
      .prepare(
        `INSERT INTO vault_keys (id, vault_id, user_id, encrypted_key, key_nonce, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(keyId, vaultId, userId, encrypted_key, key_nonce, now)
      .run();
  }

  // Audit log
  await logAudit(env.DB, 'vault_create', {
    userId,
    deviceId,
    details: { vault_id: vaultId, name },
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
  });

  const vaultInfo: VaultInfo = {
    id: vaultId,
    name,
    created_at: now,
    file_count: 0,
    total_size_bytes: 0,
  };

  return new Response(JSON.stringify(vaultInfo), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Get vault details
 */
export async function getVault(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string
): Promise<Response> {
  const vault = await env.DB
    .prepare(
      `SELECT v.id, v.name, v.created_at,
              COUNT(vf.id) as file_count,
              COALESCE(SUM(vf.size_bytes), 0) as total_size_bytes
       FROM vaults v
       LEFT JOIN vault_files vf ON v.id = vf.vault_id AND vf.deleted_at IS NULL
       WHERE v.id = ? AND v.user_id = ? AND v.deleted_at IS NULL
       GROUP BY v.id`
    )
    .bind(vaultId, userId)
    .first<Vault & { file_count: number; total_size_bytes: number }>();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const vaultInfo: VaultInfo = {
    id: vault.id,
    name: vault.name,
    created_at: vault.created_at,
    file_count: vault.file_count,
    total_size_bytes: vault.total_size_bytes,
  };

  return new Response(JSON.stringify(vaultInfo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Delete a vault
 */
export async function deleteVault(
  request: Request,
  env: Env,
  userId: string,
  deviceId: string,
  vaultId: string
): Promise<Response> {
  // Check vault exists and belongs to user
  const vault = await env.DB
    .prepare('SELECT * FROM vaults WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(vaultId, userId)
    .first<Vault>();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();

  // Get all files to delete from R2
  const files = await env.DB
    .prepare('SELECT storage_key FROM vault_files WHERE vault_id = ?')
    .bind(vaultId)
    .all<{ storage_key: string }>();

  // Delete files from R2
  for (const file of files.results ?? []) {
    await env.STORAGE.delete(file.storage_key);
  }

  // Soft delete vault and files
  await env.DB.batch([
    env.DB.prepare('UPDATE vaults SET deleted_at = ? WHERE id = ?').bind(now, vaultId),
    env.DB.prepare('UPDATE vault_files SET deleted_at = ? WHERE vault_id = ?').bind(now, vaultId),
  ]);

  // Update user storage
  const totalSize = await env.DB
    .prepare('SELECT SUM(size_bytes) as total FROM vault_files WHERE vault_id = ?')
    .bind(vaultId)
    .first<{ total: number }>();

  if (totalSize?.total) {
    await env.DB
      .prepare('UPDATE users SET storage_used_bytes = storage_used_bytes - ? WHERE id = ?')
      .bind(totalSize.total, userId)
      .run();
  }

  // Audit log
  await logAudit(env.DB, 'vault_delete', {
    userId,
    deviceId,
    details: { vault_id: vaultId, name: vault.name },
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Get encrypted vault key
 */
export async function getVaultKey(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string
): Promise<Response> {
  // Verify vault ownership
  const vault = await env.DB
    .prepare('SELECT id FROM vaults WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(vaultId, userId)
    .first();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = await env.DB
    .prepare('SELECT vault_id, encrypted_key, key_nonce FROM vault_keys WHERE vault_id = ? AND user_id = ?')
    .bind(vaultId, userId)
    .first<VaultKey>();

  if (!key) {
    return new Response(JSON.stringify({ error: 'Vault key not found', code: 'KEY_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response: EncryptedVaultKey = {
    vault_id: key.vault_id,
    encrypted_key: key.encrypted_key,
    key_nonce: key.key_nonce,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Update encrypted vault key (for key rotation)
 */
export async function putVaultKey(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string
): Promise<Response> {
  // Verify vault ownership
  const vault = await env.DB
    .prepare('SELECT id FROM vaults WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(vaultId, userId)
    .first();

  if (!vault) {
    return new Response(JSON.stringify({ error: 'Vault not found', code: 'VAULT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: PutVaultKeyRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { encrypted_key, key_nonce } = body;

  if (!encrypted_key || !key_nonce) {
    return new Response(JSON.stringify({ error: 'Missing required fields', code: 'MISSING_FIELDS' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();

  await env.DB
    .prepare(
      `UPDATE vault_keys SET encrypted_key = ?, key_nonce = ?, rotated_at = ?
       WHERE vault_id = ? AND user_id = ?`
    )
    .bind(encrypted_key, key_nonce, now, vaultId, userId)
    .run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

