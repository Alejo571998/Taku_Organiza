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
 * El color no tiñe la tarjeta entera: va en una barra lateral, el punto y el
 * ícono de nota. Pintar el fondo completo con doce pasteles distintos hace
 * que la lista se lea como un arcoíris y el texto pierda contraste; como
 * acento, el color identifica sin competir con el contenido.
 */
export default function ItemRow({ item, tab, onToggle, onEdit, trailing }: Props) {
  const c = itemColor(item.color, tab?.color)
  const detalle = itemSummary(item, tab)

  return (
    <SortableRow
      id={item.id}
      className="glass group relative flex flex-wrap items-start gap-2.5 overflow-hidden rounded-card px-3 py-3 transition-colors hover:bg-white/[0.07]"
    >
      {/* Barra de color a la izquierda: identifica sin teñir la tarjeta. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{
          background: `linear-gradient(180deg, ${pastel(c, 0.95)}, ${pastel(c, 0.35)})`,
          opacity: item.completed ? 0.35 : 1
        }}
      />

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
