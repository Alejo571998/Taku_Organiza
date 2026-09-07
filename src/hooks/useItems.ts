import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import {
  fetchItems,
  fetchItemsByTab,
  saveItem,
  setItemCompleted,
  deleteItem,
  reorderItems,
  createRecurringItems,
  deleteItemSeries
} from '@/lib/queries/items'
import type { Item } from '@/types/database.types'

/** Ítems de un rango de fechas (día, semana, mes, gastos). */
export function itemsKey(from: string, to: string): QueryKey {
  return ['items', 'rango', from, to]
}

/** Ítems de una pestaña, sin importar la fecha. */
export function itemsByTabKey(tabId: string): QueryKey {
  return ['items', 'pestana', tabId]
}

export function useItems(from: string, to: string) {
  return useQuery({ queryKey: itemsKey(from, to), queryFn: () => fetchItems(from, to) })
}

export function useItemsByTab(tabId: string) {
  return useQuery({ queryKey: itemsByTabKey(tabId), queryFn: () => fetchItemsByTab(tabId) })
}

/**
 * Guardar y borrar invalidan TODA la familia ['items'] y no una clave puntual:
 * al editar se puede cambiar la fecha o la pestaña de un ítem, así que la lista
 * de la que sale y la lista a la que entra son distintas, y acertarle a las dos
 * a mano es la clase de cosa que se desincroniza en silencio.
 */
export function useSaveItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] })
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] })
  })
}

/**
 * El tilde es la interacción más usada del checklist, así que se aplica
 * optimista: esperar el round trip para ver el tilde se siente roto. Si el
 * servidor rechaza, onError deja la lista como estaba.
 */
export function useToggleItem(key: QueryKey) {
  const queryClient = useQueryClient()

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

    onSettled: () => queryClient.invalidateQueries({ queryKey: ['items'] })
  })
}

/** Mismo criterio optimista que el tilde: el reordenamiento no puede titilar. */
export function useReorderItems(key: QueryKey) {
  const queryClient = useQueryClient()

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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['items'] })
  })
}

export function useCreateRecurringItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRecurringItems,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] })
  })
}

export function useDeleteItemSeries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteItemSeries,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] })
  })
}
