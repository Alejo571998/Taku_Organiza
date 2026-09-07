import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTabs, saveTab, deleteTab, reorderTabs } from '@/lib/queries/tabs'
import type { TabWithFields } from '@/lib/queries/tabs'

export function useTabs() {
  return useQuery({ queryKey: ['tabs'], queryFn: fetchTabs })
}

export function useSaveTab() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveTab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] })
    }
  })
}

export function useDeleteTab() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] })
    }
  })
}

/**
 * Reordenar tiene que verse instantáneo: si la lista espera al servidor,
 * la pestaña vuelve a su lugar por un instante y parece que falló.
 */
export function useReorderTabs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reorderTabs,
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['tabs'] })
      const previous = queryClient.getQueryData<TabWithFields[]>(['tabs'])
      if (previous) {
        const porId = new Map(previous.map((t) => [t.id, t]))
        queryClient.setQueryData<TabWithFields[]>(
          ['tabs'],
          ids.map((id) => porId.get(id)).filter((t): t is TabWithFields => Boolean(t))
        )
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['tabs'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tabs'] })
  })
}
