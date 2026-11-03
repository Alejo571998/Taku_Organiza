import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { parsearMonto, montoParaEditar, formatARS } from '@/lib/dinero'
import { addMonthsISO, formatCorto, todayISO } from '@/lib/dates'
import { safeColor } from '@/lib/palette'
import {
  useSaveMovimiento,
  useCrearSerie,
  useDeleteMovimiento,
  useDeleteSerie
} from '@/hooks/useFinanzas'
import type {
  FinCard,
  FinCategory,
  FinMovement,
  MovementKind,
  PaymentMethod
} from '@/types/database.types'

const MEDIOS: { valor: PaymentMethod; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'debito', etiqueta: 'Débito' },
  { valor: 'credito', etiqueta: 'Tarjeta de crédito' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'otro', etiqueta: 'Otro' }
]

type Modo = 'simple' | 'fijo' | 'cuotas'

interface Props {
  categorias: FinCategory[]
  tarjetas: FinCard[]
  movimiento?: FinMovement
  fechaPorDefecto: string
  onClose: () => void
}

/**
 * Alta y edición de un movimiento.
 *
 * El repetir vive acá y no en una pantalla aparte porque un gasto en cuotas no
 * es otra cosa que un gasto: es el mismo formulario diciendo "esto cae doce
 * veces". Separarlo obligaría a elegir qué tipo de gasto es antes de saber el
 * monto.
 *
 * Al editar, la repetición no se ofrece: la serie ya está materializada y
 * cambiarla desde una cuota sería ambiguo (¿esta?, ¿las que vienen?, ¿todas?).
 * Se edita la cuota que se tocó, o se borra la serie entera.
 */
export default function MovimientoEditorModal({
  categorias,
  tarjetas,
  movimiento,
  fechaPorDefecto,
  onClose
}: Props) {
  const esNuevo = !movimiento

  const [kind, setKind] = useState<MovementKind>(movimiento?.kind ?? 'gasto')
  const [description, setDescription] = useState(movimiento?.description ?? '')
  const [montoTexto, setMontoTexto] = useState(
    movimiento ? montoParaEditar(movimiento.amount) : ''
  )
  const [pagadoTexto, setPagadoTexto] = useState(
    movimiento ? montoParaEditar(movimiento.paid_amount) : ''
  )
  const [date, setDate] = useState(movimiento?.date ?? fechaPorDefecto)
  const [dueDate, setDueDate] = useState(movimiento?.due_date ?? '')
  const [categoryId, setCategoryId] = useState(movimiento?.category_id ?? '')
  const [method, setMethod] = useState<PaymentMethod | ''>(movimiento?.method ?? '')
  const [cardId, setCardId] = useState(movimiento?.card_id ?? '')
  const [note, setNote] = useState(movimiento?.note ?? '')
  const [modo, setModo] = useState<Modo>('simple')
  const [meses, setMeses] = useState(12)
  const [error, setError] = useState<string | null>(null)

  const guardar = useSaveMovimiento()
  const crearSerie = useCrearSerie()
  const borrar = useDeleteMovimiento()
  const borrarSerie = useDeleteSerie()
  const trabajando =
    guardar.isPending || crearSerie.isPending || borrar.isPending || borrarSerie.isPending

  const delTipo = categorias.filter((c) => c.kind === kind)
  const categoria = categorias.find((c) => c.id === categoryId)
  const monto = parsearMonto(montoTexto)

  async function handleSubmit() {
    if (!description.trim()) {
      setError('Ponele un nombre al movimiento.')
      return
    }
    // Vacío NO es un error: en la hoja de papel hay renglones escritos sin
    // importe, esperando que llegue la factura. Se guarda en cero, queda
    // como "a confirmar" en la lista y no entra en los totales.
    const montoFinal = montoTexto.trim() === '' ? 0 : monto
    if (montoFinal === null) {
      setError('El monto no se entiende. Podés escribirlo como 1.234,56 o 1234.56')
      return
    }
    setError(null)

    const base = {
      kind,
      description: description.trim(),
      amount: montoFinal,
      date,
      dueDate: dueDate || null,
      categoryId: categoryId || null,
      cardId: cardId || null,
      method: (method || null) as PaymentMethod | null,
      note: note.trim() || null
    }

    try {
      if (esNuevo && modo !== 'simple') {
        await crearSerie.mutateAsync({ ...base, meses, esFijo: modo === 'fijo' })
      } else {
        const pagado = parsearMonto(pagadoTexto) ?? 0
        await guardar.mutateAsync({
          ...base,
          id: movimiento?.id,
          // Un ingreso ya está cobrado cuando se anota: no tiene sentido
          // pedirle a alguien que marque cuánto cobró de lo que cobró.
          paidAmount: kind === 'ingreso' ? montoFinal : Math.min(pagado, montoFinal)
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  async function handleBorrar(serie: boolean) {
    if (!movimiento) return
    const texto = serie
      ? `¿Borrar "${movimiento.description}" y todas sus cuotas?`
      : `¿Borrar "${movimiento.description}"?`
    if (!window.confirm(texto)) return
    setError(null)
    try {
      if (serie && movimiento.series_id) await borrarSerie.mutateAsync(movimiento.series_id)
      else await borrar.mutateAsync(movimiento.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.')
    }
  }

  const hasta = addMonthsISO(date, meses - 1)

  return (
    <Modal
      title={esNuevo ? 'Nuevo movimiento' : 'Editar movimiento'}
      accent={categoria ? safeColor(categoria.color) : kind === 'ingreso' ? 'mint' : 'coral'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {movimiento && (
            <>
              <button
                onClick={() => handleBorrar(false)}
                disabled={trabajando}
                className="btn-ghost px-3 py-2 text-sm text-danger"
              >
                Borrar
              </button>
              {movimiento.series_id && (
                <button
                  onClick={() => handleBorrar(true)}
                  disabled={trabajando}
                  className="btn-ghost px-3 py-2 text-xs text-danger"
                >
                  Borrar serie
                </button>
              )}
            </>
          )}
          <button
            onClick={handleSubmit}
            disabled={trabajando}
            className="btn-primary ml-auto"
          >
            {trabajando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      {/* Gasto o ingreso: lo primero, porque cambia qué categorías se ofrecen. */}
      <div className="glass inline-flex rounded-pill p-1">
        {(['gasto', 'ingreso'] as MovementKind[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k)
              setCategoryId('')
            }}
            className={`rounded-pill px-4 py-1.5 text-sm transition-all ${
              kind === k
                ? 'bg-white/10 font-semibold text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {k === 'gasto' ? 'Gasto' : 'Ingreso'}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Qué es
        </label>
        <input
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === 'gasto' ? 'Ej: Luz, Internet, Supermercado' : 'Ej: Sueldo, Venta'}
          className="field"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Monto
          </label>
          <input
            inputMode="decimal"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
            placeholder="0,00"
            className="field"
          />
          {monto !== null && monto > 0 ? (
            <p className="mt-1 text-xs text-text-muted">{formatARS(monto)}</p>
          ) : (
            <p className="mt-1 text-xs text-text-muted">
              Podés dejarlo vacío si todavía no sabés cuánto.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Categoría
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="field"
          >
            <option value="">Sin categoría</option>
            {delTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Medio
          </label>
          <select
            value={method}
            onChange={(e) => {
              const v = e.target.value as PaymentMethod | ''
              setMethod(v)
              // Si deja de ser con tarjeta, el consumo no puede quedar colgado
              // de una: aparecería en el resumen de algo que no se pagó así.
              if (v !== 'credito') setCardId('')
            }}
            className="field"
          >
            <option value="">Sin especificar</option>
            {MEDIOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* La tarjeta aparece solo si hay alguna cargada: el selector vacío en
          cada alta sería una pregunta que la mayoría no tiene que contestar. */}
      {kind === 'gasto' && tarjetas.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Tarjeta
          </label>
          <select
            value={cardId}
            onChange={(e) => {
              setCardId(e.target.value)
              // Elegir tarjeta ya dice cómo se pagó.
              if (e.target.value) setMethod('credito')
            }}
            className="field"
          >
            <option value="">No es de tarjeta</option>
            {tarjetas
              .filter((t) => t.active || t.id === cardId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-text-muted">
            El consumo suma al resumen de esa tarjeta en el mes de la fecha.
          </p>
        </div>
      )}

      {kind === 'gasto' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
              Vence
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="field"
            />
            <p className="mt-1 text-xs text-text-muted">Opcional. Ordena qué pagar primero.</p>
          </div>
          {!esNuevo && (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Ya pagué
              </label>
              <input
                inputMode="decimal"
                value={pagadoTexto}
                onChange={(e) => setPagadoTexto(e.target.value)}
                placeholder="0,00"
                className="field"
              />
              <p className="mt-1 text-xs text-text-muted">
                Podés poner una parte: queda como pago parcial.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Repetir: solo al crear. Ver el comentario de arriba. */}
      {esNuevo && (
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Repetir
          </label>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as Modo)}
            className="field"
          >
            <option value="simple">No se repite</option>
            <option value="fijo">Todos los meses (fijo)</option>
            <option value="cuotas">En cuotas</option>
          </select>

          {modo !== 'simple' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={2}
                max={60}
                value={meses}
                onChange={(e) => setMeses(Math.max(2, Math.min(60, Number(e.target.value) || 2)))}
                className="field w-24"
              />
              <span className="text-sm text-text-secondary">
                {modo === 'cuotas' ? 'cuotas' : 'meses'}
              </span>
            </div>
          )}

          {modo !== 'simple' && monto !== null && monto > 0 && (
            <p className="mt-2 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-text-secondary">
              {modo === 'cuotas' ? (
                <>
                  {meses} cuotas de aproximadamente{' '}
                  <strong className="text-text-primary">{formatARS(monto / meses)}</strong>, de{' '}
                  {formatCorto(date)} a {formatCorto(hasta)}.
                </>
              ) : (
                <>
                  <strong className="text-text-primary">{formatARS(monto)}</strong> por mes, de{' '}
                  {formatCorto(date)} a {formatCorto(hasta)}. Total {formatARS(monto * meses)}.
                </>
              )}
            </p>
          )}
        </div>
      )}

      {movimiento?.installments && (
        <p className="rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-text-secondary">
          Cuota {movimiento.installment} de {movimiento.installments}. Lo que cambies acá vale
          solo para esta cuota.
        </p>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Nota
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Opcional"
          className="field resize-none"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {esNuevo && date !== fechaPorDefecto && date > todayISO() && (
        <p className="text-xs text-text-muted">Queda anotado a futuro.</p>
      )}
    </Modal>
  )
}
