import { FolderOpen, Plus, Trash2, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { KnownVault } from '@/api';

interface StorageSettingsProps {
  vaultPath: string | null;
  knownVaults: KnownVault[];
  onAddVault: () => void;
  onSwitchVault: (path: string) => void;
  onRemoveVault: (path: string) => void;
}

export function StorageSettings({
  vaultPath,
  knownVaults,
  onAddVault,
  onSwitchVault,
  onRemoveVault,
}: StorageSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">Storage</h3>
        <p className="text-xs text-textMuted">Manage where your notes are stored</p>
      </div>
      <Separator className="bg-border/50" />
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-textMain">Your Vaults</Label>
          <button
            onClick={onAddVault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand hover:bg-brand/90 text-white rounded-md transition-colors"
          >
            <Plus size={14} />
            Add Vault
          </button>
        </div>
        
        <div className="space-y-2">
          {knownVaults.length === 0 ? (
            <div className="p-4 text-center text-sm text-textMuted border border-dashed border-border rounded-lg">
              No vaults found. Add a vault to get started.
            </div>
          ) : (
            knownVaults.map((vault) => (
              <VaultItem
                key={vault.path}
                vault={vault}
                isActive={vault.path === vaultPath}
                onSwitch={() => onSwitchVault(vault.path)}
                onRemove={() => onRemoveVault(vault.path)}
              />
            ))
          )}
        </div>
        
        <p className="text-xs text-textMuted">
          Removing a vault from this list does not delete any files. It only removes it from your quick access list.
        </p>
      </div>
    </div>
  );
}

interface VaultItemProps {
  vault: KnownVault;
  isActive: boolean;
  onSwitch: () => void;
  onRemove: () => void;
}

function VaultItem({ vault, isActive, onSwitch, onRemove }: VaultItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors group",
        isActive
          ? "bg-brand/10 border-brand/30"
          : "bg-surface border-border hover:border-border/80"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        isActive
          ? "bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30"
          : "bg-surfaceHighlight border border-border"
      )}>
        <FolderOpen size={18} className={isActive ? "text-brand" : "text-textMuted"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-textMain truncate">{vault.name}</span>
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-brand bg-brand/20 px-1.5 py-0.5 rounded">
              <Check size={10} />
              Active
            </span>
          )}
        </div>
        <div className="text-xs text-textMuted truncate">{vault.path}</div>
      </div>
      {!isActive && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onSwitch}
            className="px-3 py-1.5 text-xs font-medium bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMain rounded transition-colors"
          >
            Switch
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-textMuted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
            title="Remove from list"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

