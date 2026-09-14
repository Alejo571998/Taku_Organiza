import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTabs, useReorderTabs } from '@/hooks/useTabs'
import TabEditorModal from '@/components/tabs/TabEditorModal'
import { SortableList, SortableRow } from '@/components/ui/SortableList'
import { pastel, safeColor } from '@/lib/palette'
import type { TabWithFields } from '@/lib/queries/tabs'

/**
 * Barra de pestañas al pie, estilo planilla de cálculo.
 *
 * El botón de crear va primero y fijo (sticky) para que no se pierda cuando
 * la lista se hace larga y hay que scrollear.
 *
 * Tocar una pestaña abre su lista completa de tareas (/pestana/:id); el lápiz,
 * que aparece solo en la activa, edita la pestaña en sí. Van separados porque
 * con forma de solapa el gesto natural es "ir a ella", no "configurarla".
 */
export default function TabBar() {
  const { data: tabs, isLoading, error } = useTabs()
  const reorder = useReorderTabs()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [editando, setEditando] = useState<TabWithFields | 'new' | null>(null)

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07]"
        style={{
          background: 'rgb(5 8 18 / 0.72)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          // Respeta la barra de gestos del iPhone.
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <div className="flex items-stretch gap-1.5 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setEditando('new')}
            className="sticky left-0 z-10 shrink-0 rounded-pill border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm font-medium whitespace-nowrap backdrop-blur transition-colors hover:bg-white/10"
          >
            + Nueva pestaña
          </button>

          {isLoading && (
            <span className="px-2 py-2 text-sm italic text-text-muted">Cargando…</span>
          )}
          {error && (
            <span className="px-2 py-2 text-sm text-danger">
              No se pudieron cargar las pestañas.
            </span>
          )}

          {tabs && tabs.length > 0 && (
            <SortableList
              ids={tabs.map((t) => t.id)}
              onReorder={(ids) => reorder.mutate(ids)}
              className="flex items-stretch gap-1.5"
            >
              {tabs.map((tab) => {
                const activa = pathname === `/pestana/${tab.id}`
                const c = safeColor(tab.color)
                return (
                  <SortableRow
                    key={tab.id}
                    id={tab.id}
                    className="flex shrink-0 items-center rounded-pill px-1 transition-all"
                    style={{
                      background: activa ? pastel(c, 0.2) : 'rgb(255 255 255 / 0.05)',
                      boxShadow: activa ? `inset 0 0 0 1px ${pastel(c, 0.45)}` : undefined
                    }}
                  >
                    <button
                      onClick={() => navigate(`/pestana/${tab.id}`)}
                      className="flex max-w-40 items-center gap-1.5 truncate px-1.5 py-1.5 text-sm whitespace-nowrap"
                      style={{ color: activa ? pastel(c, 1) : undefined }}
                      title={`Ver las tareas de "${tab.name}"`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: pastel(c, 1) }}
                      />
                      <span className={`truncate ${activa ? 'font-semibold' : ''}`}>
                        {tab.name}
                      </span>
                    </button>
                    {activa && (
                      <button
                        onClick={() => setEditando(tab)}
                        className="shrink-0 px-1 opacity-70 transition-opacity hover:opacity-100"
                        style={{ color: pastel(c, 1) }}
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
