import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface GeneralSettingsProps {
  appName: string;
  onAppNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAppNameBlur: () => void;
}

export function GeneralSettings({
  appName,
  onAppNameChange,
  onAppNameBlur,
}: GeneralSettingsProps) {
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
}



