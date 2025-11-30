import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getKnownVaults, getVaultIcon, saveVaultIcon, KnownVault } from '../api'

export const vaultKeys = {
  all: ['vaults'] as const,
  list: () => [...vaultKeys.all, 'list'] as const,
  icons: () => [...vaultKeys.all, 'icons'] as const,
  icon: (path: string) => [...vaultKeys.icons(), path] as const,
}

export function useKnownVaults() {
  return useQuery({
    queryKey: vaultKeys.list(),
    queryFn: getKnownVaults,
  })
}

export function useVaultIcons(vaults: KnownVault[] | undefined) {
  return useQuery({
    queryKey: vaultKeys.icons(),
    queryFn: async () => {
      if (!vaults) return {}
      const icons: Record<string, string> = {}
      for (const vault of vaults) {
        const icon = await getVaultIcon(vault.path)
        icons[vault.path] = icon || 'FolderOpen'
      }
      return icons
    },
    enabled: !!vaults && vaults.length > 0,
  })
}

export function useVaultIcon(vaultPath: string | null) {
  return useQuery({
    queryKey: vaultKeys.icon(vaultPath || ''),
    queryFn: async () => {
      if (!vaultPath) return 'FolderOpen'
      const icon = await getVaultIcon(vaultPath)
      return icon || 'FolderOpen'
    },
    enabled: !!vaultPath,
  })
}

export function useSaveVaultIcon() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ vaultPath, icon }: { vaultPath: string; icon: string }) => {
      await saveVaultIcon(vaultPath, icon)
      return { vaultPath, icon }
    },
    onSuccess: ({ vaultPath, icon }) => {
      queryClient.setQueryData(vaultKeys.icon(vaultPath), icon)
      queryClient.setQueryData<Record<string, string>>(vaultKeys.icons(), (old) => {
        if (!old) return { [vaultPath]: icon }
        return { ...old, [vaultPath]: icon }
      })
    },
  })
}

