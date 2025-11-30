/**
 * Authentication routes
 */

import type {
  Env,
  User,
  Device,
  Session,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
  SaltResponse,
  UserInfo,
  HttpError
} from '../types'
import {
  generateUUID,
  sha256Base64,
  constantTimeCompare,
  generateToken
} from '../utils/crypto'
import {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  decodeToken,
  getAccessTokenExpiry
} from '../utils/jwt'
import { checkRateLimit } from '../utils/rate-limit'
import { logAudit, getClientIP, getUserAgent } from '../utils/audit'

const JWT_SECRET_DEFAULT = 'echopad-sync-dev-secret-change-in-production'

function getJWTSecret(env: Env): string {
  return env.JWT_SECRET ?? JWT_SECRET_DEFAULT
}

/**
 * Get user salt for login
 */
export async function getSalt(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'Email is required', code: 'MISSING_EMAIL' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Rate limit
  const retryAfter = await checkRateLimit(
    env.DB,
    'login',
    getClientIP(request) ?? 'unknown'
  )
  if (retryAfter > 0) {
    return new Response(
      JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter)
        }
      }
    )
  }

  const user = await env.DB.prepare('SELECT salt FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<{ salt: string }>()

  if (!user) {
    // Return a fake salt to prevent email enumeration
    // This salt is deterministic based on email to be consistent
    const fakeSalt = await sha256Base64(email + 'echopad-fake-salt')
    return new Response(
      JSON.stringify({ salt: fakeSalt } satisfies SaltResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return new Response(
    JSON.stringify({ salt: user.salt } satisfies SaltResponse),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Register a new user
 */
export async function register(request: Request, env: Env): Promise<Response> {
  const ip = getClientIP(request)
  const userAgent = getUserAgent(request)

  // Rate limit
  const retryAfter = await checkRateLimit(env.DB, 'register', ip ?? 'unknown')
  if (retryAfter > 0) {
    return new Response(
      JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter)
        }
      }
    )
  }

  let body: RegisterRequest
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const { email, password } = body

  // Validate input
  if (!email || !password) {
    return new Response(
      JSON.stringify({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ error: 'Invalid email format', code: 'INVALID_EMAIL' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Validate password length
  if (password.length < 8) {
    return new Response(
      JSON.stringify({
        error: 'Password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const emailLower = email.toLowerCase()

  // Check if user already exists
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(emailLower)
    .first()

  if (existing) {
    return new Response(
      JSON.stringify({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const now = Date.now()
  const userId = generateUUID()
  const deviceId = generateUUID()

  // Hash the password (SHA-256 for simplicity)
  const passwordHash = await sha256Base64(password)

  // Generate a simple salt (not used for E2E encryption anymore)
  const salt = generateUUID()

  // Create user
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, salt, created_at, email_verified, subscription_tier, storage_quota_bytes, storage_used_bytes)
       VALUES (?, ?, ?, ?, ?, 0, 'free', 104857600, 0)`
  )
    .bind(userId, emailLower, passwordHash, salt, now)
    .run()

  // Create default device
  const deviceName = 'Browser'
  const deviceType = 'desktop'

  await env.DB.prepare(
    `INSERT INTO devices (id, user_id, device_name, device_type, created_at)
       VALUES (?, ?, ?, ?, ?)`
  )
    .bind(deviceId, userId, deviceName, deviceType, now)
    .run()

  // Generate tokens
  const secret = getJWTSecret(env)
  const accessToken = await createAccessToken(userId, deviceId, secret)
  const { token: refreshToken, expiresAt } = await createRefreshToken(
    userId,
    deviceId,
    secret
  )

  // Store refresh token hash
  const sessionId = generateUUID()
  const tokenHash = await sha256Base64(refreshToken)
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, device_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, userId, deviceId, tokenHash, expiresAt, now)
    .run()

  // Audit log
  await logAudit(env.DB, 'register', {
    userId,
    deviceId,
    details: { email: emailLower },
    ipAddress: ip,
    userAgent
  })

  const userInfo: UserInfo = {
    id: userId,
    email: emailLower,
    email_verified: false,
    subscription_tier: 'free',
    storage_quota_bytes: 104857600,
    storage_used_bytes: 0
  }

  const response: AuthResponse = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: getAccessTokenExpiry(),
    user: userInfo,
    device_id: deviceId
  }

  return new Response(JSON.stringify(response), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Login user
 */
export async function login(request: Request, env: Env): Promise<Response> {
  const ip = getClientIP(request)
  const userAgent = getUserAgent(request)

  // Rate limit
  const retryAfter = await checkRateLimit(env.DB, 'login', ip ?? 'unknown')
  if (retryAfter > 0) {
    return new Response(
      JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter)
        }
      }
    )
  }

  let body: LoginRequest
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const { email, password } = body

  if (!email || !password) {
    return new Response(
      JSON.stringify({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const emailLower = email.toLowerCase()

  // Get user
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(emailLower)
    .first<User>()

  if (!user) {
    await logAudit(env.DB, 'login_failed', {
      details: { email: emailLower, reason: 'user_not_found' },
      ipAddress: ip,
      userAgent
    })

    return new Response(
      JSON.stringify({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Verify password hash
  const passwordHash = await sha256Base64(password)
  if (!constantTimeCompare(passwordHash, user.password_hash)) {
    await logAudit(env.DB, 'login_failed', {
      userId: user.id,
      details: { reason: 'invalid_password' },
      ipAddress: ip,
      userAgent
    })

    return new Response(
      JSON.stringify({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const now = Date.now()
  const deviceId = generateUUID()
  const deviceName = 'Browser'
  const deviceType = 'desktop'

  // Create or update device
  await env.DB.prepare(
    `INSERT INTO devices (id, user_id, device_name, device_type, created_at)
       VALUES (?, ?, ?, ?, ?)`
  )
    .bind(deviceId, user.id, deviceName, deviceType, now)
    .run()

  // Generate tokens
  const secret = getJWTSecret(env)
  const accessToken = await createAccessToken(user.id, deviceId, secret)
  const { token: refreshToken, expiresAt } = await createRefreshToken(
    user.id,
    deviceId,
    secret
  )

  // Store refresh token hash
  const sessionId = generateUUID()
  const tokenHash = await sha256Base64(refreshToken)
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, device_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, user.id, deviceId, tokenHash, expiresAt, now)
    .run()

  // Audit log
  await logAudit(env.DB, 'login', {
    userId: user.id,
    deviceId,
    details: {},
    ipAddress: ip,
    userAgent
  })

  const userInfo: UserInfo = {
    id: user.id,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    subscription_tier: user.subscription_tier,
    storage_quota_bytes: user.storage_quota_bytes,
    storage_used_bytes: user.storage_used_bytes
  }

  const response: AuthResponse = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: getAccessTokenExpiry(),
    user: userInfo,
    device_id: deviceId
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Refresh access token
 */
export async function refresh(request: Request, env: Env): Promise<Response> {
  let body: TokenRefreshRequest
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const { refresh_token } = body

  if (!refresh_token) {
    return new Response(
      JSON.stringify({ error: 'Missing refresh token', code: 'MISSING_TOKEN' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Decode token to get user and device
  const decoded = decodeToken(refresh_token)
  if (!decoded || decoded.type !== 'refresh') {
    return new Response(
      JSON.stringify({ error: 'Invalid refresh token', code: 'INVALID_TOKEN' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Verify token hash exists and is valid
  const tokenHash = await sha256Base64(refresh_token)
  const now = Date.now()

  const session = await env.DB.prepare(
    `SELECT * FROM sessions 
       WHERE token_hash = ? AND user_id = ? AND device_id = ? 
       AND expires_at > ? AND revoked_at IS NULL`
  )
    .bind(tokenHash, decoded.sub, decoded.device_id, now)
    .first<Session>()

  if (!session) {
    return new Response(
      JSON.stringify({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_TOKEN'
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Revoke old token
  await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?')
    .bind(now, session.id)
    .run()

  // Generate new tokens
  const secret = getJWTSecret(env)
  const accessToken = await createAccessToken(
    decoded.sub,
    decoded.device_id,
    secret
  )
  const { token: newRefreshToken, expiresAt } = await createRefreshToken(
    decoded.sub,
    decoded.device_id,
    secret
  )

  // Store new refresh token hash
  const newSessionId = generateUUID()
  const newTokenHash = await sha256Base64(newRefreshToken)
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, device_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newSessionId,
      decoded.sub,
      decoded.device_id,
      newTokenHash,
      expiresAt,
      now
    )
    .run()

  // Update device last sync time
  await env.DB.prepare('UPDATE devices SET last_sync_at = ? WHERE id = ?')
    .bind(now, decoded.device_id)
    .run()

  const response: TokenRefreshResponse = {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    expires_in: getAccessTokenExpiry()
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Logout (revoke refresh token)
 */
export async function logout(
  request: Request,
  env: Env,
  userId: string,
  deviceId: string
): Promise<Response> {
  const now = Date.now()

  // Revoke all sessions for this device
  await env.DB.prepare(
    'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL'
  )
    .bind(now, userId, deviceId)
    .run()

  // Audit log
  await logAudit(env.DB, 'logout', {
    userId,
    deviceId,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
