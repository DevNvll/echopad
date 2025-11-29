import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getAppSettings, saveAppSettings } from '../api';
import { AppSettings } from '../types';

interface ThemeContextValue {
  settings: AppSettings;
  updateAccentColor: (color: string) => Promise<void>;
  updateAppName: (name: string) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: AppSettings = {
  appName: 'Lazuli',
  accentColor: '#818cf8',
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  initialSettings?: AppSettings;
}

export function ThemeProvider({ children, initialSettings }: ThemeProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings || defaultSettings);
  const [isLoading, setIsLoading] = useState(false);

  const applyAccentColor = useCallback((color: string) => {
    document.documentElement.style.setProperty('--accent-color', color);
  }, []);

  React.useEffect(() => {
    applyAccentColor(settings.accentColor);
  }, [settings.accentColor, applyAccentColor]);

  const updateAccentColor = useCallback(async (color: string) => {
    setIsLoading(true);
    try {
      await saveAppSettings({ accentColor: color });
      setSettings(prev => ({ ...prev, accentColor: color }));
      applyAccentColor(color);
    } finally {
      setIsLoading(false);
    }
  }, [applyAccentColor]);

  const updateAppName = useCallback(async (name: string) => {
    setIsLoading(true);
    try {
      await saveAppSettings({ appName: name });
      setSettings(prev => ({ ...prev, appName: name }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, updateAccentColor, updateAppName, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export async function loadInitialSettings(): Promise<AppSettings> {
  try {
    return await getAppSettings();
  } catch {
    return defaultSettings;
  }
}

