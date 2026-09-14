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
import { itemColor, pastel } from '@/lib/palette'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import Chevron from '@/components/ui/Chevron'
import RepeatIcon from '@/components/ui/RepeatIcon'
import type { Item } from '@/types/database.types'

/**
 * Vista de lectura: tocar cualquier parte de un día lleva a la vista diaria.
 *
 * Los ítems NO abren el editor acá. Con el dedo es facilísimo pegarle a un
 * ítem queriendo tocar el día, y que eso abra un formulario de edición es
 * mucho peor que abrir una lista. Editar pasa solo en Día y en la lista de
 * la pestaña. La única excepción es el tilde, que es chico pero deliberado
 * y reversible de un toque.
 */
export default function WeekView() {
  const [date, setDate] = useSelectedDate()
  const navigate = useNavigate()

  const dias = weekDays(date)
  const from = dias[0]
  const to = dias[6]

  const { data: tabs } = useTabs()
  const { data: items, isLoading, error } = useItems(from, to)
  const toggle = useToggleItem(itemsKey(from, to))
  const [creando, setCreando] = useState<string | null>(null)

  const tabsById = new Map((tabs ?? []).map((t) => [t.id, t]))

  // Una sola pasada para agrupar por día, en vez de filtrar el array siete veces.
  const porDia = new Map<string, Item[]>(dias.map((d) => [d, []]))
  for (const item of items ?? []) porDia.get(item.date)?.push(item)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="glass flex shrink-0 items-center rounded-pill p-1">
          <button
            onClick={() => setDate(addDays(startOfWeek(date), -7))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Semana anterior"
          >
            <Chevron className="rotate-180" />
          </button>
          <button
            onClick={() => setDate(addDays(startOfWeek(date), 7))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Semana siguiente"
          >
            <Chevron />
          </button>
        </div>

        <h1 className="text-xl font-bold sm:text-2xl">
          {formatCorto(from)} – {formatCorto(to)}
        </h1>

        {!dias.some(esHoy) && (
          <button onClick={() => setDate(todayISO())} className="btn-ghost px-2.5 py-1 text-xs">
            Esta semana
          </button>
        )}

        <button
          onClick={() => setCreando(dias.some(esHoy) ? todayISO() : from)}
          disabled={!tabs || tabs.length === 0}
          className="btn-primary ml-auto shrink-0"
        >
          + Tarea
        </button>
      </div>

      {isLoading && <p className="text-sm italic text-text-muted">Cargando…</p>}
      {error && (
        <p className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">
          No se pudieron cargar las tareas. {error.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {dias.map((dia, i) => {
          const delDia = porDia.get(dia) ?? []
          const hoy = esHoy(dia)
          return (
            <div
              key={dia}
              onClick={() => navigate(`/dia?d=${dia}`)}
              className={`glass flex min-h-36 cursor-pointer flex-col rounded-card p-2.5 transition-colors hover:bg-white/[0.08] ${
                hoy ? 'ring-1 ring-accent/40' : ''
              }`}
              style={hoy ? { background: 'rgb(var(--color-accent) / 0.07)' } : undefined}
            >
              {/* Botón real para que el día también se pueda abrir con teclado:
                  un div con onClick no recibe foco. */}
              <button
                onClick={() => navigate(`/dia?d=${dia}`)}
                className="mb-2 flex items-baseline gap-1.5 text-left"
                title="Ver el día"
              >
                <span className="text-[11px] uppercase tracking-wide text-text-muted">
                  {DIAS_SEMANA[i]}
                </span>
                <span
                  className={`text-sm font-semibold ${hoy ? 'text-accent-text' : 'text-text-primary'}`}
                >
                  {diaDelMes(dia)}
                </span>
              </button>

              <ul className="flex flex-col gap-1.5">
                {delDia.map((item) => {
                  const c = itemColor(item.color, tabsById.get(item.tab_id)?.color)
                  return (
                    <li key={item.id} className="flex items-start gap-1.5">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          toggle.mutate({ id: item.id, completed: e.target.checked })
                        }
                        className="mt-[3px] shrink-0 scale-90"
                        aria-label={`Marcar "${item.title}"`}
                      />
                      <span
                        className="min-w-0 flex-1 rounded-lg py-0.5 pl-2 pr-1.5 text-xs leading-snug"
                        style={{
                          background: pastel(c, 0.12),
                          borderLeft: `2px solid ${pastel(c, item.completed ? 0.3 : 0.85)}`
                        }}
                      >
                        <span
                          className={`flex items-center gap-1 ${
                            item.completed ? 'text-text-muted line-through' : 'text-text-primary'
                          }`}
                        >
                          {item.recurrence && (
                            <RepeatIcon className="shrink-0" style={{ color: pastel(c, 0.8) }} />
                          )}
                          <span className="truncate">{item.title}</span>
                          {item.note && (
                            <span
                              aria-label="Tiene nota"
                              title="Tiene nota"
                              className="ml-auto shrink-0 text-[10px]"
                              style={{ color: pastel(c, 0.9) }}
                            >
                              ●
                            </span>
                          )}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>

              {/* Relleno: el hueco de la tarjeta sigue siendo zona de toque. */}
              <div className="min-h-6 flex-1" />
            </div>
          )
        })}
      </div>

      {creando && tabs && (
        <ItemEditorModal tabs={tabs} defaultDate={creando} onClose={() => setCreando(null)} />
      )}
    </div>
  )
}
