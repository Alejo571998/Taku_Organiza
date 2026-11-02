import { useMemo, useState } from 'react'
import {
  useCategorias,
  useMovimientos,
  useFinSettings,
  useMarcarPagado,
  useSaveIngresoMensual
} from '@/hooks/useFinanzas'
import {
  currentMonthKey,
  addMonths,
  monthStart,
  monthEnd,
  formatMes,
  formatMesLargo,
  formatCorto,
  todayISO,
  monthKey
} from '@/lib/dates'
import { resumenMes, resumenAnual, estadoDePago } from '@/lib/balance'
import { formatARS, parsearMonto, montoParaEditar, formatCompacto } from '@/lib/dinero'
import { safeColor, pastel } from '@/lib/palette'
import Chevron from '@/components/ui/Chevron'
import TakuVacio from '@/components/taku/TakuVacio'
import MovimientoEditorModal from '@/components/finanzas/MovimientoEditorModal'
import CategoriasModal from '@/components/finanzas/CategoriasModal'
import type { FinMovement } from '@/types/database.types'

type Vista = 'mes' | 'anio'

export default function FinanzasView() {
  const [mes, setMes] = useState(currentMonthKey())
  const [vista, setVista] = useState<Vista>('mes')
  const [editando, setEditando] = useState<FinMovement | 'nuevo' | null>(null)
  const [verCategorias, setVerCategorias] = useState(false)

  const anio = Number(mes.slice(0, 4))
  // En vista anual se pide el año entero; en mensual, solo el mes. Traer
  // siempre el año completo haría que abrir Finanzas baje doce meses de
  // movimientos para mostrar uno.
  const from = vista === 'mes' ? monthStart(mes) : `${anio}-01-01`
  const to = vista === 'mes' ? monthEnd(mes) : `${anio}-12-31`

  const { data: categorias } = useCategorias()
  const { data: movimientos, isLoading, error } = useMovimientos(from, to)
  const { data: settings } = useFinSettings()
  const marcarPagado = useMarcarPagado(from, to)

  const hoy = todayISO()
  const resumen = useMemo(
    () => resumenMes(mes, movimientos ?? [], categorias ?? [], hoy),
    [mes, movimientos, categorias, hoy]
  )
  const anual = useMemo(() => resumenAnual(anio, movimientos ?? []), [anio, movimientos])

  const ingresoEsperado = settings?.monthly_income ?? 0
  // El balance contra lo que espera cobrar, que es la pregunta real de fin de
  // mes: "con lo que entra, ¿me alcanza?".
  const disponible = ingresoEsperado > 0 ? ingresoEsperado - resumen.gastos : null

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="glass flex shrink-0 items-center rounded-pill p-1">
          <button
            onClick={() => setMes(addMonths(mes, -1))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label={vista === 'mes' ? 'Mes anterior' : 'Año anterior'}
          >
            <Chevron className="rotate-180" />
          </button>
          <button
            onClick={() => setMes(addMonths(mes, 1))}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label={vista === 'mes' ? 'Mes siguiente' : 'Año siguiente'}
          >
            <Chevron />
          </button>
        </div>

        <h1 className="text-xl font-bold first-letter:uppercase sm:text-2xl">
          {vista === 'mes' ? formatMesLargo(mes) : anio}
        </h1>

        {mes !== currentMonthKey() && (
          <button
            onClick={() => setMes(currentMonthKey())}
            className="btn-ghost px-2.5 py-1 text-xs"
          >
            Este mes
          </button>
        )}

        <div className="glass ml-auto inline-flex rounded-pill p-1">
          {(['mes', 'anio'] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`rounded-pill px-3 py-1.5 text-sm transition-all ${
                vista === v
                  ? 'bg-white/10 font-semibold text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {v === 'mes' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>

        <button onClick={() => setEditando('nuevo')} className="btn-primary shrink-0">
          + Movimiento
        </button>
      </div>

      {isLoading && <p className="text-sm italic text-text-muted">Cargando…</p>}
      {error && (
        <p className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">
          No se pudieron cargar los movimientos. {error.message}
        </p>
      )}

      {vista === 'mes' ? (
        <VistaMes
          resumen={resumen}
          disponible={disponible}
          ingresoEsperado={ingresoEsperado}
          movimientos={movimientos ?? []}
          categorias={categorias ?? []}
          hoy={hoy}
          onEditar={setEditando}
          onNuevo={() => setEditando('nuevo')}
          onCategorias={() => setVerCategorias(true)}
          onPagar={(m, pagar) =>
            marcarPagado.mutate({ id: m.id, monto: pagar ? m.amount : 0 })
          }
        />
      ) : (
        <VistaAnual anual={anual} onIrAlMes={(m) => { setMes(m); setVista('mes') }} />
      )}

      {editando && categorias && (
        <MovimientoEditorModal
          categorias={categorias}
          movimiento={editando === 'nuevo' ? undefined : editando}
          fechaPorDefecto={monthKey(hoy) === mes ? hoy : monthStart(mes)}
          onClose={() => setEditando(null)}
        />
      )}

      {verCategorias && categorias && (
        <CategoriasModal categorias={categorias} onClose={() => setVerCategorias(false)} />
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Mes
// ------------------------------------------------------------

function VistaMes({
  resumen,
  disponible,
  ingresoEsperado,
  movimientos,
  categorias,
  hoy,
  onEditar,
  onNuevo,
  onCategorias,
  onPagar
}: {
  resumen: ReturnType<typeof resumenMes>
  disponible: number | null
  ingresoEsperado: number
  movimientos: FinMovement[]
  categorias: { id: string; name: string; color: string | null }[]
  hoy: string
  onEditar: (m: FinMovement) => void
  onNuevo: () => void
  onCategorias: () => void
  onPagar: (m: FinMovement, pagar: boolean) => void
}) {
  // Primero lo que vence, después el resto: es el orden en que se decide qué
  // pagar. Un movimiento sin vencimiento no compite por urgencia.
  const ordenados = [...movimientos].sort((a, b) => {
    const va = a.due_date ?? '9999-12-31'
    const vb = b.due_date ?? '9999-12-31'
    if (va !== vb) return va.localeCompare(vb)
    return a.date.localeCompare(b.date)
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta titulo="Gastos del mes" valor={formatARS(resumen.gastos)} tono="coral">
          {resumen.promedioDiario > 0 && `${formatARS(resumen.promedioDiario)} por día`}
        </Tarjeta>
        <Tarjeta titulo="Ingresos" valor={formatARS(resumen.ingresos)} tono="mint">
          {ingresoEsperado > 0 && `Esperado ${formatARS(ingresoEsperado)}`}
        </Tarjeta>
        <Tarjeta
          titulo="Balance"
          valor={formatARS(resumen.balance)}
          tono={resumen.balance >= 0 ? 'mint' : 'coral'}
        >
          {disponible !== null &&
            `${disponible >= 0 ? 'Queda' : 'Falta'} ${formatARS(Math.abs(disponible))} del esperado`}
        </Tarjeta>
        <Tarjeta
          titulo="Pendiente"
          valor={formatARS(resumen.pendiente)}
          tono={resumen.vencido > 0 ? 'coral' : 'butter'}
        >
          {resumen.vencido > 0 ? `${formatARS(resumen.vencido)} vencido` : 'Nada vencido'}
        </Tarjeta>
      </div>

      <IngresoMensual actual={ingresoEsperado} />

      {resumen.porCategoria.length > 0 && (
        <div className="glass rounded-card px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">En qué se fue</h2>
            <button onClick={onCategorias} className="text-xs text-accent-text underline">
              Categorías
            </button>
          </div>

          <div className="mb-3 flex h-3 overflow-hidden rounded-pill bg-black/30">
            {resumen.porCategoria.map((c) => (
              <div
                key={c.id ?? 'sin'}
                title={`${c.nombre}: ${formatARS(c.total)}`}
                style={{ width: `${c.porcentaje}%`, background: pastel(c.color, 0.85) }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            {resumen.porCategoria.map((c) => (
              <div key={c.id ?? 'sin'} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: pastel(c.color, 1) }}
                />
                <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                <span className="shrink-0 text-text-muted">{Math.round(c.porcentaje)}%</span>
                <span className="w-28 shrink-0 text-right">{formatARS(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {movimientos.length === 0 ? (
        <TakuVacio
          titulo="Todavía no hay movimientos este mes"
          detalle="Cargá un gasto o un ingreso. Si es algo que pagás todos los meses, marcalo como fijo y se repite solo."
          accion={
            <button onClick={onNuevo} className="btn-primary">
              Cargar el primero
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {ordenados.map((m) => (
            <Fila
              key={m.id}
              m={m}
              categorias={categorias}
              hoy={hoy}
              onEditar={() => onEditar(m)}
              onPagar={(pagar) => onPagar(m, pagar)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Fila({
  m,
  categorias,
  hoy,
  onEditar,
  onPagar
}: {
  m: FinMovement
  categorias: { id: string; name: string; color: string | null }[]
  hoy: string
  onEditar: () => void
  onPagar: (pagar: boolean) => void
}) {
  const cat = categorias.find((c) => c.id === m.category_id)
  const color = safeColor(cat?.color ?? (m.kind === 'ingreso' ? 'mint' : 'coral'))
  const estado = estadoDePago(m)
  const vencido = Boolean(m.due_date && m.due_date < hoy && estado !== 'pagado')

  const derrame = [
    `${pastel(color, estado === 'pagado' ? 0.3 : 0.9)} 0px`,
    `${pastel(color, estado === 'pagado' ? 0.3 : 0.9)} 6px`,
    `${pastel(color, estado === 'pagado' ? 0.12 : 0.38)} 6px`,
    `${pastel(color, estado === 'pagado' ? 0.05 : 0.15)} 42%`,
    'transparent 80%'
  ].join(', ')

  return (
    <div
      className="glass flex items-center gap-2.5 overflow-hidden rounded-card px-3 py-3 transition-colors hover:bg-white/[0.07]"
      style={{ backgroundImage: `linear-gradient(90deg, ${derrame})` }}
    >
      {m.kind === 'gasto' && (
        <input
          type="checkbox"
          checked={estado === 'pagado'}
          onChange={(e) => onPagar(e.target.checked)}
          className="shrink-0"
          aria-label={`Marcar "${m.description}" como pagado`}
        />
      )}

      <button onClick={onEditar} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{m.description}</span>
          {m.installments && (
            <span className="shrink-0 text-xs text-text-muted">
              {m.installment}/{m.installments}
            </span>
          )}
          {m.recurring && (
            <span className="shrink-0 text-xs text-text-muted" title="Fijo mensual">
              fijo
            </span>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
          {cat && <span>{cat.name}</span>}
          {m.due_date && (
            <span className={vencido ? 'font-medium text-danger' : ''}>
              {vencido ? 'venció' : 'vence'} {formatCorto(m.due_date)}
            </span>
          )}
          {estado === 'parcial' && (
            <span style={{ color: pastel('butter', 1) }}>
              pagado {formatARS(m.paid_amount)} de {formatARS(m.amount)}
            </span>
          )}
        </span>
      </button>

      <span
        className={`shrink-0 text-sm font-semibold ${
          m.kind === 'ingreso' ? 'text-accent-text' : 'text-text-primary'
        } ${estado === 'pagado' ? 'opacity-50' : ''}`}
      >
        {m.kind === 'ingreso' ? '+' : ''}
        {formatARS(m.amount)}
      </span>
    </div>
  )
}

// ------------------------------------------------------------
// Año
// ------------------------------------------------------------

function VistaAnual({
  anual,
  onIrAlMes
}: {
  anual: ReturnType<typeof resumenAnual>
  onIrAlMes: (mes: string) => void
}) {
  // Las barras se escalan contra el mes más alto del año: es lo que hace que
  // la comparación se lea de un vistazo.
  const tope = Math.max(...anual.meses.map((m) => Math.max(m.gastos, m.ingresos)), 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta titulo="Gastos del año" valor={formatARS(anual.gastos)} tono="coral" />
        <Tarjeta titulo="Ingresos del año" valor={formatARS(anual.ingresos)} tono="mint" />
        <Tarjeta
          titulo="Balance"
          valor={formatARS(anual.balance)}
          tono={anual.balance >= 0 ? 'mint' : 'coral'}
        />
        <Tarjeta titulo="Promedio mensual" valor={formatARS(anual.promedioMensual)} tono="sky">
          Sobre los meses con movimientos
        </Tarjeta>
      </div>

      <div className="glass flex flex-col gap-2.5 rounded-card px-4 py-4">
        {anual.meses.map((m) => (
          <button
            key={m.mes}
            onClick={() => onIrAlMes(m.mes)}
            className="flex items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="w-10 shrink-0 text-xs capitalize text-text-muted">
              {formatMes(m.mes)}
            </span>
            <span className="relative flex h-6 flex-1 overflow-hidden rounded-lg bg-black/25">
              <span
                className="h-full"
                style={{
                  width: `${(m.gastos / tope) * 100}%`,
                  background: `linear-gradient(180deg, ${pastel('coral', 0.9)}, ${pastel('coral', 0.55)})`
                }}
              />
              <span
                className="h-full"
                style={{
                  width: `${(m.ingresos / tope) * 100}%`,
                  background: `linear-gradient(180deg, ${pastel('mint', 0.55)}, ${pastel('mint', 0.3)})`
                }}
              />
            </span>
            <span className="w-24 shrink-0 text-right text-xs sm:w-28 sm:text-sm">
              {m.gastos > 0 ? formatCompacto(m.gastos) : '—'}
            </span>
          </button>
        ))}
        <p className="mt-1 flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: pastel('coral', 1) }}
            />
            Gastos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: pastel('mint', 1) }} />
            Ingresos
          </span>
        </p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Piezas
// ------------------------------------------------------------

function Tarjeta({
  titulo,
  valor,
  tono,
  children
}: {
  titulo: string
  valor: string
  tono: 'mint' | 'coral' | 'butter' | 'sky'
  children?: React.ReactNode
}) {
  return (
    <div className="glass rounded-card px-4 py-3.5">
      <p className="text-xs text-text-muted">{titulo}</p>
      <p
        className="mt-1 truncate text-lg font-bold sm:text-xl"
        style={{ color: pastel(tono, 1) }}
        title={valor}
      >
        {valor}
      </p>
      {children && <p className="mt-0.5 truncate text-xs text-text-muted">{children}</p>}
    </div>
  )
}

/**
 * El ingreso mensual esperado. Es lo que la persona cuenta que va a cobrar, y
 * convive con los ingresos reales en vez de reemplazarlos: comparar las dos
 * cosas es justo lo que dice si el mes cierra.
 */
function IngresoMensual({ actual }: { actual: number }) {
  const guardar = useSaveIngresoMensual()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(montoParaEditar(actual))

  async function confirmar() {
    const monto = parsearMonto(texto)
    if (monto === null) return
    await guardar.mutateAsync(monto)
    setEditando(false)
  }

  if (!editando) {
    return (
      <button
        onClick={() => {
          setTexto(montoParaEditar(actual))
          setEditando(true)
        }}
        className="glass flex items-center gap-2 rounded-card px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
      >
        <span className="text-sm text-text-secondary">Ingreso mensual esperado</span>
        <span className="ml-auto text-sm font-semibold">
          {actual > 0 ? formatARS(actual) : 'Poner el mío'}
        </span>
      </button>
    )
  }

  return (
    <div className="glass flex flex-wrap items-center gap-2 rounded-card px-4 py-3">
      <span className="text-sm text-text-secondary">Ingreso mensual esperado</span>
      <input
        autoFocus
        inputMode="decimal"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirmar()
          if (e.key === 'Escape') setEditando(false)
        }}
        placeholder="0,00"
        className="field ml-auto w-40"
      />
      <button onClick={confirmar} disabled={guardar.isPending} className="btn-primary">
        Guardar
      </button>
      <button onClick={() => setEditando(false)} className="btn-ghost">
        Cancelar
      </button>
    </div>
  )
}
