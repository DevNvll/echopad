/**
 * File upload/download routes
 */

import type { Env, Vault, VaultFile } from '../types';
import { checkRateLimit } from '../utils/rate-limit';
import { getClientIP } from '../utils/audit';

/**
 * Upload file content
 */
export async function uploadFile(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string,
  fileId: string
): Promise<Response> {
  const ip = getClientIP(request);

  // Rate limit
  const retryAfter = await checkRateLimit(env.DB, 'file_upload', `${userId}:${vaultId}`);
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

  // Get file record
  const file = await env.DB
    .prepare('SELECT * FROM vault_files WHERE id = ? AND vault_id = ?')
    .bind(fileId, vaultId)
    .first<VaultFile>();

  if (!file) {
    return new Response(JSON.stringify({ error: 'File not found', code: 'FILE_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get request body
  const body = await request.arrayBuffer();

  if (body.byteLength === 0) {
    return new Response(JSON.stringify({ error: 'Empty file content', code: 'EMPTY_CONTENT' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Upload to R2
  await env.STORAGE.put(file.storage_key, body, {
    customMetadata: {
      vault_id: vaultId,
      file_id: fileId,
      uploaded_at: Date.now().toString(),
    },
  });

  // Update encrypted content hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', body);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const encryptedContentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  await env.DB
    .prepare('UPDATE vault_files SET encrypted_content_hash = ?, size_bytes = ? WHERE id = ?')
    .bind(encryptedContentHash, body.byteLength, fileId)
    .run();

  return new Response(JSON.stringify({ success: true, size: body.byteLength }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Download file content
 */
export async function downloadFile(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string,
  fileId: string
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

  // Get file record
  const file = await env.DB
    .prepare('SELECT * FROM vault_files WHERE id = ? AND vault_id = ? AND deleted_at IS NULL')
    .bind(fileId, vaultId)
    .first<VaultFile>();

  if (!file) {
    return new Response(JSON.stringify({ error: 'File not found', code: 'FILE_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get from R2
  const object = await env.STORAGE.get(file.storage_key);

  if (!object) {
    return new Response(JSON.stringify({ error: 'File content not found', code: 'CONTENT_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(object.size),
      'X-File-Hash': file.content_hash,
      'X-File-Version': String(file.version),
    },
  });
}

/**
 * Delete a file
 */
export async function deleteFile(
  request: Request,
  env: Env,
  userId: string,
  vaultId: string,
  fileId: string
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

  // Get file record
  const file = await env.DB
    .prepare('SELECT * FROM vault_files WHERE id = ? AND vault_id = ?')
    .bind(fileId, vaultId)
    .first<VaultFile>();

  if (!file) {
    return new Response(JSON.stringify({ error: 'File not found', code: 'FILE_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete from R2
  await env.STORAGE.delete(file.storage_key);

  // Hard delete from database
  await env.DB
    .prepare('DELETE FROM vault_files WHERE id = ?')
    .bind(fileId)
    .run();

  // Update user storage
  await env.DB
    .prepare('UPDATE users SET storage_used_bytes = storage_used_bytes - ? WHERE id = ?')
    .bind(file.size_bytes, userId)
    .run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}



