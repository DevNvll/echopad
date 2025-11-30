/**
 * Metadata Fetcher Worker for Cloudflare Workers
 *
 * Fetches Open Graph metadata from a given URL.
 * Includes basic SSRF protection and caching.
 */

export interface Env {}

interface OgMetadataResponse {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      })
    }

    try {
      const body = await request.json<{ url?: string }>()
      const { url } = body

      if (!url) {
        return new Response('Missing url', {
          status: 400,
          headers: corsHeaders
        })
      }

      // Basic SSRF guard
      const u = new URL(url)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return new Response('Invalid protocol', {
          status: 400,
          headers: corsHeaders
        })
      }

      const resp = await fetch(u.toString(), {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; MetadataFetcher/1.0; +https://echopad.app)'
        },
        cf: { cacheEverything: true }
      })

      const html = await resp.text()

      // Extract OG metadata
      const ogTitle = matchOG(html, 'og:title') || matchTitle(html)
      const ogDescription =
        matchOG(html, 'og:description') || matchMetaDescription(html)
      const ogImage = matchOG(html, 'og:image')
      const ogSiteName =
        matchOG(html, 'og:site_name') || u.hostname.replace(/^www\./, '')

      // Extract favicon
      const favicon = matchFavicon(html, u)

      const response: OgMetadataResponse = {
        title: ogTitle,
        description: ogDescription,
        image: ogImage,
        siteName: ogSiteName,
        favicon
      }

      return Response.json(response, {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      })
    } catch (err) {
      console.error('Metadata fetch error:', err)
      return new Response('Error', {
        status: 500,
        headers: corsHeaders
      })
    }
  }
}

/**
 * Extracts Open Graph meta content from HTML
 */
function matchOG(html: string, property: string): string | null {
  // Match both property="og:X" content="Y" and content="Y" property="og:X" patterns
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      'i'
    )
  ]

  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }

  return null
}

/**
 * Extracts title from <title> tag
 */
function matchTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? match[1].trim() : null
}

/**
 * Extracts meta description
 */
function matchMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
  ]

  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }

  return null
}

/**
 * Extracts favicon URL from HTML or defaults to /favicon.ico
 */
function matchFavicon(html: string, baseUrl: URL): string | null {
  // Try to find link rel="icon" or rel="shortcut icon"
  const patterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i
  ]

  for (const re of patterns) {
    const m = html.match(re)
    if (m) {
      const href = m[1]
      // Resolve relative URLs
      if (href.startsWith('http')) {
        return href
      }
      try {
        return new URL(href, baseUrl.origin).toString()
      } catch {
        return href
      }
    }
  }

  // Default to /favicon.ico
  return `${baseUrl.protocol}//${baseUrl.host}/favicon.ico`
}
