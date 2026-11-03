import { formatCorto, monthKey, formatMes } from '@/lib/dates'
import { formatARS } from '@/lib/dinero'
import { estadoDePago } from '@/lib/balance'
import { safeColor, pastel } from '@/lib/palette'
import type { FinCategory, FinMovement } from '@/types/database.types'

/**
 * El mes como la hoja de papel.
 *
 * Está copiado de cómo lo lleva la usuaria a mano, y eso no es nostalgia: su
 * hoja hace bien tres cosas que la app hacía peor.
 *
 * 1. CONCEPTO, MONTO Y VENCIMIENTO. Nada más. Sin categorías, sin colores,
 *    sin porcentajes. Esa lista se barre de arriba abajo en dos segundos.
 * 2. LO DE ESTE MES SEPARADO DE LO ARRASTRADO. Mezclados en una sola lista
 *    ordenada por fecha, una deuda de septiembre se pierde entre las cuentas
 *    de noviembre.
 * 3. EL MES ADELANTE DE CADA DEUDA VIEJA ("OCT - EPE"). De un vistazo se ve
 *    cuánto hace que está, que es lo que decide a cuál atacar primero.
 *
 * Lo único que agrega sobre el papel son los totales, que ella hace con la
 * calculadora, y el tilde para marcar pagado.
 */

/** Suma en centavos: sumar pesos con decimales acumula error. */
const sumar = (ms: FinMovement[], campo: 'amount' | 'paid_amount') =>
  ms.reduce((a, m) => a + Math.round(m[campo] * 100), 0) / 100

interface Props {
  movimientos: FinMovement[]
  deudas: FinMovement[]
  categorias: FinCategory[]
  hoy: string
  onEditar: (m: FinMovement) => void
  onPagar: (m: FinMovement, pagar: boolean) => void
}

export default function HojaDelMes({
  movimientos,
  deudas,
  categorias,
  hoy,
  onEditar,
  onPagar
}: Props) {
  // Primero lo que vence, y lo que no tiene vencimiento al final: es el orden
  // en que se decide qué pagar.
  const gastos = movimientos
    .filter((m) => m.kind === 'gasto')
    .sort((a, b) => {
      const va = a.due_date ?? '9999-12-31'
      const vb = b.due_date ?? '9999-12-31'
      return va !== vb ? va.localeCompare(vb) : a.description.localeCompare(b.description)
    })

  // Las viejas, de la más antigua a la más nueva: así quedan agrupadas por mes
  // sin tener que agruparlas.
  const viejas = [...deudas].sort((a, b) => a.date.localeCompare(b.date))

  const totalMes = sumar(gastos, 'amount')
  const pagadoMes = sumar(gastos, 'paid_amount')
  const faltaMes = totalMes - pagadoMes
  const totalViejo = viejas.reduce(
    (a, m) => a + Math.round((m.amount - m.paid_amount) * 100),
    0
  ) / 100

  const sinMonto = gastos.filter((m) => m.amount === 0).length

  return (
    <div className="glass rounded-card px-4 py-4 sm:px-5">
      <Encabezado texto="Gastos del mes" />

      {gastos.length === 0 ? (
        <p className="py-3 text-sm italic text-text-muted">Todavía no cargaste nada este mes.</p>
      ) : (
        <div className="flex flex-col">
          {gastos.map((m) => (
            <Renglon
              key={m.id}
              m={m}
              categorias={categorias}
              hoy={hoy}
              onEditar={() => onEditar(m)}
              onPagar={(p) => onPagar(m, p)}
            />
          ))}
        </div>
      )}

      {gastos.length > 0 && (
        <div className="mt-3 border-t border-white/[0.09] pt-2.5">
          <Total etiqueta="Total del mes" valor={totalMes} />
          {pagadoMes > 0 && <Total etiqueta="Pagado" valor={pagadoMes} tono="mint" />}
          <Total etiqueta="Falta pagar" valor={faltaMes} tono="coral" fuerte />
          {sinMonto > 0 && (
            <p className="mt-1.5 text-xs text-text-muted">
              {sinMonto === 1
                ? 'Hay 1 concepto sin importe todavía: no entra en el total.'
                : `Hay ${sinMonto} conceptos sin importe todavía: no entran en el total.`}
            </p>
          )}
        </div>
      )}

      {viejas.length > 0 && (
        <>
          <div className="mt-6">
            <Encabezado texto="De meses anteriores" />
          </div>

          <div className="flex flex-col">
            {viejas.map((m) => (
              <Renglon
                key={m.id}
                m={m}
                categorias={categorias}
                hoy={hoy}
                // El mes adelante: "OCT". Es lo que dice cuánto hace que está.
                prefijo={formatMes(monthKey(m.date)).slice(0, 3).toUpperCase()}
                onEditar={() => onEditar(m)}
                onPagar={(p) => onPagar(m, p)}
              />
            ))}
          </div>

          <div className="mt-3 border-t border-white/[0.09] pt-2.5">
            <Total etiqueta="Deuda arrastrada" valor={totalViejo} tono="coral" fuerte />
          </div>
        </>
      )}

      {(gastos.length > 0 || viejas.length > 0) && (
        <div className="mt-4 rounded-xl bg-white/[0.05] px-3 py-2.5">
          <Total etiqueta="Total a pagar" valor={faltaMes + totalViejo} fuerte grande />
        </div>
      )}
    </div>
  )
}

function Encabezado({ texto }: { texto: string }) {
  return (
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
      {texto}
    </h2>
  )
}

function Renglon({
  m,
  categorias,
  hoy,
  prefijo,
  onEditar,
  onPagar
}: {
  m: FinMovement
  categorias: FinCategory[]
  hoy: string
  prefijo?: string
  onEditar: () => void
  onPagar: (pagar: boolean) => void
}) {
  const estado = estadoDePago(m)
  const pagado = estado === 'pagado'
  const vencido = Boolean(m.due_date && m.due_date < hoy && !pagado)
  const cat = categorias.find((c) => c.id === m.category_id)
  const color = safeColor(cat?.color ?? 'sky')

  return (
    <div className="group flex items-center gap-2 border-b border-white/[0.04] py-1.5 last:border-0">
      <input
        type="checkbox"
        checked={pagado}
        onChange={(e) => onPagar(e.target.checked)}
        className="shrink-0 scale-90"
        aria-label={`Marcar "${m.description}" como pagado`}
      />

      <button
        onClick={onEditar}
        className={`flex min-w-0 flex-1 items-baseline gap-1.5 text-left text-sm ${
          pagado ? 'text-text-muted line-through' : ''
        }`}
      >
        {prefijo && (
          <span
            className="shrink-0 text-[10px] font-bold tracking-wide"
            style={{ color: pastel(color, 0.9) }}
          >
            {prefijo}
          </span>
        )}
        <span className="truncate">{m.description}</span>
        {m.installments && (
          <span className="shrink-0 text-xs text-text-muted">
            {m.installment}/{m.installments}
          </span>
        )}
      </button>

      {/* Monto alineado en columna, con cifras de ancho fijo: así la columna
          se compara de un vistazo, que es lo que una hoja de gastos hace bien. */}
      <span
        className={`shrink-0 text-right text-sm tabular-nums ${
          pagado ? 'text-text-muted line-through' : 'font-medium'
        }`}
      >
        {m.amount === 0 ? (
          <span className="text-xs italic text-text-muted">a confirmar</span>
        ) : estado === 'parcial' ? (
          <span title={`Pagado ${formatARS(m.paid_amount)} de ${formatARS(m.amount)}`}>
            {formatARS(m.amount - m.paid_amount)}
            <span className="ml-1 text-[10px] text-text-muted">resta</span>
          </span>
        ) : (
          formatARS(m.amount)
        )}
      </span>

      <span
        className={`w-16 shrink-0 text-right text-[11px] tabular-nums ${
          vencido ? 'font-semibold text-danger' : 'text-text-muted'
        }`}
      >
        {m.due_date ? formatCorto(m.due_date) : ''}
      </span>
    </div>
  )
}

function Total({
  etiqueta,
  valor,
  tono,
  fuerte,
  grande
}: {
  etiqueta: string
  valor: number
  tono?: 'mint' | 'coral'
  fuerte?: boolean
  grande?: boolean
}) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className={`flex-1 ${grande ? 'text-sm font-medium' : 'text-xs text-text-muted'}`}>
        {etiqueta}
      </span>
      <span
        className={`tabular-nums ${grande ? 'text-lg font-bold' : fuerte ? 'text-sm font-semibold' : 'text-sm'}`}
        style={tono ? { color: pastel(tono, 1) } : undefined}
      >
        {formatARS(valor)}
      </span>
    </div>
  )
}
