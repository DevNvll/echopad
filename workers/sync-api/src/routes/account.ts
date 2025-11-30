/**
 * Account management routes
 */

import type { Env, User, UserInfo, UsageResponse } from '../types';

/**
 * Get account information
 */
export async function getAccount(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const user = await env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userInfo: UserInfo = {
    id: user.id,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    subscription_tier: user.subscription_tier,
    storage_quota_bytes: user.storage_quota_bytes,
    storage_used_bytes: user.storage_used_bytes,
  };

  return new Response(JSON.stringify(userInfo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Get storage usage
 */
export async function getUsage(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const user = await env.DB
    .prepare('SELECT storage_used_bytes, storage_quota_bytes FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const vaultCount = await env.DB
    .prepare('SELECT COUNT(*) as count FROM vaults WHERE user_id = ? AND deleted_at IS NULL')
    .bind(userId)
    .first<{ count: number }>();

  const response: UsageResponse = {
    storage_used_bytes: user.storage_used_bytes,
    storage_quota_bytes: user.storage_quota_bytes,
    vault_count: vaultCount?.count ?? 0,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Delete account and all data
 */
export async function deleteAccount(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  // Get all vaults to delete files from R2
  const vaults = await env.DB
    .prepare('SELECT id FROM vaults WHERE user_id = ?')
    .bind(userId)
    .all<{ id: string }>();

  // Delete all files from R2
  for (const vault of vaults.results ?? []) {
    const files = await env.DB
      .prepare('SELECT storage_key FROM vault_files WHERE vault_id = ?')
      .bind(vault.id)
      .all<{ storage_key: string }>();

    for (const file of files.results ?? []) {
      await env.STORAGE.delete(file.storage_key);
    }
  }

  // Delete all user data (cascading deletes should handle related records)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM vault_files WHERE vault_id IN (SELECT id FROM vaults WHERE user_id = ?)').bind(userId),
    env.DB.prepare('DELETE FROM vault_keys WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM vaults WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

