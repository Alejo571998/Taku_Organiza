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
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setDate(monthStart(addMonths(mes, -1)))}
          className="border border-border rounded p-1.5 hover:bg-surface-alt transition-colors"
          aria-label="Mes anterior"
        >
          <Chevron className="rotate-180" />
        </button>
        <button
          onClick={() => setDate(monthStart(addMonths(mes, 1)))}
          className="border border-border rounded p-1.5 hover:bg-surface-alt transition-colors"
          aria-label="Mes siguiente"
        >
          <Chevron />
        </button>
        <h1 className="text-xl font-bold first-letter:uppercase">{formatMesLargo(mes)}</h1>
        {mes !== monthKey(todayISO()) && (
          <button
            onClick={() => setDate(todayISO())}
            className="text-sm text-accent-text underline ml-1"
          >
            Este mes
          </button>
        )}
        <button
          onClick={() => setCreando(mes === monthKey(todayISO()) ? todayISO() : monthStart(mes))}
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

      <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-card overflow-hidden">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="bg-surface-alt text-xs text-text-secondary text-center py-1.5">
            {d}
          </div>
        ))}

        {celdas.map((dia) => {
          const delDia = porDia.get(dia) ?? []
          const delMes = monthKey(dia) === mes
          const visibles = delDia.slice(0, MAX_VISIBLES)
          const resto = delDia.length - visibles.length

          return (
            <div
              key={dia}
              onClick={() => navigate(`/dia?d=${dia}`)}
              className={`flex min-h-24 cursor-pointer flex-col gap-1 bg-surface p-1.5 transition-colors hover:bg-surface-alt ${
                delMes ? '' : 'opacity-40'
              }`}
            >
              <button
                onClick={() => navigate(`/dia?d=${dia}`)}
                className={`text-xs self-start rounded px-1 ${
                  esHoy(dia)
                    ? 'bg-accent text-white font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Ver el día"
              >
                {diaDelMes(dia)}
              </button>

              {visibles.map((item) => {
                const tab = tabsById.get(item.tab_id)
                return (
                  <span
                    key={item.id}
                    className="truncate rounded px-1 py-0.5 text-[11px] leading-tight"
                    style={{
                      background: `var(--cat-${tab?.color ?? 'peach'})`,
                      color: `var(--cat-${tab?.color ?? 'peach'}-text)`
                    }}
                    title={item.title}
                  >
                    <span className={item.completed ? 'line-through opacity-60' : ''}>
                      {item.title}
                    </span>
                  </span>
                )
              })}

              {resto > 0 && (
                <span className="px-1 text-[11px] text-text-muted">+{resto} más</span>
              )}

              {/* Relleno: el hueco de la celda sigue siendo zona de toque. */}
              <div className="min-h-4 flex-1" />
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
