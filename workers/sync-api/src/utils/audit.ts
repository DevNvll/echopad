/**
 * Audit logging utilities
 */

import type { AuditAction } from '../types';
import { generateUUID } from './crypto';

/**
 * Log an audit event
 */
export async function logAudit(
  db: D1Database,
  action: AuditAction,
  options: {
    userId?: string | null;
    deviceId?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  } = {}
): Promise<void> {
  const id = generateUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO audit_log (id, user_id, device_id, action, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      options.userId ?? null,
      options.deviceId ?? null,
      action,
      options.details ? JSON.stringify(options.details) : null,
      options.ipAddress ?? null,
      options.userAgent ?? null,
      now
    )
    .run();
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string | null {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    null
  );
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('User-Agent');
}

