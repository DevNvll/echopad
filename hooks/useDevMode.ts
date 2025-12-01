import { useState, useEffect, useCallback } from 'react'

const DEV_MODE_KEY = 'echopad-dev-mode'

// Konami Code: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA'
]

function getStoredDevMode(): boolean {
  try {
    return localStorage.getItem(DEV_MODE_KEY) === 'true'
  } catch {
    return false
  }
}

function setStoredDevMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DEV_MODE_KEY, 'true')
    } else {
      localStorage.removeItem(DEV_MODE_KEY)
    }
  } catch (e) {
    console.error('Failed to store dev mode:', e)
  }
}

export function useDevMode() {
  const [isDevMode, setIsDevMode] = useState(getStoredDevMode)
  const [konamiIndex, setKonamiIndex] = useState(0)

  const enableDevMode = useCallback(() => {
    setIsDevMode(true)
    setStoredDevMode(true)
  }, [])

  const disableDevMode = useCallback(() => {
    setIsDevMode(false)
    setStoredDevMode(false)
  }, [])

  const toggleDevMode = useCallback(() => {
    setIsDevMode((prev) => {
      const newValue = !prev
      setStoredDevMode(newValue)
      return newValue
    })
  }, [])

  // Listen for Konami code
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const expectedKey = KONAMI_CODE[konamiIndex]
      
      if (e.code === expectedKey) {
        const nextIndex = konamiIndex + 1
        
        if (nextIndex === KONAMI_CODE.length) {
          // Konami code completed!
          enableDevMode()
          setKonamiIndex(0)
          // Visual/audio feedback could be added here
          console.log('🎮 Developer mode activated!')
        } else {
          setKonamiIndex(nextIndex)
        }
      } else {
        // Reset if wrong key
        setKonamiIndex(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [konamiIndex, enableDevMode])

  // Reset Konami index after a timeout (if user stops mid-sequence)
  useEffect(() => {
    if (konamiIndex > 0) {
      const timeout = setTimeout(() => setKonamiIndex(0), 2000)
      return () => clearTimeout(timeout)
    }
  }, [konamiIndex])

  return {
    isDevMode,
    enableDevMode,
    disableDevMode,
    toggleDevMode
  }
}

