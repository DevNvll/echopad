import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'
import type {
  SyncStatus,
  UserInfo,
  AuthResponse,
  VaultSyncStatus,
  ConflictInfo,
  DeviceInfo,
  SyncOperationResult,
  ConflictResolution,
  VaultInfo,
  VaultConnectionInfo,
} from '../types/sync'

const STORAGE_KEY = 'echopad-sync-auth'

interface StoredAuth {
  user: UserInfo | null
  serverUrl: string | null
}

interface SyncState {
  // Auth state
  isLoggedIn: boolean
  user: UserInfo | null
  serverUrl: string | null
  isLoading: boolean
  error: string | null
  isRestoring: boolean

  // Vault sync state
  vaultStatuses: VaultSyncStatus[]
  
  // Remote pending changes per vault (vault_path -> count)
  remotePendingChanges: Record<string, number>
  
  // UI state
  showLoginModal: boolean
  
  // Actions
  login: (email: string, password: string, serverUrl: string) => Promise<void>
  logout: () => Promise<void>
  refreshStatus: () => Promise<void>
  checkRemotePending: (vaultPath: string) => Promise<number>
  enableVaultSync: (vaultPath: string, vaultName: string) => Promise<string>
  disableVaultSync: (vaultPath: string) => Promise<void>
  syncNow: (vaultPath: string) => Promise<SyncOperationResult>
  getConflicts: (vaultPath: string) => Promise<ConflictInfo[]>
  resolveConflict: (vaultPath: string, conflictPath: string, keep: ConflictResolution) => Promise<void>
  getDevices: () => Promise<DeviceInfo[]>
  revokeDevice: (deviceId: string) => Promise<void>
  setShowLoginModal: (show: boolean) => void
  clearError: () => void
  initializeFromStorage: () => void
  restoreSession: () => Promise<void>
  updateLastSyncTime: (vaultPath: string) => void
  listRemoteVaults: () => Promise<VaultInfo[]>
  connectVault: (vaultPath: string, remoteVaultId: string) => Promise<void>
  detectVaultConnection: (vaultPath: string) => Promise<VaultConnectionInfo | null>
  autoReconnectVault: (vaultPath: string) => Promise<boolean>
}

// Helper to save auth to localStorage
function saveAuthToStorage(user: UserInfo | null, serverUrl: string | null) {
  try {
    if (user && serverUrl) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, serverUrl }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch (e) {
    console.error('Failed to save auth to storage:', e)
  }
}

// Helper to load auth from localStorage
function loadAuthFromStorage(): StoredAuth | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load auth from storage:', e)
  }
  return null
}

export const useSyncStore = create<SyncState>((set, get) => ({
  // Initial state
  isLoggedIn: false,
  user: null,
  serverUrl: null,
  isLoading: false,
  error: null,
  isRestoring: false,
  vaultStatuses: [],
  remotePendingChanges: {},
  showLoginModal: false,

  // Initialize from stored auth (legacy - now just restores session)
  initializeFromStorage: () => {
    // Call restoreSession which properly restores from backend
    get().restoreSession()
  },
  
  // Restore session from persisted credentials via backend
  restoreSession: async () => {
    // Don't restore if already logged in or already restoring
    if (get().isLoggedIn || get().isRestoring) {
      return
    }
    
    set({ isRestoring: true })
    
    try {
      interface RestoredSession {
        user: UserInfo
        device_id: string
        server_url: string
      }
      
      const response = await invoke<RestoredSession | null>('sync_restore_session')
      
      if (response) {
        // Session restored successfully
        saveAuthToStorage(response.user, response.server_url)
        set({
          isLoggedIn: true,
          user: response.user,
          serverUrl: response.server_url,
          isRestoring: false,
        })
        // Refresh vault statuses
        await get().refreshStatus()
      } else {
        // No stored session - clear any stale localStorage
        saveAuthToStorage(null, null)
        set({ isRestoring: false })
      }
    } catch (error) {
      console.error('Failed to restore session:', error)
      // Clear stale localStorage on error
      saveAuthToStorage(null, null)
      set({ isRestoring: false })
    }
  },

  // Actions
  login: async (email: string, password: string, serverUrl: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await invoke<AuthResponse>('sync_login', {
        email,
        password,
        serverUrl,
      })
      
      // Save auth to storage
      saveAuthToStorage(response.user, serverUrl)
      
      set({
        isLoggedIn: true,
        user: response.user,
        serverUrl,
        isLoading: false,
        showLoginModal: false,
      })
      // Refresh vault statuses
      await get().refreshStatus()
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await invoke('sync_logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear storage
      saveAuthToStorage(null, null)
      set({
        isLoggedIn: false,
        user: null,
        serverUrl: null,
        vaultStatuses: [],
        isLoading: false,
      })
    }
  },

  refreshStatus: async () => {
    try {
      const status = await invoke<SyncStatus>('sync_get_status')
      set({
        isLoggedIn: status.is_logged_in,
        user: status.user ?? get().user,
        vaultStatuses: status.vaults,
        error: status.last_error,
      })
      
      // Check remote pending for enabled vaults
      for (const vault of status.vaults) {
        if (vault.enabled) {
          // Fire and forget - don't block on this
          get().checkRemotePending(vault.vault_path).catch(() => {})
        }
      }
    } catch (error) {
      console.error('Failed to refresh sync status:', error)
    }
  },

  checkRemotePending: async (vaultPath: string) => {
    try {
      const count = await invoke<number>('sync_check_remote_pending', { vaultPath })
      set((state) => ({
        remotePendingChanges: {
          ...state.remotePendingChanges,
          [vaultPath]: count,
        },
      }))
      return count
    } catch (error) {
      console.error('Failed to check remote pending:', error)
      return 0
    }
  },

  enableVaultSync: async (vaultPath: string, vaultName: string) => {
    set({ isLoading: true })
    try {
      const vaultId = await invoke<string>('sync_enable_vault', {
        vaultPath,
        vaultName,
      })
      await get().refreshStatus()
      set({ isLoading: false })
      return vaultId
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  disableVaultSync: async (vaultPath: string) => {
    try {
      await invoke('sync_disable_vault', { vaultPath })
      await get().refreshStatus()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  syncNow: async (vaultPath: string) => {
    try {
      const result = await invoke<SyncOperationResult>('sync_now', { vaultPath })
      
      // Update last sync time locally
      get().updateLastSyncTime(vaultPath)
      
      // Clear remote pending count since we just synced
      set((state) => ({
        remotePendingChanges: {
          ...state.remotePendingChanges,
          [vaultPath]: 0,
        },
      }))
      
      await get().refreshStatus()
      
      // Dispatch event to trigger UI refresh if files were downloaded or uploaded
      if (result.files_downloaded > 0 || result.files_uploaded > 0 || result.files_deleted > 0) {
        window.dispatchEvent(new CustomEvent('sync-completed', { 
          detail: { 
            vaultPath,
            filesDownloaded: result.files_downloaded,
            filesUploaded: result.files_uploaded,
            filesDeleted: result.files_deleted
          } 
        }))
      }
      
      return result
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  updateLastSyncTime: (vaultPath: string) => {
    const vaultStatuses = get().vaultStatuses.map(v => {
      if (v.vault_path === vaultPath) {
        return { ...v, last_sync_at: Date.now() }
      }
      return v
    })
    set({ vaultStatuses })
  },

  getConflicts: async (vaultPath: string) => {
    try {
      return await invoke<ConflictInfo[]>('sync_get_conflicts', { vaultPath })
    } catch (error) {
      console.error('Failed to get conflicts:', error)
      return []
    }
  },

  resolveConflict: async (vaultPath: string, conflictPath: string, keep: ConflictResolution) => {
    try {
      await invoke('sync_resolve_conflict', {
        vaultPath,
        conflictPath,
        keep,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  getDevices: async () => {
    try {
      return await invoke<DeviceInfo[]>('sync_get_devices')
    } catch (error) {
      console.error('Failed to get devices:', error)
      return []
    }
  },

  revokeDevice: async (deviceId: string) => {
    try {
      await invoke('sync_revoke_device', { deviceId })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  setShowLoginModal: (show: boolean) => {
    set({ showLoginModal: show })
  },

  clearError: () => {
    set({ error: null })
  },

  listRemoteVaults: async () => {
    try {
      return await invoke<VaultInfo[]>('sync_list_remote_vaults')
    } catch (error) {
      console.error('Failed to list remote vaults:', error)
      return []
    }
  },

  connectVault: async (vaultPath: string, remoteVaultId: string) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('sync_connect_vault', { vaultPath, remoteVaultId })
      await get().refreshStatus()
      set({ isLoading: false })
      
      // Dispatch event to trigger UI refresh since files were likely downloaded
      window.dispatchEvent(new CustomEvent('sync-completed', { 
        detail: { 
          vaultPath,
          filesDownloaded: 1, // Indicate that files may have been downloaded
          filesUploaded: 0,
          filesDeleted: 0
        } 
      }))
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  detectVaultConnection: async (vaultPath: string) => {
    try {
      const info = await invoke<VaultConnectionInfo | null>('sync_detect_vault_connection', { vaultPath })
      return info
    } catch (error) {
      console.error('Failed to detect vault connection:', error)
      return null
    }
  },

  autoReconnectVault: async (vaultPath: string) => {
    try {
      const reconnected = await invoke<boolean>('sync_auto_reconnect_vault', { vaultPath })
      if (reconnected) {
        console.log('[Sync] Auto-reconnected vault:', vaultPath)
        await get().refreshStatus()
      }
      return reconnected
    } catch (error) {
      console.error('Failed to auto-reconnect vault:', error)
      return false
    }
  },
}))
