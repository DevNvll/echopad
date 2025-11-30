/**
 * Echopad Sync API Worker
 *
 * Main entry point for the Cloudflare Worker handling sync operations.
 */

import type { Env, JWTPayload } from './types'
import { verifyToken } from './utils/jwt'

// Auth routes
import { getSalt, register, login, refresh, logout } from './routes/auth'
// Device routes
import { listDevices, revokeDevice } from './routes/devices'
// Vault routes
import {
  listVaults,
  createVault,
  getVault,
  deleteVault,
  getVaultKey,
  putVaultKey
} from './routes/vaults'
// Sync routes
import { pull, push, confirmUpload, getSyncStatus } from './routes/sync'
// File routes
import { uploadFile, downloadFile, deleteFile } from './routes/files'
// Account routes
import { getAccount, getUsage, deleteAccount } from './routes/account'

const JWT_SECRET_DEFAULT = 'echopad-sync-dev-secret-change-in-production'

function getJWTSecret(env: Env): string {
  return env.JWT_SECRET ?? JWT_SECRET_DEFAULT
}

/**
 * CORS headers for responses
 */
function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }
}

/**
 * Handle CORS preflight requests
 */
function handleOptions(request: Request): Response {
  const origin = request.headers.get('Origin')
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin)
  })
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * Verify JWT and extract user info
 */
async function authenticate(
  request: Request,
  env: Env
): Promise<JWTPayload | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  return verifyToken(token, getJWTSecret(env))
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request)
    }

    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      let response: Response

      // ==========================================
      // Public routes (no auth required)
      // ==========================================

      // GET /api/v1/auth/salt
      if (method === 'GET' && path === '/api/v1/auth/salt') {
        response = await getSalt(request, env)
        return addCorsHeaders(response, origin)
      }

      // POST /api/v1/auth/register
      if (method === 'POST' && path === '/api/v1/auth/register') {
        response = await register(request, env)
        return addCorsHeaders(response, origin)
      }

      // POST /api/v1/auth/login
      if (method === 'POST' && path === '/api/v1/auth/login') {
        response = await login(request, env)
        return addCorsHeaders(response, origin)
      }

      // POST /api/v1/auth/refresh
      if (method === 'POST' && path === '/api/v1/auth/refresh') {
        response = await refresh(request, env)
        return addCorsHeaders(response, origin)
      }

      // Health check
      if (method === 'GET' && path === '/health') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ status: 'ok', timestamp: Date.now() }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          ),
          origin
        )
      }

      // ==========================================
      // Protected routes (auth required)
      // ==========================================

      const auth = await authenticate(request, env)
      if (!auth) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            }
          ),
          origin
        )
      }

      const userId = auth.sub
      const deviceId = auth.device_id

      // POST /api/v1/auth/logout
      if (method === 'POST' && path === '/api/v1/auth/logout') {
        response = await logout(request, env, userId, deviceId)
        return addCorsHeaders(response, origin)
      }

      // ==========================================
      // Device routes
      // ==========================================

      // GET /api/v1/devices
      if (method === 'GET' && path === '/api/v1/devices') {
        response = await listDevices(request, env, userId, deviceId)
        return addCorsHeaders(response, origin)
      }

      // DELETE /api/v1/devices/:id
      const deviceMatch = path.match(/^\/api\/v1\/devices\/([^/]+)$/)
      if (method === 'DELETE' && deviceMatch) {
        response = await revokeDevice(
          request,
          env,
          userId,
          deviceId,
          deviceMatch[1]
        )
        return addCorsHeaders(response, origin)
      }

      // ==========================================
      // Vault routes
      // ==========================================

      // GET /api/v1/vaults
      if (method === 'GET' && path === '/api/v1/vaults') {
        response = await listVaults(request, env, userId)
        return addCorsHeaders(response, origin)
      }

      // POST /api/v1/vaults
      if (method === 'POST' && path === '/api/v1/vaults') {
        response = await createVault(request, env, userId, deviceId)
        return addCorsHeaders(response, origin)
      }

      // Vault-specific routes
      const vaultMatch = path.match(/^\/api\/v1\/vaults\/([^/]+)(\/.*)?$/)
      if (vaultMatch) {
        const vaultId = vaultMatch[1]
        const subPath = vaultMatch[2] || ''

        // GET /api/v1/vaults/:id
        if (method === 'GET' && subPath === '') {
          response = await getVault(request, env, userId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // DELETE /api/v1/vaults/:id
        if (method === 'DELETE' && subPath === '') {
          response = await deleteVault(request, env, userId, deviceId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // GET /api/v1/vaults/:id/key
        if (method === 'GET' && subPath === '/key') {
          response = await getVaultKey(request, env, userId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // PUT /api/v1/vaults/:id/key
        if (method === 'PUT' && subPath === '/key') {
          response = await putVaultKey(request, env, userId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // ==========================================
        // Sync routes
        // ==========================================

        // POST /api/v1/vaults/:id/sync/pull
        if (method === 'POST' && subPath === '/sync/pull') {
          response = await pull(request, env, userId, deviceId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // POST /api/v1/vaults/:id/sync/push
        if (method === 'POST' && subPath === '/sync/push') {
          response = await push(request, env, userId, deviceId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // POST /api/v1/vaults/:id/sync/confirm
        if (method === 'POST' && subPath === '/sync/confirm') {
          response = await confirmUpload(request, env, userId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // GET /api/v1/vaults/:id/sync/status
        if (method === 'GET' && subPath === '/sync/status') {
          response = await getSyncStatus(request, env, userId, vaultId)
          return addCorsHeaders(response, origin)
        }

        // ==========================================
        // File routes
        // ==========================================

        const fileMatch = subPath.match(/^\/files\/([^/]+)(\/.*)?$/)
        if (fileMatch) {
          const fileId = fileMatch[1]
          const fileSubPath = fileMatch[2] || ''

          // PUT /api/v1/vaults/:id/files/:fileId/upload
          if (method === 'PUT' && fileSubPath === '/upload') {
            response = await uploadFile(request, env, userId, vaultId, fileId)
            return addCorsHeaders(response, origin)
          }

          // GET /api/v1/vaults/:id/files/:fileId/download
          if (method === 'GET' && fileSubPath === '/download') {
            response = await downloadFile(request, env, userId, vaultId, fileId)
            return addCorsHeaders(response, origin)
          }

          // GET /api/v1/vaults/:id/files/:fileId (same as download)
          if (method === 'GET' && fileSubPath === '') {
            response = await downloadFile(request, env, userId, vaultId, fileId)
            return addCorsHeaders(response, origin)
          }

          // DELETE /api/v1/vaults/:id/files/:fileId
          if (method === 'DELETE' && fileSubPath === '') {
            response = await deleteFile(request, env, userId, vaultId, fileId)
            return addCorsHeaders(response, origin)
          }
        }
      }

      // ==========================================
      // Account routes
      // ==========================================

      // GET /api/v1/account
      if (method === 'GET' && path === '/api/v1/account') {
        response = await getAccount(request, env, userId)
        return addCorsHeaders(response, origin)
      }

      // DELETE /api/v1/account
      if (method === 'DELETE' && path === '/api/v1/account') {
        response = await deleteAccount(request, env, userId)
        return addCorsHeaders(response, origin)
      }

      // GET /api/v1/account/usage
      if (method === 'GET' && path === '/api/v1/account/usage') {
        response = await getUsage(request, env, userId)
        return addCorsHeaders(response, origin)
      }

      // ==========================================
      // 404 - Not Found
      // ==========================================

      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        ),
        origin
      )
    } catch (error) {
      console.error('Unhandled error:', error)

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        ),
        origin
      )
    }
  }
}
