import { useMemo, useState } from 'react'
import { useHabitos, useMarcas, useMarcarHabito } from '@/hooks/useHabitos'
import {
  currentMonthKey,
  addMonths,
  monthStart,
  monthEnd,
  formatMesLargo,
  todayISO,
  diaDelMes,
  fromISODate,
  addDays
} from '@/lib/dates'
import { safeColor, pastel } from '@/lib/palette'
import Chevron from '@/components/ui/Chevron'
import TakuVacio from '@/components/taku/TakuVacio'
import HabitoEditorModal from '@/components/habitos/HabitoEditorModal'
import type { Habit } from '@/types/database.types'

/** Los días del mes, en ISO. */
function diasDelMes(mes: string): string[] {
  const desde = monthStart(mes)
  const hasta = monthEnd(mes)
  const dias: string[] = []
  for (let d = desde; d <= hasta; d = addDays(d, 1)) dias.push(d)
  return dias
}

/** Un hábito corre ese día si no eligió días, o si el día está elegido. */
function corre(h: Habit, iso: string): boolean {
  if (h.weekdays.length === 0) return true
  return h.weekdays.includes(fromISODate(iso).getDay())
}

/**
 * Racha: días seguidos cumplidos hasta hoy, contando solo los días en que el
 * hábito corre. Si alguien se propone caminar los lunes, no romperle la racha
 * un martes es la diferencia entre una herramienta y un reproche.
 *
 * El día de hoy todavía sin marcar no corta la racha: el día no terminó.
 */
function racha(h: Habit, hechos: Set<string>, hoy: string): number {
  let dias = 0
  let cursor = hoy
  let primero = true
  for (let i = 0; i < 400; i++) {
    if (corre(h, cursor)) {
      if (hechos.has(`${h.id}|${cursor}`)) dias++
      else if (!primero) break
      else if (cursor !== hoy) break
    }
    primero = false
    cursor = addDays(cursor, -1)
  }
  return dias
}

export default function HabitosView() {
  const [mes, setMes] = useState(currentMonthKey())
  const [editando, setEditando] = useState<Habit | 'nuevo' | null>(null)

  const hasta = monthEnd(mes)
  const hoy = todayISO()

  const { data: habitos, isLoading, error } = useHabitos()
  // La racha puede venir de antes del mes que se está mirando, así que se
  // piden tres meses hacia atrás: con el mes solo, todo arrancaría en cero
  // cada día 1.
  const { data: marcas } = useMarcas(monthStart(addMonths(mes, -3)), hasta)
  const marcar = useMarcarHabito(monthStart(addMonths(mes, -3)), hasta)

  const hechos = useMemo(
    () => new Set((marcas ?? []).map((m) => `${m.habit_id}|${m.date}`)),
    [marcas]
  )
  const dias = useMemo(() => diasDelMes(mes), [mes])
  const activos = (habitos ?? []).filter((h) => h.active)

  const deHoy = activos.filter((h) => corre(h, hoy))
  const cumplidosHoy = deHoy.filter((h) => hechos.has(`${h.id}|${hoy}`)).length

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="glass flex shrink-0 items-center rounded-pill p-1">
          <button
            onClick={() => setMes(addMonths(mes, -1))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Mes anterior"
          >
            <Chevron className="rotate-180" />
          </button>
          <button
            onClick={() => setMes(addMonths(mes, 1))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Mes siguiente"
          >
            <Chevron />
          </button>
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold first-letter:uppercase sm:text-2xl">
            Hábitos
          </h1>
          <p className="text-xs capitalize text-text-muted">{formatMesLargo(mes)}</p>
        </div>

        <button onClick={() => setEditando('nuevo')} className="btn-primary ml-auto shrink-0">
          + Hábito
        </button>
      </div>

      {isLoading && <p className="text-sm italic text-text-muted">Cargando…</p>}
      {error && (
        <p className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">
          No se pudieron cargar los hábitos. {error.message}
        </p>
      )}

      {habitos && activos.length === 0 ? (
        <TakuVacio
          titulo="Todavía no seguís ningún hábito"
          detalle="Elegí algo chico y concreto: caminar, leer diez minutos, tomar agua. Lo importante no es el tamaño, es la cadena de días."
          accion={
            <button onClick={() => setEditando('nuevo')} className="btn-primary">
              Crear el primero
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Hoy primero: es la única parte con la que se interactúa a diario.
              La grilla del mes es para mirar, no para marcar. */}
          {deHoy.length > 0 && (
            <div className="glass rounded-card px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Hoy</h2>
                <span className="text-xs text-text-muted">
                  {cumplidosHoy} de {deHoy.length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {deHoy.map((h) => {
                  const hecho = hechos.has(`${h.id}|${hoy}`)
                  const c = safeColor(h.color)
                  return (
                    <label
                      key={h.id}
                      className="flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 transition-colors"
                      style={{
                        backgroundImage: `linear-gradient(90deg, ${pastel(c, hecho ? 0.3 : 0.85)} 0px, ${pastel(c, hecho ? 0.3 : 0.85)} 5px, ${pastel(c, hecho ? 0.1 : 0.3)} 5px, transparent 70%)`
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={hecho}
                        onChange={(e) =>
                          marcar.mutate({ habitId: h.id, date: hoy, hecho: e.target.checked })
                        }
                        className="shrink-0"
                        aria-label={`Marcar "${h.name}" como hecho hoy`}
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          hecho ? 'text-text-muted line-through' : ''
                        }`}
                      >
                        {h.name}
                      </span>
                      <Racha dias={racha(h, hechos, hoy)} color={c} />
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Grilla del mes. Scrollea en horizontal: con 31 columnas, en un
              celular cada celda quedaría de dos píxeles. */}
          <div className="glass rounded-card px-4 py-4">
            <h2 className="mb-3 text-sm font-semibold">El mes</h2>
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="mb-1 flex gap-[3px] pl-32">
                  {dias.map((d) => (
                    <span
                      key={d}
                      className={`w-[18px] text-center text-[9px] ${
                        d === hoy ? 'font-bold text-accent-text' : 'text-text-muted'
                      }`}
                    >
                      {diaDelMes(d)}
                    </span>
                  ))}
                </div>

                {activos.map((h) => {
                  const c = safeColor(h.color)
                  return (
                    <div key={h.id} className="mb-[3px] flex items-center gap-[3px]">
                      <button
                        onClick={() => setEditando(h)}
                        className="w-32 shrink-0 truncate pr-2 text-left text-xs transition-colors hover:text-accent-text"
                        title={`Editar "${h.name}"`}
                      >
                        {h.name}
                      </button>
                      {dias.map((d) => {
                        const aplica = corre(h, d)
                        const hecho = hechos.has(`${h.id}|${d}`)
                        const futuro = d > hoy
                        return (
                          <button
                            key={d}
                            disabled={futuro || !aplica}
                            onClick={() =>
                              marcar.mutate({ habitId: h.id, date: d, hecho: !hecho })
                            }
                            title={`${h.name} · ${d}`}
                            aria-label={`${h.name}, ${d}, ${hecho ? 'hecho' : 'sin hacer'}`}
                            className={`h-[18px] w-[18px] shrink-0 rounded-[5px] transition-transform ${
                              futuro || !aplica ? 'cursor-default' : 'hover:scale-110'
                            }`}
                            style={{
                              background: hecho
                                ? pastel(c, 0.95)
                                : !aplica
                                  ? 'rgb(255 255 255 / 0.02)'
                                  : futuro
                                    ? 'rgb(255 255 255 / 0.03)'
                                    : 'rgb(255 255 255 / 0.07)',
                              outline: d === hoy ? '1px solid rgb(var(--color-accent) / 0.6)' : undefined
                            }}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Las casillas apagadas son días en que el hábito no corre. Tocá cualquier día para
              marcarlo o desmarcarlo.
            </p>
          </div>
        </div>
      )}

      {editando && (
        <HabitoEditorModal
          habito={editando === 'nuevo' ? undefined : editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function Racha({ dias, color }: { dias: number; color: ReturnType<typeof safeColor> }) {
  if (dias < 2) return null
  return (
    <span
      className="shrink-0 rounded-pill px-2 py-0.5 text-xs font-medium"
      style={{ background: pastel(color, 0.18), color: pastel(color, 1) }}
      title={`${dias} días seguidos`}
    >
      {dias} días
    </span>
  )
}
