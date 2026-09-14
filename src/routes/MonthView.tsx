import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTabs } from '@/hooks/useTabs'
import { useItems } from '@/hooks/useItems'
import { useSelectedDate } from '@/hooks/useSelectedDate'
import {
  monthKey,
  monthStart,
  addMonths,
  monthGrid,
  formatMesLargo,
  esHoy,
  todayISO,
  diaDelMes,
  DIAS_SEMANA
} from '@/lib/dates'
import { itemColor, pastel } from '@/lib/palette'
import ItemEditorModal from '@/components/items/ItemEditorModal'
import Chevron from '@/components/ui/Chevron'
import type { Item } from '@/types/database.types'

/** Cuántos ítems se listan en una celda antes de resumir el resto. */
const MAX_VISIBLES = 3

/**
 * Vista de lectura: tocar cualquier parte de un día lleva a la vista diaria.
 *
 * Los ítems son etiquetas, no botones. En una celda de mes miden 11px y con
 * el dedo es casi imposible tocar el día sin rozar uno; que eso abriera el
 * editor convertía un gesto de navegación en uno de edición. Se edita solo
 * en Día y en la lista de la pestaña.
 */
export default function MonthView() {
  const [date, setDate] = useSelectedDate()
  const navigate = useNavigate()

  const mes = monthKey(date)
  const celdas = monthGrid(mes)
  // El rango pedido cubre toda la grilla, no solo el mes: las celdas de los
  // meses vecinos también muestran sus ítems.
  const from = celdas[0]
  const to = celdas[celdas.length - 1]

  const { data: tabs } = useTabs()
  const { data: items, isLoading, error } = useItems(from, to)
  const [creando, setCreando] = useState<string | null>(null)

  const tabsById = new Map((tabs ?? []).map((t) => [t.id, t]))

  const porDia = new Map<string, Item[]>()
  for (const item of items ?? []) {
    const lista = porDia.get(item.date)
    if (lista) lista.push(item)
    else porDia.set(item.date, [item])
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="glass flex shrink-0 items-center rounded-pill p-1">
          <button
            onClick={() => setDate(monthStart(addMonths(mes, -1)))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Mes anterior"
          >
            <Chevron className="rotate-180" />
          </button>
          <button
            onClick={() => setDate(monthStart(addMonths(mes, 1)))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Mes siguiente"
          >
            <Chevron />
          </button>
        </div>

        <h1 className="text-xl font-bold first-letter:uppercase sm:text-2xl">
          {formatMesLargo(mes)}
        </h1>

        {mes !== monthKey(todayISO()) && (
          <button onClick={() => setDate(todayISO())} className="btn-ghost px-2.5 py-1 text-xs">
            Este mes
          </button>
        )}

        <button
          onClick={() => setCreando(mes === monthKey(todayISO()) ? todayISO() : monthStart(mes))}
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

      <div className="glass grid grid-cols-7 gap-px overflow-hidden rounded-card">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="bg-white/[0.04] py-2 text-center text-[11px] uppercase tracking-wide text-text-muted"
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.charAt(0)}</span>
          </div>
        ))}

        {celdas.map((dia) => {
          const delDia = porDia.get(dia) ?? []
          const delMes = monthKey(dia) === mes
          const visibles = delDia.slice(0, MAX_VISIBLES)
          const resto = delDia.length - visibles.length
          const hoy = esHoy(dia)

          return (
            <div
              key={dia}
              onClick={() => navigate(`/dia?d=${dia}`)}
              className={`flex min-h-24 cursor-pointer flex-col gap-1 p-1.5 transition-colors hover:bg-white/[0.06] ${
                delMes ? 'bg-black/20' : 'bg-black/40 opacity-45'
              }`}
            >
              {/* Botón real para que el día también se abra con teclado:
                  un div con onClick no recibe foco. */}
              <button
                onClick={() => navigate(`/dia?d=${dia}`)}
                className={`grid h-6 w-6 shrink-0 place-items-center self-start rounded-full text-xs transition-colors ${
                  hoy
                    ? 'bg-accent font-bold text-[rgb(6,26,18)]'
                    : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'
                }`}
                title="Ver el día"
              >
                {diaDelMes(dia)}
              </button>

              {/* En pantallas chicas la celda mide ~48px: el título entraría
                  en tres letras. Ahí se muestran puntos de color, que es lo
                  que una grilla de mes necesita comunicar a ese tamaño. */}
              <div className="flex flex-wrap gap-1 sm:hidden">
                {delDia.slice(0, 6).map((item) => {
                  const c = itemColor(item.color, tabsById.get(item.tab_id)?.color)
                  return (
                    <span
                      key={item.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: pastel(c, item.completed ? 0.3 : 0.95) }}
                      title={item.title}
                    />
                  )
                })}
              </div>

              <div className="hidden flex-col gap-1 sm:flex">
                {visibles.map((item) => {
                  const c = itemColor(item.color, tabsById.get(item.tab_id)?.color)
                  return (
                    <span
                      key={item.id}
                      className="truncate rounded py-0.5 pl-1.5 pr-1 text-[11px] leading-tight"
                      style={{
                        background: pastel(c, 0.13),
                        borderLeft: `2px solid ${pastel(c, item.completed ? 0.3 : 0.8)}`,
                        color: item.completed
                          ? 'rgb(var(--color-text-muted))'
                          : 'rgb(var(--color-text-primary))'
                      }}
                      title={item.note ? `${item.title} — ${item.note}` : item.title}
                    >
                      <span className={item.completed ? 'line-through' : ''}>{item.title}</span>
                    </span>
                  )
                })}

                {resto > 0 && (
                  <span className="px-1 text-[11px] text-text-muted">+{resto} más</span>
                )}
              </div>

              {/* Relleno: el hueco de la celda sigue siendo zona de toque. */}
              <div className="min-h-3 flex-1" />
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
