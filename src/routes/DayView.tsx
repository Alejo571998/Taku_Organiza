import { useState } from 'react'
import { useTabs } from '@/hooks/useTabs'
import { useItems, useToggleItem, useReorderItems, itemsKey } from '@/hooks/useItems'
import { useSelectedDate } from '@/hooks/useSelectedDate'
import { addDays, formatLargo, esHoy, todayISO } from '@/lib/dates'
import { itemColor, pastel } from '@/lib/palette'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import ItemRow from '@/components/items/ItemRow'
import Chevron from '@/components/ui/Chevron'
import { SortableList } from '@/components/ui/SortableList'
import type { Item } from '@/types/database.types'

export default function DayView() {
  const [date, setDate] = useSelectedDate()
  const { data: tabs } = useTabs()
  const { data: items, isLoading, error } = useItems(date, date)
  const rangoKey = itemsKey(date, date)
  const toggle = useToggleItem(rangoKey)
  const reorder = useReorderItems(rangoKey)
  const [editing, setEditing] = useState<Item | 'new' | null>(null)

  const tabsById = new Map((tabs ?? []).map((t) => [t.id, t]))
  const pendientes = items?.filter((i) => !i.completed).length ?? 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="glass flex shrink-0 items-center rounded-pill p-1">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Día anterior"
          >
            <Chevron className="rotate-180" />
          </button>
          <button
            onClick={() => setDate(addDays(date, 1))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Día siguiente"
          >
            <Chevron />
          </button>
        </div>

        <div className="min-w-0">
          {/* first-letter y no capitalize: capitalize pondría mayúscula en
              cada palabra ("6 De Septiembre") y en español va solo la inicial. */}
          <h1 className="truncate text-xl font-bold first-letter:uppercase sm:text-2xl">
            {formatLargo(date)}
          </h1>
          <p className="text-xs text-text-muted">
            {esHoy(date) ? 'Hoy' : 'Otro día'}
            {items && items.length > 0 && ` · ${pendientes} pendiente${pendientes === 1 ? '' : 's'}`}
          </p>
        </div>

        {!esHoy(date) && (
          <button
            onClick={() => setDate(todayISO())}
            className="btn-ghost px-2.5 py-1 text-xs"
          >
            Ir a hoy
          </button>
        )}

        <button
          onClick={() => setEditing('new')}
          disabled={!tabs || tabs.length === 0}
          className="btn-primary ml-auto shrink-0"
        >
          + Tarea
        </button>
      </div>

      {tabs && tabs.length === 0 && (
        <p className="glass rounded-card px-4 py-6 text-sm text-text-secondary">
          Creá una pestaña desde la barra de abajo antes de cargar tareas: cada tarea vive dentro
          de una.
        </p>
      )}

      {isLoading && <p className="text-sm italic text-text-muted">Cargando…</p>}
      {error && (
        <p className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">
          No se pudieron cargar las tareas. {error.message}
        </p>
      )}

      {!isLoading && !error && items?.length === 0 && tabs && tabs.length > 0 && (
        <div className="glass rounded-card px-4 py-10 text-center">
          <p className="text-sm text-text-secondary">Nada para este día.</p>
          <button onClick={() => setEditing('new')} className="mt-2 text-sm text-accent-text underline">
            Agregar la primera
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <SortableList
          ids={items.map((i) => i.id)}
          onReorder={(ids) => reorder.mutate(ids)}
          className="flex flex-col gap-2"
        >
          {items.map((item) => {
            const tab = tabsById.get(item.tab_id)
            const c = itemColor(item.color, tab?.color)
            return (
              <ItemRow
                key={item.id}
                item={item}
                tab={tab}
                onToggle={(completed) => toggle.mutate({ id: item.id, completed })}
                onEdit={() => setEditing(item)}
                trailing={
                  tab && (
                    <span
                      className="hidden shrink-0 rounded-pill px-2.5 py-1 text-xs sm:inline"
                      style={{ background: pastel(c, 0.14), color: pastel(c, 1) }}
                    >
                      {tab.name}
                    </span>
                  )
                }
              />
            )
          })}
        </SortableList>
      )}

      {editing && tabs && (
        <ItemEditorModal
          tabs={tabs}
          item={editing === 'new' ? undefined : editing}
          defaultDate={date}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
