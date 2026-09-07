import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchItems,
  saveItem,
  setItemCompleted,
  deleteItem,
  reorderItems
} from '@/lib/queries/items'
import type { Item } from '@/types/database.types'

export function itemsKey(from: string, to: string) {
  return ['items', from, to] as const
}

export function useItems(from: string, to: string) {
  return useQuery({ queryKey: itemsKey(from, to), queryFn: () => fetchItems(from, to) })
}

export function useSaveItem(from: string, to: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey(from, to) })
  })
}

export function useDeleteItem(from: string, to: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey(from, to) })
  })
}

/**
 * El tilde es la interacción más usada del checklist, así que se aplica
 * optimista: esperar el round trip para ver el tilde se siente roto. Si el
 * servidor rechaza, onError deja la lista como estaba.
 */
export function useToggleItem(from: string, to: string) {
  const queryClient = useQueryClient()
  const key = itemsKey(from, to)

  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      setItemCompleted(id, completed),

    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)
      queryClient.setQueryData<Item[]>(key, (old) =>
        (old ?? []).map((it) => (it.id === id ? { ...it, completed } : it))
      )
      return { previous }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: key })
  })
}

/** Mismo criterio optimista que el tilde: el reordenamiento no puede titilar. */
export function useReorderItems(from: string, to: string) {
  const queryClient = useQueryClient()
  const key = itemsKey(from, to)

  return useMutation({
    mutationFn: reorderItems,
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)
      if (previous) {
        const porId = new Map(previous.map((i) => [i.id, i]))
        queryClient.setQueryData<Item[]>(
          key,
          ids.map((id) => porId.get(id)).filter((i): i is Item => Boolean(i))
        )
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key })
  })
}
