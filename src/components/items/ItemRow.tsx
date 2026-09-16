import type { ReactNode } from 'react'
import { SortableRow } from '@/components/ui/SortableList'
import RepeatIcon from '@/components/ui/RepeatIcon'
import NoteToggle from '@/components/ui/NoteToggle'
import { itemColor, pastel } from '@/lib/palette'
import { itemSummary } from '@/lib/itemSummary'
import type { TabWithFields } from '@/lib/queries/tabs'
import type { Item } from '@/types/database.types'

interface Props {
  item: Item
  tab: TabWithFields | undefined
  onToggle: (completed: boolean) => void
  onEdit: () => void
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
export default function ItemRow({ item, tab, onToggle, onEdit, trailing }: Props) {
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
          <span className="truncate">{item.title}</span>
        </span>
        {detalle && <span className="mt-0.5 block text-xs text-text-secondary">{detalle}</span>}
      </button>

      {item.note && <NoteToggle note={item.note} color={c} />}

      {trailing}
    </SortableRow>
  )
}
