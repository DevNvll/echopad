import { HexColorPicker, HexColorInput } from 'react-colorful';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { IconPicker, getIconByName } from '@/components/IconPicker';

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
];

interface AppearanceSettingsProps {
  accentColor: string;
  vaultIcon: string;
  showColorPicker: boolean;
  onToggleColorPicker: () => void;
  onColorSelect: (color: string) => void;
  onIconSelect: (icon: string) => void;
  onApplyToAllVaults: (color: string) => void;
  vaultName: string | null;
}

export function AppearanceSettings({
  accentColor,
  vaultIcon,
  showColorPicker,
  onToggleColorPicker,
  onColorSelect,
  onIconSelect,
  onApplyToAllVaults,
  vaultName,
}: AppearanceSettingsProps) {
  const CurrentIcon = getIconByName(vaultIcon);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">Appearance</h3>
        <p className="text-xs text-textMuted">Customize how the app looks</p>
      </div>
      <Separator className="bg-border/50" />
      
      {vaultName && (
        <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center border"
            style={{
              background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)`,
              borderColor: `${accentColor}33`
            }}
          >
            <CurrentIcon size={20} style={{ color: accentColor }} />
          </div>
          <p className="text-xs text-textMuted">
            Theme settings will be applied to <span className="font-medium text-brand">{vaultName}</span>
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="text-sm text-textMain">Vault Icon</Label>
          <IconPicker
            selectedIcon={vaultIcon}
            onSelectIcon={onIconSelect}
            accentColor={accentColor}
          />
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="space-y-3">
          <Label className="text-sm text-textMain">Accent Color</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => onColorSelect(preset.value)}
                className={cn(
                  "w-8 h-8 rounded-full transition-all border-2",
                  accentColor.toLowerCase() === preset.value.toLowerCase()
                    ? "border-white scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
          <div className="pt-2">
            <button
              onClick={onToggleColorPicker}
              className="text-xs text-textMuted hover:text-brand transition-colors"
            >
              {showColorPicker ? 'Hide custom color picker' : 'Pick a custom color'}
            </button>
            {showColorPicker && (
              <div className="mt-3 space-y-3">
                <HexColorPicker
                  color={accentColor}
                  onChange={onColorSelect}
                  style={{ width: '100%', height: '160px' }}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-textMuted uppercase">Hex</span>
                  <div className="flex items-center bg-surface border border-border rounded-md overflow-hidden">
                    <span className="px-2 text-xs text-textMuted">#</span>
                    <HexColorInput
                      color={accentColor}
                      onChange={onColorSelect}
                      prefixed={false}
                      className="w-20 bg-transparent border-none px-1 py-1.5 text-sm text-textMain focus:outline-none"
                    />
                  </div>
                  <div
                    className="w-8 h-8 rounded-md border border-border"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <Separator className="bg-border/50" />
        
        <div className="space-y-2">
          <button
            onClick={() => onApplyToAllVaults(accentColor)}
            className="px-4 py-2 text-sm font-medium bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMain rounded-md transition-colors"
          >
            Apply to all vaults
          </button>
          <p className="text-xs text-textMuted">
            Set the current accent color for all your vaults
          </p>
        </div>
      </div>
    </div>
  );
}
