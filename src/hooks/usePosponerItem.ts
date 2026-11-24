import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moverItemAFecha, haySerieEnFecha } from '@/lib/queries/items'
import { useTaku } from '@/components/taku/TakuProvider'
import { destinoAlPosponer, nombreDeDia } from '@/lib/dates'
import type { Item } from '@/types/database.types'

/**
 * Pasar una tarea que no se hizo al día siguiente.
 *
 * Es la acción que reemplaza a lo que hoy se hace a mano: abrir la tarea,
 * cambiarle la fecha, guardar. Tres pasos para algo que pasa todos los días.
 *
 * Dos cosas que no son obvias y hacen la diferencia:
 *
 * 1. SE PUEDE DESHACER. La fila desaparece de la lista del día apenas se
 *    toca el botón, así que un toque por error no tiene que costar una
 *    búsqueda por el calendario. Taku ofrece volverla a su lugar.
 * 2. UNA TAREA QUE SE REPITE NO SE DUPLICA. Si se repite a diario, mañana ya
 *    existe su fila; moverle la de hoy encima dejaría el mismo renglón dos
 *    veces en un día. En ese caso no se mueve nada y se dice por qué.
 */
export function usePosponerItem() {
  const queryClient = useQueryClient()
  const { decir } = useTaku()

  const volver = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha: string }) => moverItemAFecha(id, fecha),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      // Vuelve al día que tenía, aunque al final de la lista: recordar en qué
      // posición estaba sería guardar un estado que nadie va a mirar.
      decir({ prioridad: 1, texto: 'Listo, la dejé donde estaba.' })
    },
    onError: () =>
      decir({
        prioridad: 1,
        estado: 'alerta',
        texto: 'No pude devolverla. Fijate la conexión y probá de nuevo.'
      })
  })

  const posponer = useMutation({
    mutationFn: async (item: Item) => {
      const destino = destinoAlPosponer(item.date)
      if (item.series_id && (await haySerieEnFecha(item.series_id, destino))) {
        return { movida: false as const, destino }
      }
      await moverItemAFecha(item.id, destino)
      return { movida: true as const, destino }
    },

    onSuccess: ({ movida, destino }, item) => {
      queryClient.invalidateQueries({ queryKey: ['items'] })

      if (!movida) {
        decir({
          prioridad: 1,
          estado: 'pensando',
          texto: `"${item.title}" ya está ${nombreDeDia(destino)}: se repite, así que no la dupliqué.`
        })
        return
      }

      decir({
        prioridad: 1,
        duracion: 10_000,
        texto: `Pasé "${item.title}" para ${nombreDeDia(destino)}.`,
        acciones: [
          {
            texto: 'Deshacer',
            onClick: () => volver.mutate({ id: item.id, fecha: item.date })
          }
        ]
      })
    },

    onError: () =>
      decir({
        prioridad: 1,
        estado: 'alerta',
        texto: 'No pude pasar la tarea. Fijate la conexión y probá de nuevo.'
      })
  })

  return {
    posponer: (item: Item) => posponer.mutate(item),
    /**
     * Para que un doble toque no mande la misma tarea dos días adelante.
     * Mira el ítem y no "hay algo en curso": bloquear la lista entera dejaría
     * los otros botones muertos mientras viaja el primero.
     */
    enCurso: (id: string) =>
      (posponer.isPending && posponer.variables?.id === id) ||
      (volver.isPending && volver.variables?.id === id)
  }
}
