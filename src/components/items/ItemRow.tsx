import type { ReactNode } from 'react'
import { SortableRow } from '@/components/ui/SortableList'
import RepeatIcon from '@/components/ui/RepeatIcon'
import NoteToggle from '@/components/ui/NoteToggle'
import { itemColor, pastel } from '@/lib/palette'
import { itemSummary } from '@/lib/itemSummary'
import { destinoAlPosponer, nombreDeDia } from '@/lib/dates'
import type { TabWithFields } from '@/lib/queries/tabs'
import type { Item } from '@/types/database.types'

interface Props {
  item: Item
  tab: TabWithFields | undefined
  onToggle: (completed: boolean) => void
  onEdit: () => void
  /** Si viene, la fila ofrece pasar la tarea al día siguiente. */
  onPosponer?: () => void
  /** Hay un movimiento en curso: no se puede tocar dos veces. */
  posponiendo?: boolean
  /** Se dibuja a la derecha: la pestaña en Día, la fecha en la lista. */
  trailing?: ReactNode
}

/**
 * Tarjeta de tarea de las vistas donde SÍ se edita (Día y lista de pestaña).
 *
 * El color se derrama por la fila: arranca lleno en el borde izquierdo y se
 * apaga hacia el centro. Antes era una barra de 4px y el color que la persona
 * elegía para cada tarea casi no se veía.
 *
 * Por qué se apaga en vez de teñir la fila entera: el texto es casi blanco y
 * necesita fondo oscuro debajo para mantener contraste, y con doce pasteles
 * una lista teñida de punta a punta se lee como un arcoíris. Degradado, el
 * color se ve de sobra y el texto sigue apoyado sobre el navy.
 *
 * Va en backgroundImage y no en background: background pisaría el color de
 * .glass y la fila perdería su superficie de vidrio.
 */
export default function ItemRow({
  item,
  tab,
  onToggle,
  onEdit,
  onPosponer,
  posponiendo,
  trailing
}: Props) {
  const c = itemColor(item.color, tab?.color)
  const detalle = itemSummary(item, tab)

  // Una tarea tildada baja el color pero no lo pierde: sigue diciendo de qué
  // pestaña era.
  const intensidad = item.completed ? 0.3 : 1
  const derrame = [
    `${pastel(c, 0.95 * intensidad)} 0px`,
    `${pastel(c, 0.95 * intensidad)} 6px`,
    `${pastel(c, 0.42 * intensidad)} 6px`,
    `${pastel(c, 0.17 * intensidad)} 42%`,
    'transparent 80%'
  ].join(', ')

  return (
    <SortableRow
      id={item.id}
      className="glass group relative flex flex-wrap items-start gap-2.5 overflow-hidden rounded-card px-3 py-3 transition-colors hover:bg-white/[0.07]"
      style={{ backgroundImage: `linear-gradient(90deg, ${derrame})` }}
    >
      <input
        type="checkbox"
        checked={item.completed}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 shrink-0"
        aria-label={`Marcar "${item.title}"`}
      />

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span
          className={`flex items-center gap-1.5 text-sm font-medium ${
            item.completed ? 'text-text-muted line-through' : 'text-text-primary'
          }`}
        >
          {item.recurrence && (
            <RepeatIcon className="shrink-0" style={{ color: pastel(c, 0.8) }} />
          )}
          {/* La hora va adelante y tabular: alineada, la columna de horarios
              se lee de un vistazo sin tener que entrar en cada título. */}
          {item.time && (
            <span
              className="shrink-0 text-xs font-semibold tabular-nums"
              style={{ color: pastel(c, 1) }}
            >
              {item.time.slice(0, 5)}
            </span>
          )}
          <span className="truncate">{item.title}</span>
        </span>
        {detalle && <span className="mt-0.5 block text-xs text-text-secondary">{detalle}</span>}
      </button>

      {item.note && <NoteToggle note={item.note} color={c} />}

      {/* Pasar la tarea al día siguiente.
          Solo si está pendiente: una tarea hecha no se pospone, y el botón
          ahí al lado del tilde sería una invitación a equivocarse.
          Se ve siempre, no al pasar el mouse: en un teléfono no hay mouse, y
          esconderlo detrás de un hover lo volvería invisible justo donde más
          se usa.
          Y mide 36px de alto aunque el ícono tenga 15: con el dedo, un blanco
          del tamaño del dibujo se falla la mitad de las veces. */}
      {onPosponer && !item.completed && (
        <button
          type="button"
          onClick={onPosponer}
          disabled={posponiendo}
          className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary disabled:opacity-40"
          title={`Pasar para ${nombreDeDia(destinoAlPosponer(item.date))}`}
          aria-label={`Pasar "${item.title}" para ${nombreDeDia(destinoAlPosponer(item.date))}`}
        >
          <FlechaAlDiaSiguiente />
        </button>
      )}

      {trailing}
    </SortableRow>
  )
}

/**
 * Flecha que termina contra una pared: "mandá esto al día que viene".
 * En SVG y no con una flecha de texto, por lo mismo que el resto de los
 * íconos: la tipografía de la app no trae esos glifos.
 */
function FlechaAlDiaSiguiente() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h11" />
      <path d="M11 7l5 5-5 5" />
      <path d="M20 5v14" />
    </svg>
  )
}
