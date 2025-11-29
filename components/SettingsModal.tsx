import React, { useState, useCallback } from 'react';
import { Settings, Palette, Info, X } from 'lucide-react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

type SettingsSection = 'general' | 'appearance' | 'about';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

const NAV_ITEMS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Settings size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateAccentColor, updateAppName } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [localAppName, setLocalAppName] = useState(settings.appName);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleAppNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalAppName(e.target.value);
  }, []);

  const handleAppNameBlur = useCallback(() => {
    if (localAppName.trim() && localAppName !== settings.appName) {
      updateAppName(localAppName.trim());
    }
  }, [localAppName, settings.appName, updateAppName]);

  const handleColorSelect = useCallback((color: string) => {
    updateAccentColor(color);
  }, [updateAccentColor]);

  React.useEffect(() => {
    if (isOpen) {
      setLocalAppName(settings.appName);
    }
  }, [isOpen, settings.appName]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-4xl p-0 gap-0 bg-[#0a0a0a] border-border overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-3 border-b border-border/50 flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold">Settings</DialogTitle>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-textMuted hover:text-textMain hover:bg-surfaceHighlight transition-colors"
          >
            <X size={16} />
          </button>
        </DialogHeader>

        <div className="flex min-h-[500px]">
          <nav className="w-44 border-r border-border/50 p-2 flex flex-col gap-0.5 bg-[#050505]">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  activeSection === item.id
                    ? "bg-brand/20 text-brand"
                    : "text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 p-6 overflow-y-auto">
            {activeSection === 'general' && (
              <GeneralSettings
                appName={localAppName}
                onAppNameChange={handleAppNameChange}
                onAppNameBlur={handleAppNameBlur}
              />
            )}
            {activeSection === 'appearance' && (
              <AppearanceSettings
                accentColor={settings.accentColor}
                showColorPicker={showColorPicker}
                onToggleColorPicker={() => setShowColorPicker(!showColorPicker)}
                onColorSelect={handleColorSelect}
              />
            )}
            {activeSection === 'about' && <AboutSettings appName={settings.appName} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface GeneralSettingsProps {
  appName: string;
  onAppNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAppNameBlur: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  appName,
  onAppNameChange,
  onAppNameBlur,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">General Settings</h3>
        <p className="text-xs text-textMuted">Configure basic app settings</p>
      </div>
      <Separator className="bg-border/50" />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="appName" className="text-sm text-textMain">
            App Name
          </Label>
          <Input
            id="appName"
            value={appName}
            onChange={onAppNameChange}
            onBlur={onAppNameBlur}
            placeholder="Enter app name"
            className="bg-surface border-border focus:border-brand/50 text-textMain placeholder:text-textMuted/50"
          />
          <p className="text-xs text-textMuted">
            This name will be displayed in the app interface
          </p>
        </div>
      </div>
    </div>
  );
};

interface AppearanceSettingsProps {
  accentColor: string;
  showColorPicker: boolean;
  onToggleColorPicker: () => void;
  onColorSelect: (color: string) => void;
}

const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  accentColor,
  showColorPicker,
  onToggleColorPicker,
  onColorSelect,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">Appearance</h3>
        <p className="text-xs text-textMuted">Customize how the app looks</p>
      </div>
      <Separator className="bg-border/50" />
      <div className="space-y-4">
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
      </div>
    </div>
  );
};

interface AboutSettingsProps {
  appName: string;
}

const AboutSettings: React.FC<AboutSettingsProps> = ({ appName }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">About</h3>
        <p className="text-xs text-textMuted">Information about the app</p>
      </div>
      <Separator className="bg-border/50" />
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-brand">
              {appName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h4 className="font-semibold text-textMain">{appName}</h4>
            <p className="text-xs text-textMuted">Version 1.0.0</p>
          </div>
        </div>
        <p className="text-sm text-textMuted leading-relaxed">
          A modern note-taking app with a Discord-inspired interface. 
          Organize your thoughts with notebooks, tags, and powerful search.
        </p>
        <div className="pt-2 text-xs text-textMuted/70">
          Built with Tauri + React
        </div>
      </div>
    </div>
  );
};

