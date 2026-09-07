import { useState } from 'react'
import { useTabs } from '@/hooks/useTabs'
import { useItems, useToggleItem, useReorderItems } from '@/hooks/useItems'
import { useSelectedDate } from '@/hooks/useSelectedDate'
import { useSelectedTab } from '@/hooks/useSelectedTab'
import { addDays, formatLargo, esHoy, todayISO } from '@/lib/dates'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import Chevron from '@/components/ui/Chevron'
import { SortableList, SortableRow } from '@/components/ui/SortableList'
import type { Item } from '@/types/database.types'

export default function DayView() {
  const [date, setDate] = useSelectedDate()
  const { data: tabs } = useTabs()
  const [tabFiltro] = useSelectedTab()
  const { data: todosLosItems, isLoading, error } = useItems(date, date)

  // La barra inferior filtra todas las vistas por igual.
  const items = tabFiltro ? todosLosItems?.filter((i) => i.tab_id === tabFiltro) : todosLosItems
  const toggle = useToggleItem(date, date)
  const reorder = useReorderItems(date, date)
  const [editing, setEditing] = useState<Item | 'new' | null>(null)

  const tabsById = new Map((tabs ?? []).map((t) => [t.id, t]))

  function resumen(item: Item): string {
    const tab = tabsById.get(item.tab_id)
    if (!tab) return ''
    return tab.tab_fields
      .map((f) => {
        const v = item.custom_data[f.id]
        if (v === undefined || v === '' || v === null) return null
        if (f.type === 'boolean') return v ? f.name : null
        if (f.type === 'currency')
          return `${f.name}: $${Number(v).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`
        return `${f.name}: ${v}`
      })
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        {/* Chevrons en SVG y no "←"/"→": Plus Jakarta Sans no trae esos
            glifos y el fallback los dibujaba como una raya. */}
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="border border-border rounded p-1.5 hover:bg-surface-alt transition-colors"
          aria-label="Día anterior"
        >
          <Chevron className="rotate-180" />
        </button>
        <button
          onClick={() => setDate(addDays(date, 1))}
          className="border border-border rounded p-1.5 hover:bg-surface-alt transition-colors"
          aria-label="Día siguiente"
        >
          <Chevron />
        </button>
        {/* first-letter y no capitalize: capitalize pondria mayuscula en
            cada palabra ("6 De Septiembre") y en espanol va solo la inicial. */}
        <h1 className="text-xl font-bold first-letter:uppercase">{formatLargo(date)}</h1>
        {!esHoy(date) && (
          <button
            onClick={() => setDate(todayISO())}
            className="text-sm text-accent-text underline ml-1"
          >
            Hoy
          </button>
        )}
        <button
          onClick={() => setEditing('new')}
          disabled={!tabs || tabs.length === 0}
          className="ml-auto bg-accent text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          + Ítem
        </button>
      </div>

      {tabs && tabs.length === 0 && (
        <p className="text-sm text-text-secondary">
          Creá una pestaña desde la barra de abajo antes de cargar ítems: cada ítem vive dentro de una.
        </p>
      )}

      {isLoading && <p className="text-sm text-text-muted italic">Cargando...</p>}
      {error && (
        <p className="text-sm text-danger">No se pudieron cargar los ítems. {error.message}</p>
      )}

      {!isLoading && !error && items?.length === 0 && tabs && tabs.length > 0 && (
        <p className="text-sm text-text-muted italic">Nada para este día.</p>
      )}

      {items && items.length > 0 && (
        <SortableList
          ids={items.map((i) => i.id)}
          onReorder={(ids) => reorder.mutate(ids)}
          className="flex flex-col gap-1.5"
        >
          {items.map((item) => {
            const tab = tabsById.get(item.tab_id)
            const detalle = resumen(item)
            return (
              <SortableRow
                key={item.id}
                id={item.id}
                className="flex items-start gap-2 bg-surface border border-border rounded-card px-2 py-2.5"
                style={{ borderLeft: `4px solid var(--cat-${tab?.color ?? 'peach'})` }}
              >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(e) => toggle.mutate({ id: item.id, completed: e.target.checked })}
                className="mt-1 shrink-0"
                aria-label={`Marcar "${item.title}"`}
              />
              <button onClick={() => setEditing(item)} className="text-left flex-1 min-w-0">
                <span
                  className={`text-sm block ${
                    item.completed ? 'line-through text-text-muted' : ''
                  }`}
                >
                  {item.title}
                </span>
                {detalle && <span className="text-xs text-text-secondary">{detalle}</span>}
              </button>
                {tab && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full shrink-0 hidden sm:inline"
                    style={{
                      background: `var(--cat-${tab.color})`,
                      color: `var(--cat-${tab.color}-text)`
                    }}
                  >
                    {tab.name}
                  </span>
                )}
              </SortableRow>
            )
          })}
        </SortableList>
      )}

      {editing && tabs && (
        <ItemEditorModal
          tabs={tabs}
          item={editing === 'new' ? undefined : editing}
          defaultDate={date}
          defaultTabId={tabFiltro}
          range={{ from: date, to: date }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
