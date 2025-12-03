/**
 * JWT utilities using Web Crypto API
 */

import type { JWTPayload } from '../types';

const ALGORITHM = 'HS256';
const ACCESS_TOKEN_EXPIRY = 24 * 60 * 60; // 24 hours
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days

/**
 * Base64URL encode
 */
function base64UrlEncode(data: string | Uint8Array): string {
  const str = typeof data === 'string' 
    ? btoa(data) 
    : btoa(String.fromCharCode(...data));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

/**
 * Get HMAC key for signing
 */
async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Sign data with HMAC-SHA256
 */
async function sign(data: string, secret: string): Promise<string> {
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature
 */
async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();
  
  // Decode signature from base64url
  const sigStr = base64UrlDecode(signature);
  const sigBytes = new Uint8Array(sigStr.length);
  for (let i = 0; i < sigStr.length; i++) {
    sigBytes[i] = sigStr.charCodeAt(i);
  }
  
  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    encoder.encode(data)
  );
}

/**
 * Create a JWT access token
 */
export async function createAccessToken(
  userId: string,
  deviceId: string,
  secret: string,
  scopes: string[] = ['sync:read', 'sync:write']
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: ALGORITHM,
    typ: 'JWT',
  };
  
  const payload: JWTPayload = {
    sub: userId,
    device_id: deviceId,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
    scope: scopes,
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;
  
  const signature = await sign(dataToSign, secret);
  
  return `${dataToSign}.${signature}`;
}

/**
 * Create a refresh token
 */
export async function createRefreshToken(
  userId: string,
  deviceId: string,
  secret: string
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + REFRESH_TOKEN_EXPIRY;
  
  const header = {
    alg: ALGORITHM,
    typ: 'JWT',
  };
  
  const payload = {
    sub: userId,
    device_id: deviceId,
    type: 'refresh',
    iat: now,
    exp: expiresAt,
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;
  
  const signature = await sign(dataToSign, secret);
  
  return {
    token: `${dataToSign}.${signature}`,
    expiresAt: expiresAt * 1000, // Convert to milliseconds
  };
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const [headerB64, payloadB64, signature] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;
    
    const isValid = await verify(dataToVerify, signature, secret);
    if (!isValid) {
      return null;
    }
    
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT without verification (for getting refresh token data)
 */
export function decodeToken(token: string): { sub: string; device_id: string; type?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get token expiry time in seconds
 */
export function getAccessTokenExpiry(): number {
  return ACCESS_TOKEN_EXPIRY;
}



