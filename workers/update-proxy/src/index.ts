/**
 * Echopad Update Proxy for Cloudflare Workers
 *
 * This proxy allows Tauri's updater to fetch release assets from a private GitHub repository.
 * It authenticates with GitHub using a Personal Access Token stored in Worker secrets.
 *
 * Required secrets:
 * - GITHUB_TOKEN: GitHub Personal Access Token with `repo` scope
 *
 * Environment variables (set in wrangler.toml):
 * - GITHUB_OWNER: Repository owner (e.g., "DevNvll")
 * - GITHUB_REPO: Repository name (e.g., "echopad")
 */

interface Env {
  GITHUB_TOKEN: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
}

interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  published_at: string
  assets: GitHubAsset[]
}

interface GitHubAsset {
  id: number
  name: string
  browser_download_url: string
  size: number
  content_type: string
}

interface TauriUpdateManifest {
  version: string
  notes: string
  pub_date: string
  platforms: Record<string, TauriPlatformInfo>
}

interface TauriPlatformInfo {
  signature: string
  url: string
}

// Platform mapping for Tauri update manifest
const PLATFORM_MAPPINGS: Record<
  string,
  { extension: string; sigExtension: string }
> = {
  'darwin-aarch64': {
    extension: '.app.tar.gz',
    sigExtension: '.app.tar.gz.sig'
  },
  'darwin-x86_64': {
    extension: '.app.tar.gz',
    sigExtension: '.app.tar.gz.sig'
  },
  'linux-x86_64': {
    extension: '.AppImage.tar.gz',
    sigExtension: '.AppImage.tar.gz.sig'
  },
  'windows-x86_64': { extension: '.nsis.zip', sigExtension: '.nsis.zip.sig' }
}

// Architecture-specific file patterns
const ARCH_PATTERNS: Record<string, string[]> = {
  'darwin-aarch64': ['aarch64', 'arm64'],
  'darwin-x86_64': ['x86_64', 'x64', 'intel'],
  'linux-x86_64': ['amd64', 'x86_64', 'x64'],
  'windows-x86_64': ['x64', 'x86_64', 'amd64']
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // Route: GET /latest.json - Tauri update manifest
      if (path === '/latest.json' || path === '/') {
        return await handleUpdateManifest(request, env, corsHeaders)
      }

      // Route: GET /download/:assetName - Download specific asset
      if (path.startsWith('/download/')) {
        const assetName = decodeURIComponent(path.replace('/download/', ''))
        return await handleAssetDownload(assetName, env, corsHeaders)
      }

      // Route: GET /releases/latest - Raw latest release info
      if (path === '/releases/latest') {
        return await handleLatestRelease(env, corsHeaders)
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Proxy error:', error)
      const message =
        error instanceof Error ? error.message : 'Internal server error'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}

/**
 * Fetches the latest release from GitHub
 */
async function fetchLatestRelease(env: Env): Promise<GitHubRelease> {
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/releases/latest`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Echopad-Update-Proxy/1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GitHub API error: ${response.status} - ${text}`)
  }

  return response.json()
}

/**
 * Finds the appropriate asset for a platform
 */
function findAssetForPlatform(
  assets: GitHubAsset[],
  platform: string,
  isSignature: boolean
): GitHubAsset | undefined {
  const mapping = PLATFORM_MAPPINGS[platform]
  if (!mapping) return undefined

  const extension = isSignature ? mapping.sigExtension : mapping.extension
  const archPatterns = ARCH_PATTERNS[platform] || []

  // Find asset matching the platform
  return assets.find((asset) => {
    const name = asset.name.toLowerCase()

    // Must match extension
    if (!name.endsWith(extension.toLowerCase())) return false

    // For macOS, check architecture in filename
    if (platform.startsWith('darwin-')) {
      return archPatterns.some((pattern) =>
        name.includes(pattern.toLowerCase())
      )
    }

    // For other platforms, the extension match is usually sufficient
    return true
  })
}

/**
 * Generates the Tauri update manifest
 */
async function handleUpdateManifest(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const release = await fetchLatestRelease(env)
  const baseUrl = new URL(request.url).origin

  // Extract version from tag (remove 'v' prefix if present)
  const version = release.tag_name.replace(/^v/, '')

  const manifest: TauriUpdateManifest = {
    version,
    notes: release.body || '',
    pub_date: release.published_at,
    platforms: {}
  }

  // Build platform entries
  for (const platform of Object.keys(PLATFORM_MAPPINGS)) {
    const asset = findAssetForPlatform(release.assets, platform, false)
    const sigAsset = findAssetForPlatform(release.assets, platform, true)

    if (asset && sigAsset) {
      // Fetch the signature content
      const sigResponse = await fetch(
        `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/releases/assets/${sigAsset.id}`,
        {
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: 'application/octet-stream',
            'User-Agent': 'Echopad-Update-Proxy/1.0',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      )

      if (sigResponse.ok) {
        const signature = await sigResponse.text()
        manifest.platforms[platform] = {
          signature: signature.trim(),
          url: `${baseUrl}/download/${encodeURIComponent(asset.name)}`
        }
      }
    }
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    }
  })
}

/**
 * Proxies asset downloads from GitHub releases
 */
async function handleAssetDownload(
  assetName: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const release = await fetchLatestRelease(env)

  const asset = release.assets.find((a) => a.name === assetName)
  if (!asset) {
    return new Response('Asset not found', {
      status: 404,
      headers: corsHeaders
    })
  }

  // Fetch the asset from GitHub
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/releases/assets/${asset.id}`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/octet-stream',
        'User-Agent': 'Echopad-Update-Proxy/1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to download asset: ${response.status} - ${text}`)
  }

  // Stream the response back to the client
  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': asset.content_type || 'application/octet-stream',
      'Content-Length': asset.size.toString(),
      'Content-Disposition': `attachment; filename="${asset.name}"`
    }
  })
}

/**
 * Returns raw latest release info (for debugging)
 */
async function handleLatestRelease(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const release = await fetchLatestRelease(env)

  return new Response(JSON.stringify(release, null, 2), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

