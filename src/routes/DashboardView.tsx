import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useItems } from '@/hooks/useItems'
import { useCategorias, useMovimientos, useFinSettings } from '@/hooks/useFinanzas'
import { useHabitos, useMarcas, useMarcarHabito } from '@/hooks/useHabitos'
import {
  currentMonthKey,
  monthStart,
  monthEnd,
  formatMesLargo,
  formatMes,
  todayISO,
  diaDelMes,
  fromISODate
} from '@/lib/dates'
import { resumenMes, resumenAnual } from '@/lib/balance'
import { formatARS, formatCompacto } from '@/lib/dinero'
import { safeColor, pastel } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import type { Habit } from '@/types/database.types'

/**
 * El resumen: lo que pasa hoy y cómo viene el mes, en una pantalla.
 *
 * No reemplaza a ninguna vista, las resume. Día, Semana, Mes y las pestañas
 * siguen intactas y son el lugar donde se trabaja; acá se mira.
 */
export default function DashboardView() {
  const hoy = todayISO()
  const mes = currentMonthKey()
  const anio = Number(mes.slice(0, 4))

  // El año entero en una sola consulta: sirve para el mes y para la tira
  // anual, y pedir las dos cosas por separado traería el mes dos veces.
  const { data: movimientos } = useMovimientos(`${anio}-01-01`, `${anio}-12-31`)
  const { data: categorias } = useCategorias()
  const { data: settings } = useFinSettings()
  const { data: tareas } = useItems(hoy, hoy)
  const { data: habitos } = useHabitos()
  const { data: marcas } = useMarcas(monthStart(mes), monthEnd(mes))
  const marcar = useMarcarHabito(monthStart(mes), monthEnd(mes))

  const resumen = useMemo(
    () => resumenMes(mes, movimientos ?? [], categorias ?? [], hoy),
    [mes, movimientos, categorias, hoy]
  )
  const anual = useMemo(() => resumenAnual(anio, movimientos ?? []), [anio, movimientos])

  const hechos = useMemo(
    () => new Set((marcas ?? []).map((m) => `${m.habit_id}|${m.date}`)),
    [marcas]
  )

  const pendientes = (tareas ?? []).filter((t) => !t.completed).length
  const activos = (habitos ?? []).filter((h) => h.active)
  const corre = (h: Habit, iso: string) =>
    h.weekdays.length === 0 || h.weekdays.includes(fromISODate(iso).getDay())
  const deHoy = activos.filter((h) => corre(h, hoy))
  const cumplidosHoy = deHoy.filter((h) => hechos.has(`${h.id}|${hoy}`)).length

  const ingresoEsperado = settings?.monthly_income ?? 0
  const disponible = ingresoEsperado > 0 ? ingresoEsperado - resumen.gastos : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Resumen</h1>
        <p className="text-sm capitalize text-text-muted">{formatMesLargo(mes)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          titulo="Gastos del mes"
          valor={formatARS(resumen.gastos)}
          detalle={
            resumen.promedioDiario > 0 ? `${formatARS(resumen.promedioDiario)} por día` : undefined
          }
          tono="coral"
          a="/finanzas"
        />
        <Tarjeta
          titulo="Balance"
          valor={formatARS(resumen.balance)}
          detalle={
            disponible !== null
              ? `${disponible >= 0 ? 'Queda' : 'Falta'} ${formatARS(Math.abs(disponible))}`
              : 'Poné tu ingreso mensual'
          }
          tono={resumen.balance >= 0 ? 'mint' : 'coral'}
          a="/finanzas"
        />
        <Tarjeta
          titulo="Tareas de hoy"
          valor={String(pendientes)}
          detalle={pendientes === 0 ? 'Todo listo' : 'pendientes'}
          tono="sky"
          a="/dia"
        />
        <Tarjeta
          titulo="Hábitos de hoy"
          valor={deHoy.length === 0 ? '—' : `${cumplidosHoy}/${deHoy.length}`}
          detalle={deHoy.length === 0 ? 'Sin hábitos' : 'cumplidos'}
          tono="lavender"
          a="/habitos"
        />
      </div>

      {resumen.vencido > 0 && (
        <Link
          to="/finanzas"
          className="glass flex items-center gap-2 rounded-card px-4 py-3 text-sm transition-colors hover:bg-white/[0.07]"
          style={{ boxShadow: `inset 3px 0 0 0 ${pastel('coral', 0.9)}` }}
        >
          <span className="font-medium text-danger">{formatARS(resumen.vencido)} vencido</span>
          <span className="text-text-secondary">sin pagar</span>
          <span className="ml-auto text-xs text-accent-text">Ver</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-card px-4 py-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Gasto del mes, día por día</h2>
          <GastoPorDia resumen={resumen} hoy={hoy} />
        </div>

        <div className="glass rounded-card px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold">En qué se fue</h2>
          <PorCategoria resumen={resumen} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-card px-4 py-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Hábitos</h2>
            <Link to="/habitos" className="text-xs text-accent-text underline">
              Ver todo
            </Link>
          </div>
          {deHoy.length === 0 ? (
            <p className="text-sm text-text-muted">
              Todavía no seguís ninguno.{' '}
              <Link to="/habitos" className="text-accent-text underline">
                Crear el primero
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {deHoy.map((h) => {
                const hecho = hechos.has(`${h.id}|${hoy}`)
                const c = safeColor(h.color)
                return (
                  <label
                    key={h.id}
                    className="flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${pastel(c, hecho ? 0.3 : 0.85)} 0px, ${pastel(c, hecho ? 0.3 : 0.85)} 5px, ${pastel(c, hecho ? 0.08 : 0.26)} 5px, transparent 65%)`
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hecho}
                      onChange={(e) =>
                        marcar.mutate({ habitId: h.id, date: hoy, hecho: e.target.checked })
                      }
                      className="shrink-0"
                      aria-label={`Marcar "${h.name}"`}
                    />
                    <span className={`truncate text-sm ${hecho ? 'text-text-muted line-through' : ''}`}>
                      {h.name}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-card px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold">Mes a mes</h2>
          <PorMes anual={anual} />
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------

function Tarjeta({
  titulo,
  valor,
  detalle,
  tono,
  a
}: {
  titulo: string
  valor: string
  detalle?: string
  tono: PaletteKey
  a: string
}) {
  return (
    <Link
      to={a}
      className="glass rounded-card px-4 py-3.5 transition-colors hover:bg-white/[0.07]"
    >
      <p className="text-xs text-text-muted">{titulo}</p>
      <p
        className="mt-1 truncate text-lg font-bold sm:text-2xl"
        style={{ color: pastel(tono, 1) }}
        title={valor}
      >
        {valor}
      </p>
      {detalle && <p className="mt-0.5 truncate text-xs text-text-muted">{detalle}</p>}
    </Link>
  )
}

/**
 * Área acumulada del gasto a lo largo del mes.
 *
 * Acumulada y no día por día a propósito: el gasto diario suelto es ruido
 * —un día cero, otro el alquiler— y lo que se quiere ver es a qué ritmo se
 * consume el mes.
 */
function GastoPorDia({ resumen, hoy }: { resumen: ReturnType<typeof resumenMes>; hoy: string }) {
  const ultimoDia = diaDelMes(monthEnd(resumen.mes))
  const porDia = new Map(resumen.porDia.map((d) => [d.dia, d.gastos]))

  const hastaDia = resumen.mes === hoy.slice(0, 7) ? diaDelMes(hoy) : ultimoDia

  // Se acumula el mes ENTERO, no solo hasta hoy: lo que ya está cargado con
  // fecha futura es plata comprometida, y saber cuánto falta pagar antes de
  // que termine el mes es justo la pregunta que esto tiene que contestar.
  let acumulado = 0
  const todos: { dia: number; total: number }[] = []
  for (let d = 1; d <= ultimoDia; d++) {
    acumulado += porDia.get(d) ?? 0
    todos.push({ dia: d, total: acumulado })
  }

  if (resumen.gastos === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        Sin gastos cargados este mes.
      </p>
    )
  }

  const hastaHoy = todos.slice(0, hastaDia)
  // Arranca en el último punto de lo ya gastado para que las dos líneas se
  // toquen en vez de quedar un hueco en el medio.
  const proyectado = todos.slice(Math.max(0, hastaDia - 1))
  const gastadoHoy = hastaHoy[hastaHoy.length - 1]?.total ?? 0

  const ANCHO = 600
  const ALTO = 170
  const tope = Math.max(acumulado, 1)
  const x = (dia: number) => ((dia - 1) / Math.max(1, ultimoDia - 1)) * ANCHO
  const y = (total: number) => ALTO - (total / tope) * (ALTO - 10)
  const trazo = (ps: typeof todos) =>
    ps.map((p) => `${x(p.dia).toFixed(1)},${y(p.total).toFixed(1)}`).join(' L ')

  const linea = trazo(hastaHoy)
  const area = `M ${x(1).toFixed(1)},${ALTO} L ${linea} L ${x(hastaDia).toFixed(1)},${ALTO} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-44 w-full" role="img" aria-label="Gasto acumulado del mes">
        <defs>
          <linearGradient id="relleno-gasto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pastel('coral', 0.35)} />
            <stop offset="100%" stopColor={pastel('coral', 0)} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={ANCHO}
            y1={ALTO - f * (ALTO - 10)}
            y2={ALTO - f * (ALTO - 10)}
            stroke="rgb(255 255 255 / 0.06)"
            strokeDasharray="4 6"
          />
        ))}
        <path d={area} fill="url(#relleno-gasto)" />
        {/* Punteado para lo que todavía no pasó: es plata comprometida, no
            gastada, y dibujarla con la misma línea las confundiría. */}
        {proyectado.length > 1 && (
          <path
            d={`M ${trazo(proyectado)}`}
            fill="none"
            stroke={pastel('coral', 0.45)}
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinejoin="round"
          />
        )}
        <path
          d={`M ${linea}`}
          fill="none"
          stroke={pastel('coral', 0.95)}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">
          {formatARS(gastadoHoy)} hasta hoy
        </span>
        {acumulado > gastadoHoy && (
          <span>{formatARS(acumulado - gastadoHoy)} más ya cargado para el resto del mes</span>
        )}
      </div>
    </div>
  )
}

/** Anillo de categorías: proporciones de un vistazo, sin leer números. */
function PorCategoria({ resumen }: { resumen: ReturnType<typeof resumenMes> }) {
  const top = resumen.porCategoria.slice(0, 6)
  if (top.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">Nada cargado todavía.</p>
  }

  const RADIO = 54
  const CIRC = 2 * Math.PI * RADIO
  let offset = 0

  return (
    <div>
      <div className="flex justify-center">
        <svg viewBox="0 0 140 140" className="h-32 w-32" role="img" aria-label="Gastos por categoría">
          {top.map((c) => {
            const largo = (c.porcentaje / 100) * CIRC
            const el = (
              <circle
                key={c.id ?? 'sin'}
                cx="70"
                cy="70"
                r={RADIO}
                fill="none"
                stroke={pastel(c.color, 0.95)}
                strokeWidth="16"
                strokeDasharray={`${largo} ${CIRC - largo}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            )
            offset += largo
            return el
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {top.map((c) => (
          <div key={c.id ?? 'sin'} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: pastel(c.color, 1) }}
            />
            <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
            <span className="shrink-0 text-text-muted">{Math.round(c.porcentaje)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PorMes({ anual }: { anual: ReturnType<typeof resumenAnual> }) {
  const tope = Math.max(...anual.meses.map((m) => m.gastos), 1)
  const conDatos = anual.meses.some((m) => m.gastos > 0)

  if (!conDatos) {
    return <p className="py-8 text-center text-sm text-text-muted">Sin datos del año.</p>
  }

  return (
    <div>
      {/* Las barras son hijas directas del contenedor con alto fijo: dentro de
          una columna de alto automático, un height en % no tiene contra qué
          resolver y la barra se dibuja de cero píxeles. */}
      <div className="flex h-32 items-end gap-1">
        {anual.meses.map((m) => (
          <span
            key={m.mes}
            title={`${formatMes(m.mes)}: ${formatARS(m.gastos)}`}
            className="flex-1 rounded-t"
            style={{
              height: `${m.gastos === 0 ? 2 : Math.max(4, (m.gastos / tope) * 100)}%`,
              background:
                m.gastos === 0
                  ? 'rgb(255 255 255 / 0.07)'
                  : `linear-gradient(180deg, ${pastel('peach', 0.9)}, ${pastel('peach', 0.35)})`
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {anual.meses.map((m) => (
          <span key={m.mes} className="flex-1 text-center text-[9px] capitalize text-text-muted">
            {formatMes(m.mes).charAt(0)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Total del año <strong className="text-text-secondary">{formatCompacto(anual.gastos)}</strong>
      </p>
    </div>
  )
}
