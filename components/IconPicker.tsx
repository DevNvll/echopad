import { cn } from '@/lib/utils'
import {
  FolderOpen,
  Folder,
  Archive,
  Book,
  BookOpen,
  Briefcase,
  FileText,
  Files,
  Inbox,
  Library,
  Notebook,
  ScrollText,
  Star,
  Heart,
  Gem,
  Crown,
  Rocket,
  Zap,
  Flame,
  Sparkles,
  Moon,
  Sun,
  Cloud,
  Coffee,
  Music,
  Camera,
  Palette,
  Code,
  Terminal,
  Database,
  type LucideIcon
} from 'lucide-react'

export const VAULT_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'FolderOpen', icon: FolderOpen },
  { name: 'Folder', icon: Folder },
  { name: 'Archive', icon: Archive },
  { name: 'Book', icon: Book },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'FileText', icon: FileText },
  { name: 'Files', icon: Files },
  { name: 'Inbox', icon: Inbox },
  { name: 'Library', icon: Library },
  { name: 'Notebook', icon: Notebook },
  { name: 'ScrollText', icon: ScrollText },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Gem', icon: Gem },
  { name: 'Crown', icon: Crown },
  { name: 'Rocket', icon: Rocket },
  { name: 'Zap', icon: Zap },
  { name: 'Flame', icon: Flame },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Moon', icon: Moon },
  { name: 'Sun', icon: Sun },
  { name: 'Cloud', icon: Cloud },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Camera', icon: Camera },
  { name: 'Palette', icon: Palette },
  { name: 'Code', icon: Code },
  { name: 'Terminal', icon: Terminal },
  { name: 'Database', icon: Database },
]

export function getIconByName(name: string): LucideIcon {
  const found = VAULT_ICONS.find(i => i.name === name)
  return found?.icon ?? FolderOpen
}

interface IconPickerProps {
  selectedIcon: string
  onSelectIcon: (iconName: string) => void
  accentColor?: string
}

export function IconPicker({ selectedIcon, onSelectIcon, accentColor }: IconPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {VAULT_ICONS.map(({ name, icon: Icon }) => {
        const isSelected = selectedIcon === name
        return (
          <button
            key={name}
            onClick={() => onSelectIcon(name)}
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-all border-2',
              isSelected
                ? 'border-brand bg-brand/20 scale-110'
                : 'border-transparent bg-surfaceHighlight/50 hover:bg-surfaceHighlight hover:scale-105'
            )}
            style={isSelected && accentColor ? { borderColor: accentColor, backgroundColor: `${accentColor}20` } : undefined}
            title={name}
          >
            <Icon
              size={20}
              className={cn(
                isSelected ? 'text-brand' : 'text-textMuted'
              )}
              style={isSelected && accentColor ? { color: accentColor } : undefined}
            />
          </button>
        )
      })}
    </div>
  )
}




