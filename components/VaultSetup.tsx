import { FolderOpen } from 'lucide-react'
import { AppSettings } from '../types'
import { TitleBar } from './TitleBar'
import { ThemeProvider } from '../contexts/ThemeContext'

interface VaultSetupProps {
  appSettings: AppSettings
  onSelectVault: () => void
  onOpenCommandPalette: () => void
}

export function VaultSetup({
  appSettings,
  onSelectVault,
  onOpenCommandPalette
}: VaultSetupProps) {
  return (
    <ThemeProvider initialSettings={appSettings} vaultPath={null}>
      <div className="h-screen w-screen bg-transparent font-sans text-textMain">
        <div className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background">
          <TitleBar onOpenCommandPalette={onOpenCommandPalette} />
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full mx-4 bg-surface border border-border rounded-2xl p-8 shadow-2xl">
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-brand" />
                </div>
                <div>
                  <h1 className="text-xl font-bold mb-2">
                    Welcome to {appSettings.appName}
                  </h1>
                  <p className="text-textMuted text-sm">
                    To get started, select or create a folder where your notes
                    will be stored. This will be your vault - all notebooks and
                    notes will live here.
                  </p>
                </div>
                <button
                  onClick={onSelectVault}
                  className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Select Vault Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

