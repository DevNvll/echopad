import { create } from 'zustand'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error'

interface UpdaterState {
  status: UpdateStatus
  progress: number
  error: string | null
  version: string | null
  releaseNotes: string | null
  update: Update | null
}

interface UpdaterActions {
  checkForUpdates: () => Promise<void>
  downloadAndInstall: () => Promise<void>
  reset: () => void
}

const initialState: UpdaterState = {
  status: 'idle',
  progress: 0,
  error: null,
  version: null,
  releaseNotes: null,
  update: null
}

export const useUpdaterStore = create<UpdaterState & UpdaterActions>(
  (set, get) => ({
    ...initialState,

    checkForUpdates: async () => {
      set({ status: 'checking', error: null, progress: 0 })

      try {
        const update = await check()

        if (update) {
          set({
            status: 'available',
            version: update.version,
            releaseNotes: update.body ?? null,
            update
          })
        } else {
          set({ status: 'not-available' })
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to check for updates'
        set({ status: 'error', error: errorMessage })
      }
    },

    downloadAndInstall: async () => {
      const { update } = get()
      if (!update) return

      set({ status: 'downloading', progress: 0 })

      try {
        let downloaded = 0
        let contentLength = 0

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength ?? 0
              break
            case 'Progress':
              downloaded += event.data.chunkLength
              if (contentLength > 0) {
                const progress = Math.round((downloaded / contentLength) * 100)
                set({ progress })
              }
              break
            case 'Finished':
              set({ status: 'ready', progress: 100 })
              break
          }
        })

        // Relaunch the app to apply the update
        await relaunch()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to download update'
        set({ status: 'error', error: errorMessage })
      }
    },

    reset: () => set(initialState)
  })
)


