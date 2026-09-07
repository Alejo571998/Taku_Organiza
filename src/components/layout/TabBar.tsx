import { useState } from 'react'
import { useTabs, useReorderTabs } from '@/hooks/useTabs'
import { useSelectedTab } from '@/hooks/useSelectedTab'
import TabEditorModal from '@/components/tabs/TabEditorModal'
import { SortableList, SortableRow } from '@/components/ui/SortableList'
import type { TabWithFields } from '@/lib/queries/tabs'

/**
 * Barra de pestañas al pie, estilo planilla de cálculo.
 *
 * El botón de crear va primero y fijo (sticky) para que no se pierda cuando
 * la lista se hace larga y hay que scrollear.
 *
 * Un click cambia la pestaña activa, que filtra todas las vistas; para editar
 * hay que tocar el lápiz, que aparece solo en la activa. Si el click abriera
 * el editor, tocar una pestaña para "ir a ella" —el gesto natural con esta
 * forma— daría un diálogo en vez de navegar.
 */
export default function TabBar() {
  const { data: tabs, isLoading, error } = useTabs()
  const reorder = useReorderTabs()
  const [tabId, setTabId] = useSelectedTab()
  const [editando, setEditando] = useState<TabWithFields | 'new' | null>(null)

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface-alt">
        <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-1.5">
          <button
            onClick={() => setEditando('new')}
            className="sticky left-0 z-10 shrink-0 rounded bg-surface border border-border px-3 py-1.5 text-sm font-medium hover:bg-bg transition-colors whitespace-nowrap"
          >
            + Nueva pestaña
          </button>

          {tabs && tabs.length > 0 && (
            <button
              onClick={() => setTabId(null)}
              className={`shrink-0 rounded px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                tabId === null
                  ? 'bg-surface font-medium shadow-sm'
                  : 'text-text-secondary hover:bg-surface/60'
              }`}
            >
              Todas
            </button>
          )}

          {isLoading && <span className="px-2 py-1.5 text-sm text-text-muted italic">Cargando…</span>}
          {error && (
            <span className="px-2 py-1.5 text-sm text-danger">No se pudieron cargar las pestañas.</span>
          )}

          {tabs && tabs.length > 0 && (
            <SortableList
              ids={tabs.map((t) => t.id)}
              onReorder={(ids) => reorder.mutate(ids)}
              className="flex items-stretch gap-1"
            >
              {tabs.map((tab) => {
                const activa = tab.id === tabId
                return (
                  <SortableRow
                    key={tab.id}
                    id={tab.id}
                    className={`flex shrink-0 items-center rounded px-1 transition-shadow ${
                      activa ? 'shadow-sm ring-1 ring-border' : ''
                    }`}
                    style={{
                      background: `var(--cat-${tab.color})`,
                      color: `var(--cat-${tab.color}-text)`
                    }}
                  >
                    <button
                      onClick={() => setTabId(tab.id)}
                      className={`py-1.5 px-1 text-sm whitespace-nowrap max-w-40 truncate ${
                        activa ? 'font-semibold' : ''
                      }`}
                      title={tab.name}
                    >
                      {tab.name}
                    </button>
                    {activa && (
                      <button
                        onClick={() => setEditando(tab)}
                        className="shrink-0 px-1 opacity-70 hover:opacity-100"
                        aria-label={`Editar "${tab.name}"`}
                        title="Editar pestaña"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    )}
                  </SortableRow>
                )
              })}
            </SortableList>
          )}
        </div>
      </div>

      {editando && (
        <TabEditorModal
          tab={editando === 'new' ? undefined : editando}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  )
}
