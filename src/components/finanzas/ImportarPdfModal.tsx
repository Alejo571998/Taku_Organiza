import { useMemo, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useImportarMovimientos } from '@/hooks/useFinanzas'
import { extraerTextoDePdf, parsearLineas } from '@/lib/importarPdf'
import type { LineaDetectada, OpcionesParseo } from '@/lib/importarPdf'
import { formatARS, parsearMonto, montoParaEditar } from '@/lib/dinero'
import { formatCorto, todayISO } from '@/lib/dates'
import { pastel } from '@/lib/palette'
import type { FinCard, FinCategory, FinMovement, MovementKind } from '@/types/database.types'

interface Props {
  categorias: FinCategory[]
  tarjetas: FinCard[]
  /** Los que ya están cargados, para avisar de repetidos. */
  existentes: FinMovement[]
  onClose: () => void
  onListo: (cuantos: number) => void
}

/** Misma fecha y mismo monto: casi seguro ya está cargado. */
function claveDeRepetido(fecha: string, monto: number) {
  return `${fecha}|${Math.round(monto * 100)}`
}

/**
 * Importar un resumen en PDF.
 *
 * Dos cosas que no se negocian acá:
 *
 * 1. El PDF NO SALE DEL NAVEGADOR. Se lee en la máquina de la persona y lo
 *    único que viaja a la base son los movimientos que confirmó.
 * 2. NO SE GUARDA NADA SOLO. Cada resumen tiene su formato; esto detecta
 *    candidatos y ella revisa, corrige y confirma. Un número mal leído que
 *    se guarda en silencio es peor que no tener la función, porque después
 *    el balance miente y no se sabe por qué.
 */
export default function ImportarPdfModal({
  categorias,
  tarjetas,
  existentes,
  onClose,
  onListo
}: Props) {
  const importar = useImportarMovimientos()
  const inputArchivo = useRef<HTMLInputElement>(null)

  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [lineasCrudas, setLineasCrudas] = useState<string[]>([])
  const [filas, setFilas] = useState<LineaDetectada[]>([])
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verCrudas, setVerCrudas] = useState(false)

  const [opciones, setOpciones] = useState<OpcionesParseo>({
    anio: Number(todayISO().slice(0, 4)),
    columna: 'ultimo'
  })
  const [categoryId, setCategoryId] = useState('')
  const [cardId, setCardId] = useState('')

  const repetidos = useMemo(
    () => new Set(existentes.map((m) => claveDeRepetido(m.date, m.amount))),
    [existentes]
  )

  async function elegirArchivo(archivo: File) {
    setError(null)
    setLeyendo(true)
    setNombreArchivo(archivo.name)
    try {
      const { lineas } = await extraerTextoDePdf(archivo)
      setLineasCrudas(lineas)
      const detectadas = parsearLineas(lineas, opciones)
      setFilas(detectadas)

      if (lineas.length === 0) {
        setError(
          'Este PDF no tiene texto: es una foto o un escaneo. Pedile a tu banco la versión digital, o cargá los movimientos a mano.'
        )
      } else if (detectadas.length === 0) {
        setError(
          'Se leyó el PDF pero no se reconoció ningún movimiento. Probá cambiar de qué columna sale el importe, o revisá el texto crudo acá abajo.'
        )
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        /password/i.test(msg)
          ? 'El PDF está protegido con contraseña. Abrilo, guardalo sin contraseña y volvé a intentar.'
          : `No se pudo leer el PDF. ${msg}`
      )
    } finally {
      setLeyendo(false)
    }
  }

  /** Reinterpreta lo ya leído, sin volver a abrir el archivo. */
  function reparsear(nuevas: Partial<OpcionesParseo>) {
    const siguiente = { ...opciones, ...nuevas }
    setOpciones(siguiente)
    if (lineasCrudas.length > 0) setFilas(parsearLineas(lineasCrudas, siguiente))
  }

  function editar(id: string, cambio: Partial<LineaDetectada>) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambio } : f)))
  }

  const elegidas = filas.filter((f) => f.incluir && f.fecha && f.monto && f.monto > 0)
  const totalGastos = elegidas
    .filter((f) => f.kind === 'gasto')
    .reduce((a, f) => a + Math.round((f.monto ?? 0) * 100), 0) / 100
  const totalIngresos = elegidas
    .filter((f) => f.kind === 'ingreso')
    .reduce((a, f) => a + Math.round((f.monto ?? 0) * 100), 0) / 100

  async function guardar() {
    if (elegidas.length === 0) {
      setError('No hay ninguna fila marcada para importar.')
      return
    }
    setError(null)
    try {
      await importar.mutateAsync(
        elegidas.map((f) => ({
          kind: f.kind,
          description: f.descripcion.slice(0, 200),
          amount: f.monto as number,
          date: f.fecha as string,
          categoryId: categoryId || null,
          cardId: cardId || null,
          method: cardId ? ('credito' as const) : null,
          installment: f.installment,
          installments: f.installments
        }))
      )
      onListo(elegidas.length)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar.')
    }
  }

  return (
    <Modal
      title="Importar un resumen en PDF"
      accent="aqua"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {filas.length > 0 && (
            <div className="min-w-0 text-xs">
              <p className="text-text-muted">
                {elegidas.length} de {filas.length} marcadas
              </p>
              <p className="truncate">
                <span style={{ color: pastel('coral', 1) }}>{formatARS(totalGastos)}</span>
                {totalIngresos > 0 && (
                  <>
                    {' · '}
                    <span style={{ color: pastel('mint', 1) }}>
                      +{formatARS(totalIngresos)}
                    </span>
                  </>
                )}
              </p>
            </div>
          )}
          <button
            onClick={guardar}
            disabled={importar.isPending || elegidas.length === 0}
            className="btn-primary ml-auto"
          >
            {importar.isPending ? 'Importando…' : `Importar ${elegidas.length || ''}`}
          </button>
        </div>
      }
    >
      <p className="rounded-xl bg-white/[0.05] px-3 py-2.5 text-xs text-text-secondary">
        El PDF se lee <strong className="text-text-primary">en tu teléfono o computadora</strong>:
        no se sube a ningún lado. Lo único que se guarda son los movimientos que marques acá.
      </p>

      <input
        ref={inputArchivo}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) elegirArchivo(f)
        }}
      />

      <button
        onClick={() => inputArchivo.current?.click()}
        disabled={leyendo}
        className="w-full rounded-card border border-dashed border-white/15 px-4 py-6 text-center transition-colors hover:border-accent/40 hover:bg-white/[0.04]"
      >
        <p className="text-sm font-medium">
          {leyendo ? 'Leyendo el PDF…' : nombreArchivo ? nombreArchivo : 'Elegir un PDF'}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {nombreArchivo && !leyendo ? 'Tocá para cambiarlo' : 'Resumen de tarjeta o extracto'}
        </p>
      </button>

      {error && <p className="text-sm text-danger">{error}</p>}

      {filas.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Año
              </label>
              <input
                inputMode="numeric"
                value={opciones.anio}
                onChange={(e) => reparsear({ anio: Number(e.target.value) || opciones.anio })}
                className="field"
              />
              <p className="mt-1 text-xs text-text-muted">Para las fechas sin año.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                El importe es
              </label>
              <select
                value={opciones.columna}
                onChange={(e) =>
                  reparsear({ columna: e.target.value as OpcionesParseo['columna'] })
                }
                className="field"
              >
                <option value="ultimo">El último número de la fila</option>
                <option value="anteultimo">El anteúltimo (si el último es el saldo)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Categoría para todas
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="field"
              >
                <option value="">Sin categoría</option>
                {categorias
                  .filter((c) => c.kind === 'gasto')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Tarjeta
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="field"
              >
                <option value="">Ninguna</option>
                {tarjetas
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {filas.map((f) => {
              const repetido =
                f.fecha && f.monto ? repetidos.has(claveDeRepetido(f.fecha, f.monto)) : false
              return (
                <div
                  key={f.id}
                  className={`rounded-xl px-3 py-2 transition-opacity ${
                    f.incluir ? 'bg-white/[0.05]' : 'bg-white/[0.02] opacity-55'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={f.incluir}
                      onChange={(e) => editar(f.id, { incluir: e.target.checked })}
                      className="shrink-0"
                      aria-label={`Importar "${f.descripcion}"`}
                    />
                    <span className="w-14 shrink-0 text-xs text-text-muted">
                      {f.fecha ? formatCorto(f.fecha) : '—'}
                    </span>
                    <input
                      value={f.descripcion}
                      onChange={(e) => editar(f.id, { descripcion: e.target.value })}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none focus:underline"
                      aria-label="Descripción"
                    />
                    <select
                      value={f.kind}
                      onChange={(e) => editar(f.id, { kind: e.target.value as MovementKind })}
                      className="shrink-0 bg-transparent text-xs text-text-muted outline-none"
                      aria-label="Gasto o ingreso"
                    >
                      <option value="gasto">gasto</option>
                      <option value="ingreso">ingreso</option>
                    </select>
                    <input
                      inputMode="decimal"
                      value={f.monto === null ? '' : montoParaEditar(f.monto)}
                      onChange={(e) => editar(f.id, { monto: parsearMonto(e.target.value) })}
                      className="w-24 shrink-0 bg-transparent text-right text-sm outline-none focus:underline"
                      aria-label="Monto"
                    />
                  </div>

                  {(f.motivo || repetido || f.installments) && (
                    <p className="mt-0.5 flex flex-wrap gap-x-2 pl-6 text-[11px]">
                      {f.motivo && <span className="text-text-muted">{f.motivo}</span>}
                      {repetido && (
                        <span style={{ color: pastel('butter', 1) }}>
                          Ya hay uno con esa fecha y ese monto
                        </span>
                      )}
                      {f.installments && (
                        <span className="text-text-muted">
                          cuota {f.installment}/{f.installments}
                        </span>
                      )}
                    </p>
                  )}

                  {verCrudas && (
                    <p className="mt-1 pl-6 font-mono text-[10px] leading-tight text-text-muted">
                      {f.cruda}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={() => setVerCrudas(!verCrudas)}
            className="self-start text-xs text-accent-text underline"
          >
            {verCrudas ? 'Ocultar' : 'Ver'} el texto original de cada fila
          </button>

          <p className="text-xs text-text-muted">
            Revisá antes de importar: cada banco arma el resumen distinto y algo se puede haber
            leído mal. Podés corregir la descripción y el monto acá mismo.
          </p>
        </>
      )}
    </Modal>
  )
}
