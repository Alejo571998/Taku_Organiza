import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCategories,
  saveCategory,
  deleteCategory,
  fetchMovements,
  saveMovement,
  deleteMovement,
  deleteSeries,
  setPaid,
  crearSerie,
  fetchSettings,
  saveMonthlyIncome,
  fetchCards,
  saveCard,
  deleteCard,
  pagarResumenTarjeta,
  repartirIngreso
} from '@/lib/queries/finanzas'
import type { FinMovement } from '@/types/database.types'

export const categoriasKey = ['fin', 'categorias'] as const
export const settingsKey = ['fin', 'settings'] as const
export const movimientosKey = (from: string, to: string) =>
  ['fin', 'movimientos', from, to] as const

export function useCategorias() {
  return useQuery({ queryKey: categoriasKey, queryFn: fetchCategories })
}

export function useMovimientos(from: string, to: string) {
  return useQuery({
    queryKey: movimientosKey(from, to),
    queryFn: () => fetchMovements(from, to)
  })
}

export function useFinSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: fetchSettings })
}

/**
 * Guardar y borrar invalidan TODA la familia ['fin','movimientos'] y no una
 * clave puntual: al editar se puede cambiar la fecha, así que el mes del que
 * sale y el mes al que entra son distintos, y acertarles a mano es la clase de
 * cosa que se desincroniza en silencio. Es el mismo criterio que con las
 * tareas.
 */
function invalidarMovimientos(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['fin', 'movimientos'] })
}

export function useSaveMovimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveMovement,
    onSuccess: () => invalidarMovimientos(queryClient)
  })
}

export function useCrearSerie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearSerie,
    onSuccess: () => invalidarMovimientos(queryClient)
  })
}

export function useDeleteMovimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteMovement,
    onSuccess: () => invalidarMovimientos(queryClient)
  })
}

export function useDeleteSerie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSeries,
    onSuccess: () => invalidarMovimientos(queryClient)
  })
}

/**
 * Marcar pagado es la interacción más repetida del módulo, así que se aplica
 * optimista: esperar el round trip para ver el tilde se siente roto. Si el
 * servidor rechaza, onError deja la lista como estaba.
 */
export function useMarcarPagado(from: string, to: string) {
  const queryClient = useQueryClient()
  const key = movimientosKey(from, to)

  return useMutation({
    mutationFn: ({ id, monto }: { id: string; monto: number }) => setPaid(id, monto),

    onMutate: async ({ id, monto }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previo = queryClient.getQueryData<FinMovement[]>(key)
      queryClient.setQueryData<FinMovement[]>(key, (viejo) =>
        (viejo ?? []).map((m) => (m.id === id ? { ...m, paid_amount: monto } : m))
      )
      return { previo }
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.previo) queryClient.setQueryData(key, ctx.previo)
    },

    onSettled: () => invalidarMovimientos(queryClient)
  })
}

export function useSaveCategoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriasKey })
      invalidarMovimientos(queryClient)
    }
  })
}

export function useDeleteCategoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriasKey })
      // Los movimientos quedaron sin categoría: hay que releerlos o la lista
      // seguiría mostrando una categoría que ya no existe.
      invalidarMovimientos(queryClient)
    }
  })
}

export function useSaveIngresoMensual() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveMonthlyIncome,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKey })
  })
}

// ------------------------------------------------------------
// Tarjetas y reparto
// ------------------------------------------------------------

export const tarjetasKey = ['fin', 'tarjetas'] as const

export function useTarjetas() {
  return useQuery({ queryKey: tarjetasKey, queryFn: fetchCards })
}

export function useSaveTarjeta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tarjetasKey })
      invalidarMovimientos(queryClient)
    }
  })
}

export function useDeleteTarjeta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tarjetasKey })
      // Los consumos quedaron sin tarjeta: hay que releerlos o seguirían
      // agrupados bajo una tarjeta que ya no existe.
      invalidarMovimientos(queryClient)
    }
  })
}

export function usePagarResumen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      cardId,
      desde,
      hasta,
      pagar
    }: {
      cardId: string
      desde: string
      hasta: string
      pagar: boolean
    }) => pagarResumenTarjeta(cardId, desde, hasta, pagar),
    onSuccess: () => invalidarMovimientos(queryClient)
  })
}

export function useRepartirIngreso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: repartirIngreso,
    onSuccess: () => invalidarMovimientos(queryClient)
  })
}
