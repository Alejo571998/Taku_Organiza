import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTabs, useReorderTabs } from '@/hooks/useTabs'
import TabEditorModal from '@/components/tabs/TabEditorModal'
import { SortableList, SortableRow } from '@/components/ui/SortableList'
import type { TabWithFields } from '@/lib/queries/tabs'

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const { data: tabs, isLoading, error } = useTabs()
  const reorder = useReorderTabs()
  const [editingTab, setEditingTab] = useState<TabWithFields | 'new' | null>(null)

  return (
    <aside className="w-60 shrink-0 bg-surface-alt p-4 flex flex-col gap-1 h-full overflow-y-auto">
      <div className="mb-4">
        <p className="text-lg font-bold tracking-tight leading-none">TAKU</p>
        <p className="text-xs text-text-muted">Tu día, en orden.</p>
      </div>

      <p className="text-sm text-text-secondary mb-2">Pestañas</p>

      {isLoading && <p className="text-sm text-text-muted italic">Cargando...</p>}

      {/* Sin esto un error de carga se ve igual que "no hay pestañas", que es
          justo el caso en el que uno no sospecha que algo falló. */}
      {error && (
        <p className="text-sm text-danger">
          No se pudieron cargar las pestañas. {error.message}
        </p>
      )}

      {!isLoading && !error && (!tabs || tabs.length === 0) && (
        <p className="text-sm text-text-muted italic">Todavía no hay pestañas creadas.</p>
      )}

      {tabs && tabs.length > 0 && (
        <SortableList
          ids={tabs.map((t) => t.id)}
          onReorder={(ids) => reorder.mutate(ids)}
          className="flex flex-col gap-1"
        >
          {tabs.map((tab) => (
            <SortableRow
              key={tab.id}
              id={tab.id}
              className="flex items-center gap-1 rounded hover:bg-surface transition-colors"
            >
              <button
                onClick={() => setEditingTab(tab)}
                className="flex items-center gap-2 px-1 py-1.5 text-sm text-left flex-1 min-w-0"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: `var(--cat-${tab.color}-text)` }}
                />
                <span className="truncate">{tab.name}</span>
              </button>
            </SortableRow>
          ))}
        </SortableList>
      )}

      <button
        onClick={() => setEditingTab('new')}
        className="mt-3 text-sm rounded border border-border px-3 py-2 hover:bg-surface transition-colors"
      >
        + Nueva pestaña
      </button>

      <div className="mt-auto pt-4 border-t border-border">
        <p className="text-xs text-text-muted truncate mb-2">{user?.email}</p>
        <button
          onClick={() => signOut()}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Cerrar sesión
        </button>
      </div>

      {editingTab && (
        <TabEditorModal
          tab={editingTab === 'new' ? undefined : editingTab}
          onClose={() => setEditingTab(null)}
        />
      )}
    </aside>
  )
}
