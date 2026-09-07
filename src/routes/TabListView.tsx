import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTabs } from '@/hooks/useTabs'
import { useItemsByTab, useToggleItem, useReorderItems, itemsByTabKey } from '@/hooks/useItems'
import { formatCorto, todayISO, esHoy } from '@/lib/dates'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import TabEditorModal from '@/components/tabs/TabEditorModal'
import { SortableList, SortableRow } from '@/components/ui/SortableList'
import type { Item } from '@/types/database.types'
import RepeatIcon from '@/components/ui/RepeatIcon'

/** Lista completa de una pestaña: todas sus tareas, sin importar la fecha. */
export default function TabListView() {
  const { tabId = '' } = useParams()
  const navigate = useNavigate()

  const { data: tabs } = useTabs()
  const tab = tabs?.find((t) => t.id === tabId)

  const key = itemsByTabKey(tabId)
  const { data: items, isLoading, error } = useItemsByTab(tabId)
  const toggle = useToggleItem(key)
  const reorder = useReorderItems(key)

  const [editandoItem, setEditandoItem] = useState<Item | 'new' | null>(null)
  const [editandoTab, setEditandoTab] = useState(false)

  function resumen(item: Item): string {
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

  if (tabs && !tab) {
    return (
      <div>
        <p className="text-sm text-text-secondary">Esa pestaña ya no existe.</p>
        <button onClick={() => navigate('/dia')} className="mt-2 text-sm text-accent-text underline">
          Ir al día
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ background: `var(--cat-${tab?.color ?? 'peach'}-text)` }}
        />
        <h1 className="text-xl font-bold">{tab?.name ?? 'Pestaña'}</h1>
        <button
          onClick={() => setEditandoTab(true)}
          className="text-sm text-accent-text underline"
        >
          Editar pestaña
        </button>
        <button
          onClick={() => setEditandoItem('new')}
          className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          + Tarea
        </button>
      </div>

      {isLoading && <p className="text-sm text-text-muted italic">Cargando...</p>}
      {error && (
        <p className="text-sm text-danger">No se pudieron cargar las tareas. {error.message}</p>
      )}

      {!isLoading && !error && items?.length === 0 && (
        <p className="text-sm text-text-muted italic">
          Esta pestaña todavía no tiene tareas. Agregá la primera con “+ Tarea”.
        </p>
      )}

      {items && items.length > 0 && (
        <SortableList
          ids={items.map((i) => i.id)}
          onReorder={(ids) => reorder.mutate(ids)}
          className="flex flex-col gap-1.5"
        >
          {items.map((item) => (
            <SortableRow
              key={item.id}
              id={item.id}
              className="flex items-start gap-2 rounded-card border border-border bg-surface px-2 py-2.5"
              style={{ borderLeft: `4px solid var(--cat-${tab?.color ?? 'peach'})` }}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(e) => toggle.mutate({ id: item.id, completed: e.target.checked })}
                className="mt-1 shrink-0"
                aria-label={`Marcar "${item.title}"`}
              />
              <button
                onClick={() => setEditandoItem(item)}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={`flex items-center gap-1.5 text-sm ${
                    item.completed ? 'text-text-muted line-through' : ''
                  }`}
                >
                  {item.recurrence && <RepeatIcon className="shrink-0 text-text-muted" />}
                  {item.title}
                </span>
                {resumen(item) && (
                  <span className="text-xs text-text-secondary">{resumen(item)}</span>
                )}
              </button>
              <button
                onClick={() => navigate(`/dia?d=${item.date}`)}
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  esHoy(item.date)
                    ? 'bg-accent-soft text-accent-text font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Ver ese día"
              >
                {esHoy(item.date) ? 'Hoy' : formatCorto(item.date)}
              </button>
            </SortableRow>
          ))}
        </SortableList>
      )}

      {editandoItem && tabs && (
        <ItemEditorModal
          tabs={tabs}
          item={editandoItem === 'new' ? undefined : editandoItem}
          defaultDate={todayISO()}
          defaultTabId={tabId}
          onClose={() => setEditandoItem(null)}
        />
      )}

      {editandoTab && tab && (
        <TabEditorModal tab={tab} onClose={() => setEditandoTab(false)} />
      )}
    </div>
  )
}
