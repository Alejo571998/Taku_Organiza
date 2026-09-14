import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTabs } from '@/hooks/useTabs'
import { useItemsByTab, useToggleItem, useReorderItems, itemsByTabKey } from '@/hooks/useItems'
import { formatCorto, todayISO, esHoy } from '@/lib/dates'
import { pastel, safeColor } from '@/lib/palette'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import ItemRow from '@/components/items/ItemRow'
import TabEditorModal from '@/components/tabs/TabEditorModal'
import { SortableList } from '@/components/ui/SortableList'
import type { Item } from '@/types/database.types'

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

  if (tabs && !tab) {
    return (
      <div className="glass rounded-card px-4 py-8 text-center">
        <p className="text-sm text-text-secondary">Esa pestaña ya no existe.</p>
        <button onClick={() => navigate('/dia')} className="mt-2 text-sm text-accent-text underline">
          Ir al día
        </button>
      </div>
    )
  }

  const c = safeColor(tab?.color)
  const pendientes = items?.filter((i) => !i.completed).length ?? 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-9 w-1.5 shrink-0 rounded-pill"
          style={{ background: `linear-gradient(180deg, ${pastel(c, 1)}, ${pastel(c, 0.4)})` }}
        />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">{tab?.name ?? 'Pestaña'}</h1>
          <p className="text-xs text-text-muted">
            {items?.length ?? 0} tarea{items?.length === 1 ? '' : 's'} · {pendientes} pendiente
            {pendientes === 1 ? '' : 's'}
          </p>
        </div>

        <button onClick={() => setEditandoTab(true)} className="btn-ghost px-2.5 py-1 text-xs">
          Editar pestaña
        </button>

        <button onClick={() => setEditandoItem('new')} className="btn-primary ml-auto shrink-0">
          + Tarea
        </button>
      </div>

      {isLoading && <p className="text-sm italic text-text-muted">Cargando…</p>}
      {error && (
        <p className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">
          No se pudieron cargar las tareas. {error.message}
        </p>
      )}

      {!isLoading && !error && items?.length === 0 && (
        <div className="glass rounded-card px-4 py-10 text-center">
          <p className="text-sm text-text-secondary">Esta pestaña todavía no tiene tareas.</p>
          <button
            onClick={() => setEditandoItem('new')}
            className="mt-2 text-sm text-accent-text underline"
          >
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
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              tab={tab}
              onToggle={(completed) => toggle.mutate({ id: item.id, completed })}
              onEdit={() => setEditandoItem(item)}
              trailing={
                <button
                  onClick={() => navigate(`/dia?d=${item.date}`)}
                  className={`shrink-0 rounded-pill px-2.5 py-1 text-xs transition-colors ${
                    esHoy(item.date)
                      ? 'bg-accent/15 font-medium text-accent-text'
                      : 'text-text-muted hover:bg-white/5 hover:text-text-primary'
                  }`}
                  title="Ver ese día"
                >
                  {esHoy(item.date) ? 'Hoy' : formatCorto(item.date)}
                </button>
              }
            />
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

      {editandoTab && tab && <TabEditorModal tab={tab} onClose={() => setEditandoTab(false)} />}
    </div>
  )
}
