import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchHabits,
  saveHabit,
  deleteHabit,
  fetchHabitLogs,
  marcarHabito
} from '@/lib/queries/habitos'
import type { HabitLog } from '@/types/database.types'

export const habitosKey = ['habitos'] as const
export const marcasKey = (from: string, to: string) => ['habitos', 'marcas', from, to] as const

export function useHabitos() {
  return useQuery({ queryKey: habitosKey, queryFn: fetchHabits })
}

export function useMarcas(from: string, to: string) {
  return useQuery({ queryKey: marcasKey(from, to), queryFn: () => fetchHabitLogs(from, to) })
}

export function useSaveHabito() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveHabit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitosKey })
  })
}

export function useDeleteHabito() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteHabit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitosKey })
  })
}

/**
 * Optimista, y acá no es un lujo: marcar un hábito es un toque que se repite
 * todos los días y a veces varias veces seguidas en la grilla. Si cada uno
 * esperara al servidor, la cuadrícula parpadearía.
 */
export function useMarcarHabito(from: string, to: string) {
  const queryClient = useQueryClient()
  const key = marcasKey(from, to)

  return useMutation({
    mutationFn: ({ habitId, date, hecho }: { habitId: string; date: string; hecho: boolean }) =>
      marcarHabito(habitId, date, hecho),

    onMutate: async ({ habitId, date, hecho }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previo = queryClient.getQueryData<HabitLog[]>(key)
      queryClient.setQueryData<HabitLog[]>(key, (viejo) => {
        const lista = viejo ?? []
        if (!hecho) return lista.filter((l) => !(l.habit_id === habitId && l.date === date))
        if (lista.some((l) => l.habit_id === habitId && l.date === date)) return lista
        return [...lista, { habit_id: habitId, user_id: '', date }]
      })
      return { previo }
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.previo) queryClient.setQueryData(key, ctx.previo)
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ['habitos', 'marcas'] })
  })
}
