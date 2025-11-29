import React, { useEffect, useState } from 'react'
import { readFile } from '@tauri-apps/plugin-fs'

const imageCache = new Map<string, string>()

interface NoteImageProps {
  src: string
  alt?: string
  vaultPath: string
}

export const NoteImage: React.FC<NoteImageProps> = React.memo(
  ({ src, alt, vaultPath }) => {
    const cacheKey = `${vaultPath}/${src}`
    const [dataUrl, setDataUrl] = useState<string | null>(
      () => imageCache.get(cacheKey) || null
    )
    const [error, setError] = useState(false)

    useEffect(() => {
      if (imageCache.has(cacheKey)) {
        setDataUrl(imageCache.get(cacheKey)!)
        return
      }

      const loadImage = async () => {
        try {
          const normalizedVault = vaultPath.replace(/\\/g, '/')
          const normalizedSrc = src.replace(/\\/g, '/')
          const fullPath = `${normalizedVault}/${normalizedSrc}`

          const contents = await readFile(fullPath)
          const base64 = btoa(
            new Uint8Array(contents).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ''
            )
          )

          const ext = src.split('.').pop()?.toLowerCase() || 'png'
          const mimeType =
            ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'png'
              ? 'image/png'
              : ext === 'gif'
              ? 'image/gif'
              : ext === 'webp'
              ? 'image/webp'
              : 'image/png'

          const url = `data:${mimeType};base64,${base64}`
          imageCache.set(cacheKey, url)
          setDataUrl(url)
        } catch (err) {
          console.error('Failed to load image:', err)
          setError(true)
        }
      }

      loadImage()
    }, [src, vaultPath, cacheKey])

    if (error) {
      return (
        <div className="my-2 p-3 bg-surfaceHighlight/50 border border-border/50 rounded-lg text-textMuted text-sm">
          Failed to load image: {src}
        </div>
      )
    }

    if (!dataUrl) {
      return (
        <div className="my-2 h-32 bg-surfaceHighlight/30 border border-border/30 rounded-lg animate-pulse" />
      )
    }

    return (
      <img
        src={dataUrl}
        alt={alt || ''}
        className="max-w-full h-auto rounded-lg my-2 border border-border/30"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }
)
