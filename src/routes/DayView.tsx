import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTabs } from '@/hooks/useTabs'
import { useItems, useToggleItem, useReorderItems, itemsKey } from '@/hooks/useItems'
import { useSelectedDate } from '@/hooks/useSelectedDate'
import { addDays, formatLargo, esHoy, todayISO } from '@/lib/dates'
import { itemColor, pastel } from '@/lib/palette'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import ItemRow from '@/components/items/ItemRow'
import Chevron from '@/components/ui/Chevron'
import { SortableList } from '@/components/ui/SortableList'
import TakuVacio from '@/components/taku/TakuVacio'
import type { Item } from '@/types/database.types'

export default function DayView() {
  const [date, setDate] = useSelectedDate()
  const { data: tabs } = useTabs()
  const { data: items, isLoading, error } = useItems(date, date)
  const rangoKey = itemsKey(date, date)
  const toggle = useToggleItem(rangoKey)
  const reorder = useReorderItems(rangoKey)
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [params, setParams] = useSearchParams()

  const tabsById = new Map((tabs ?? []).map((t) => [t.id, t]))
  const pendientes = items?.filter((i) => !i.completed).length ?? 0

  /**
   * El atajo "Nueva tarea" de Taku llega como ?nueva=1, porque el editor vive
   * acá y el dock no puede abrirlo desde afuera.
   *
   * Espera a que carguen las pestañas: sin ninguna, el editor no tiene dónde
   * guardar. Y consume el parámetro siempre, para que un refresh no reabra el
   * formulario solo.
   */
  useEffect(() => {
    if (params.get('nueva') === null || !tabs) return
    const limpio = new URLSearchParams(params)
    limpio.delete('nueva')
    setParams(limpio, { replace: true })
    if (tabs.length > 0) setEditing('new')
  }, [params, tabs, setParams])

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
        <TakuVacio
          titulo="Empecemos por una pestaña"
          detalle="Cada tarea vive dentro de una: Trabajo, Casa, Gastos… Creá la primera desde la barra de abajo."
        />
      )}

      {isLoading && <p className="text-sm italic text-text-muted">Cargando…</p>}
      {error && (
        <p className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">
          No se pudieron cargar las tareas. {error.message}
        </p>
      )}

      {!isLoading && !error && items?.length === 0 && tabs && tabs.length > 0 && (
        <TakuVacio
          titulo={esHoy(date) ? 'Hoy no tenés nada anotado.' : 'Nada para este día.'}
          accion={
            <button onClick={() => setEditing('new')} className="btn-primary">
              Agregar la primera
            </button>
          }
        />
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
