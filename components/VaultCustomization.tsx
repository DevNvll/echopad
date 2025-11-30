import { useState } from 'react'
import { cn } from '@/lib/utils'
import { IconPicker, getIconByName } from './IconPicker'
import { Label } from '@/components/ui/label'

const PRESET_COLORS = [
  { name: 'Indigo', value: '#818cf8' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Teal', value: '#2dd4bf' },
  { name: 'Emerald', value: '#34d399' },
  { name: 'Lime', value: '#a3e635' },
  { name: 'Yellow', value: '#facc15' },
  { name: 'Orange', value: '#fb923c' },
  { name: 'Rose', value: '#fb7185' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Fuchsia', value: '#e879f9' },
]

interface VaultCustomizationProps {
  vaultName: string
  onComplete: (icon: string, accentColor: string) => void
  onSkip: () => void
}

export function VaultCustomization({ vaultName, onComplete, onSkip }: VaultCustomizationProps) {
  const [selectedIcon, setSelectedIcon] = useState('FolderOpen')
  const [selectedColor, setSelectedColor] = useState('#818cf8')

  const IconComponent = getIconByName(selectedIcon)

  return (
    <div className="max-w-lg w-full mx-4 bg-surface border border-border rounded-2xl p-8 shadow-2xl">
      <div className="flex flex-col items-center text-center gap-6">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center border transition-colors"
          style={{
            background: `linear-gradient(135deg, ${selectedColor}33, ${selectedColor}11)`,
            borderColor: `${selectedColor}33`
          }}
        >
          <IconComponent size={40} style={{ color: selectedColor }} />
        </div>

        <div>
          <h1 className="text-xl font-bold mb-2">Customize Your Vault</h1>
          <p className="text-textMuted text-sm">
            Give <span className="font-medium text-textMain">{vaultName}</span> a unique look
          </p>
        </div>

        <div className="w-full space-y-6 text-left">
          <div className="space-y-3">
            <Label className="text-sm text-textMain">Icon</Label>
            <IconPicker
              selectedIcon={selectedIcon}
              onSelectIcon={setSelectedIcon}
              accentColor={selectedColor}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm text-textMain">Accent Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setSelectedColor(preset.value)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all border-2',
                    selectedColor.toLowerCase() === preset.value.toLowerCase()
                      ? 'border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="w-full flex gap-3 pt-2">
          <button
            onClick={onSkip}
            className="flex-1 py-3 px-4 rounded-lg font-medium text-textMuted hover:text-textMain hover:bg-surfaceHighlight transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => onComplete(selectedIcon, selectedColor)}
            className="flex-1 py-3 px-4 rounded-lg font-medium text-white transition-colors"
            style={{ backgroundColor: selectedColor }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}


