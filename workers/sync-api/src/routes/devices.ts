/**
 * Device management routes
 */

import type { Env, Device, DeviceInfo } from '../types';
import { logAudit, getClientIP, getUserAgent } from '../utils/audit';

/**
 * List all devices for the authenticated user
 */
export async function listDevices(
  request: Request,
  env: Env,
  userId: string,
  currentDeviceId: string
): Promise<Response> {
  const devices = await env.DB
    .prepare(
      `SELECT id, device_name, device_type, last_sync_at, created_at, revoked_at
       FROM devices 
       WHERE user_id = ? AND revoked_at IS NULL
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<Device>();

  const deviceInfos: DeviceInfo[] = (devices.results ?? []).map(d => ({
    id: d.id,
    name: d.device_name,
    device_type: d.device_type,
    last_sync_at: d.last_sync_at,
    created_at: d.created_at,
    is_current: d.id === currentDeviceId,
  }));

  return new Response(JSON.stringify(deviceInfos), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Revoke a device
 */
export async function revokeDevice(
  request: Request,
  env: Env,
  userId: string,
  currentDeviceId: string,
  targetDeviceId: string
): Promise<Response> {
  // Check if device exists and belongs to user
  const device = await env.DB
    .prepare('SELECT * FROM devices WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(targetDeviceId, userId)
    .first<Device>();

  if (!device) {
    return new Response(JSON.stringify({ error: 'Device not found', code: 'DEVICE_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cannot revoke current device
  if (targetDeviceId === currentDeviceId) {
    return new Response(JSON.stringify({ error: 'Cannot revoke current device', code: 'CANNOT_REVOKE_CURRENT' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();

  // Revoke device
  await env.DB
    .prepare('UPDATE devices SET revoked_at = ? WHERE id = ?')
    .bind(now, targetDeviceId)
    .run();

  // Revoke all sessions for this device
  await env.DB
    .prepare('UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL')
    .bind(now, targetDeviceId)
    .run();

  // Audit log
  await logAudit(env.DB, 'device_revoke', {
    userId,
    deviceId: currentDeviceId,
    details: { revoked_device_id: targetDeviceId, device_name: device.device_name },
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

