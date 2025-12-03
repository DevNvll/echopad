import { create } from 'zustand'
import { AppSettings } from '../types'
import {
  getVaultPath,
  setVaultPath,
  getAppSettings,
  getVaultAccentColor,
  addKnownVault,
  getSetting,
  saveSetting
} from '../api'

interface VaultState {
  vaultPath: string | null
  isVaultSetupOpen: boolean
  appSettings: AppSettings | null
  isInitialized: boolean

  initialize: () => Promise<void>
  selectVault: (path: string) => Promise<void>
  switchVault: (path: string) => Promise<void>
  openVaultSetup: () => void
  closeVaultSetup: () => void
}

const defaultSettings: AppSettings = {
  appName: 'Lazuli',
  accentColor: '#818cf8'
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  isVaultSetupOpen: false,
  appSettings: null,
  isInitialized: false,

  initialize: async () => {
    const vault = await getVaultPath()
    const globalSettings = await getAppSettings()

    let accentColor = globalSettings.accentColor
    if (vault) {
      const vaultColor = await getVaultAccentColor(vault)
      if (vaultColor) {
        accentColor = vaultColor
      }
    }

    const settings = { ...globalSettings, accentColor }
    document.documentElement.style.setProperty('--accent-color', accentColor)

    if (vault) {
      await addKnownVault(vault)
      set({
        vaultPath: vault,
        appSettings: settings,
        isInitialized: true,
        isVaultSetupOpen: false
      })
    } else {
      set({
        vaultPath: null,
        appSettings: settings,
        isInitialized: true,
        isVaultSetupOpen: true
      })
    }
  },

  selectVault: async (path: string) => {
    await setVaultPath(path)
    await addKnownVault(path)
    set({
      vaultPath: path,
      isVaultSetupOpen: false
    })
  },

  switchVault: async (path: string) => {
    await setVaultPath(path)
    set({ vaultPath: path })
    window.location.reload()
  },

  openVaultSetup: () => set({ isVaultSetupOpen: true }),
  closeVaultSetup: () => set({ isVaultSetupOpen: false })
}))




