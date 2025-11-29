import { Separator } from '@/components/ui/separator';

interface AboutSettingsProps {
  appName: string;
}

export function AboutSettings({ appName }: AboutSettingsProps) {
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
}

