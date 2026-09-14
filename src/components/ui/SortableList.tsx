import type { ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ListProps {
  ids: string[]
  /** Recibe el orden nuevo completo. */
  onReorder: (ids: string[]) => void
  children: ReactNode
  className?: string
}

export function SortableList({ ids, onReorder, children, className }: ListProps) {
  const sensors = useSensors(
    // La distancia mínima es lo que deja convivir el arrastre con los clicks:
    // sin ella, tocar un checkbox arranca un drag y el click nunca llega.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  )
}

interface RowProps {
  id: string
  children: ReactNode
  className?: string
  /** Estilos extra de la fila (por ejemplo el borde de color de la pestaña). */
  style?: React.CSSProperties
}

export function SortableRow({ id, children, className = '', style }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
        boxShadow: isDragging ? '0 16px 40px -12px rgb(0 0 0 / 0.8)' : undefined,
        zIndex: isDragging ? 10 : undefined
      }}
      className={className}
    >
      {/* touch-none es obligatorio: sin él, en el celular el gesto lo agarra
          el scroll de la página y el arrastre nunca empieza. */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none self-center px-0.5 text-text-muted/50 transition-colors hover:text-text-secondary active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
          <circle cx="7" cy="5" r="1.5" />
          <circle cx="13" cy="5" r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="15" r="1.5" />
          <circle cx="13" cy="15" r="1.5" />
        </svg>
      </button>
      {children}
    </div>
  )
}
