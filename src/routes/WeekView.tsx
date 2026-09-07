import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTabs } from '@/hooks/useTabs'
import { useItems, useToggleItem, itemsKey } from '@/hooks/useItems'
import { useSelectedDate } from '@/hooks/useSelectedDate'
import {
  addDays,
  weekDays,
  startOfWeek,
  formatCorto,
  esHoy,
  todayISO,
  diaDelMes,
  DIAS_SEMANA
} from '@/lib/dates'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import Chevron from '@/components/ui/Chevron'
import type { Item } from '@/types/database.types'

export default function WeekView() {
  const [date, setDate] = useSelectedDate()
  const navigate = useNavigate()

  const dias = weekDays(date)
  const from = dias[0]
  const to = dias[6]

  const { data: tabs } = useTabs()
  const { data: items, isLoading, error } = useItems(from, to)
  const toggle = useToggleItem(itemsKey(from, to))
  const [editing, setEditing] = useState<Item | { dia: string } | null>(null)

  const tabsById = new Map((tabs ?? []).map((t) => [t.id, t]))

  // Un solo pasada para agrupar por día, en vez de filtrar el array siete veces.
  const porDia = new Map<string, Item[]>(dias.map((d) => [d, []]))
  for (const item of items ?? []) porDia.get(item.date)?.push(item)

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setDate(addDays(startOfWeek(date), -7))}
          className="border border-border rounded p-1.5 hover:bg-surface-alt transition-colors"
          aria-label="Semana anterior"
        >
          <Chevron className="rotate-180" />
        </button>
        <button
          onClick={() => setDate(addDays(startOfWeek(date), 7))}
          className="border border-border rounded p-1.5 hover:bg-surface-alt transition-colors"
          aria-label="Semana siguiente"
        >
          <Chevron />
        </button>
        <h1 className="text-xl font-bold">
          {formatCorto(from)} – {formatCorto(to)}
        </h1>
        {!dias.some(esHoy) && (
          <button
            onClick={() => setDate(todayISO())}
            className="text-sm text-accent-text underline ml-1"
          >
            Esta semana
          </button>
        )}
        <button
          onClick={() => setEditing({ dia: dias.some(esHoy) ? todayISO() : from })}
          disabled={!tabs || tabs.length === 0}
          className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          + Ítem
        </button>
      </div>

      {isLoading && <p className="text-sm text-text-muted italic">Cargando...</p>}
      {error && (
        <p className="text-sm text-danger">No se pudieron cargar los ítems. {error.message}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {dias.map((dia, i) => {
          const delDia = porDia.get(dia) ?? []
          return (
            <div
              key={dia}
              className={`rounded-card border p-2 min-h-32 flex flex-col ${
                esHoy(dia) ? 'border-accent bg-accent-soft/25' : 'border-border bg-surface'
              }`}
            >
              <button
                onClick={() => navigate(`/dia?d=${dia}`)}
                className="flex items-baseline gap-1.5 mb-2 text-left"
                title="Ver el día"
              >
                <span className="text-xs text-text-secondary">{DIAS_SEMANA[i]}</span>
                <span className={`text-sm ${esHoy(dia) ? 'font-bold text-accent-text' : ''}`}>
                  {diaDelMes(dia)}
                </span>
              </button>

              <ul className="flex flex-col gap-1">
                {delDia.map((item) => {
                  const tab = tabsById.get(item.tab_id)
                  return (
                    <li key={item.id} className="flex items-start gap-1.5">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={(e) =>
                          toggle.mutate({ id: item.id, completed: e.target.checked })
                        }
                        className="mt-[3px] shrink-0"
                        aria-label={`Marcar "${item.title}"`}
                      />
                      <button
                        onClick={() => setEditing(item)}
                        className="text-left text-xs leading-snug flex-1 min-w-0 rounded px-1 py-0.5"
                        style={{
                          background: `var(--cat-${tab?.color ?? 'peach'})`,
                          color: `var(--cat-${tab?.color ?? 'peach'}-text)`
                        }}
                      >
                        <span className={item.completed ? 'line-through opacity-60' : ''}>
                          {item.title}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {/* Relleno clickeable: tocar el hueco de la tarjeta lleva al
                  día, sin robarle el click a los ítems. */}
              <button
                onClick={() => navigate(`/dia?d=${dia}`)}
                className="min-h-6 flex-1"
                aria-label={`Ver el día ${dia}`}
                title="Ver el día"
              />

              <button
                onClick={() => setEditing({ dia })}
                disabled={!tabs || tabs.length === 0}
                className="mt-2 text-xs text-text-muted hover:text-text-primary text-left disabled:opacity-40"
              >
                + Agregar
              </button>
            </div>
          )
        })}
      </div>

      {editing && tabs && (
        <ItemEditorModal
          tabs={tabs}
          item={'id' in editing ? editing : undefined}
          defaultDate={'id' in editing ? editing.date : editing.dia}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
