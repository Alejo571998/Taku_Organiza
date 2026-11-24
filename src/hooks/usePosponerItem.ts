import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moverItemAFecha, moverItemsAFecha, haySerieEnFecha } from '@/lib/queries/items'
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
 *
 * `posponerTanda` hace lo mismo con todo lo que quedó pendiente de un día,
 * que es como termina la jornada cuando quedaron tres o cuatro cosas: una por
 * una es el mismo trabajo repetido.
 */
/**
 * Lo que Taku dice después de mover una tanda.
 *
 * Afuera del hook porque es la parte que se puede equivocar sola: contar mal,
 * decir "1 tareas", o callarse las que no se movieron. Así se prueba sin
 * levantar media app.
 */
export function textoDeTanda(
  movidas: number,
  repetidas: number,
  fallaron: number,
  cuando: string
): string {
  if (movidas === 0) {
    return `No hizo falta mover nada: lo que queda se repite y ya está ${cuando}.`
  }

  const partes = [
    movidas === 1 ? `Pasé 1 tarea para ${cuando}.` : `Pasé ${movidas} tareas para ${cuando}.`
  ]
  if (repetidas > 0) {
    partes.push(
      repetidas === 1
        ? `Dejé 1 que se repite y ya estaba ${cuando}.`
        : `Dejé ${repetidas} que se repiten y ya estaban ${cuando}.`
    )
  }
  // Una tanda puede fallar a medias, y decir "listo" a secas sería mentir
  // sobre la que quedó atrás.
  if (fallaron > 0) {
    partes.push(fallaron === 1 ? 'Una no se pudo mover.' : `${fallaron} no se pudieron mover.`)
  }
  return partes.join(' ')
}

export function usePosponerItem() {
  const queryClient = useQueryClient()
  const { decir } = useTaku()

  const volver = useMutation({
    mutationFn: ({ ids, fecha }: { ids: string[]; fecha: string }) =>
      moverItemsAFecha(ids, fecha),
    onSuccess: (_movidos, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      // Vuelven al día que tenían, aunque al final de la lista: recordar en
      // qué posición estaban sería guardar un estado que nadie va a mirar.
      decir({
        prioridad: 1,
        texto: ids.length === 1 ? 'Listo, la dejé donde estaba.' : 'Listo, las dejé donde estaban.'
      })
    },
    onError: (_e, { ids }) =>
      decir({
        prioridad: 1,
        estado: 'alerta',
        texto: `No pude ${ids.length === 1 ? 'devolverla' : 'devolverlas'}. Fijate la conexión y probá de nuevo.`
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
            onClick: () => volver.mutate({ ids: [item.id], fecha: item.date })
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

  /**
   * Toda la tanda de un día de una sola vez.
   *
   * Mueve en el orden en que venían, así la lista de mañana queda igual a la
   * que se estaba mirando y no barajada.
   */
  const posponerTanda = useMutation({
    mutationFn: async (items: Item[]) => {
      const origen = items[0].date
      const destino = destinoAlPosponer(origen)

      // Las que se repiten y ya tienen su fila en el destino quedan afuera:
      // moverlas encima dejaría el mismo renglón dos veces el mismo día.
      const yaEstan = await Promise.all(
        items.map((i) => (i.series_id ? haySerieEnFecha(i.series_id, destino) : false))
      )
      const aMover = items.filter((_, i) => !yaEstan[i])

      const movidos = await moverItemsAFecha(
        aMover.map((i) => i.id),
        destino
      )
      return {
        origen,
        destino,
        movidos,
        repetidas: items.length - aMover.length,
        fallaron: aMover.length - movidos.length
      }
    },

    onSuccess: ({ origen, destino, movidos, repetidas, fallaron }) => {
      queryClient.invalidateQueries({ queryKey: ['items'] })

      if (movidos.length === 0) {
        decir({
          prioridad: 1,
          estado: 'pensando',
          texto: textoDeTanda(0, repetidas, fallaron, nombreDeDia(destino))
        })
        return
      }

      decir({
        prioridad: 1,
        duracion: 12_000,
        texto: textoDeTanda(movidos.length, repetidas, fallaron, nombreDeDia(destino)),
        acciones: [
          { texto: 'Deshacer', onClick: () => volver.mutate({ ids: movidos, fecha: origen }) }
        ]
      })
    },

    onError: () =>
      decir({
        prioridad: 1,
        estado: 'alerta',
        texto: 'No pude pasar las tareas. Fijate la conexión y probá de nuevo.'
      })
  })

  return {
    posponer: (item: Item) => posponer.mutate(item),
    posponerTanda: (items: Item[]) => {
      if (items.length > 0) posponerTanda.mutate(items)
    },
    tandaEnCurso: posponerTanda.isPending,
    /**
     * Para que un doble toque no mande la misma tarea dos días adelante.
     * Mira el ítem y no "hay algo en curso": bloquear la lista entera dejaría
     * los otros botones muertos mientras viaja el primero.
     */
    enCurso: (id: string) =>
      (posponer.isPending && posponer.variables?.id === id) ||
      (volver.isPending && (volver.variables?.ids ?? []).includes(id)) ||
      posponerTanda.isPending
  }
}
