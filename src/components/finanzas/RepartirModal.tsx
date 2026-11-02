import { useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useRepartirIngreso } from '@/hooks/useFinanzas'
import { parsearMonto, montoParaEditar, formatARS } from '@/lib/dinero'
import { formatCorto } from '@/lib/dates'
import { safeColor, pastel } from '@/lib/palette'
import type { FinCategory, FinMovement } from '@/types/database.types'

/** Trabaja en centavos: sumar pesos con decimales acumula error. */
const cent = (n: number) => Math.round(n * 100)

interface Props {
  /** Ingreso del que sale la plata. Solo precarga el monto. */
  ingreso?: FinMovement
  /** Gastos del período que todavía deben algo. */
  pendientes: FinMovement[]
  categorias: FinCategory[]
  onClose: () => void
}

/**
 * Repartir plata entre varias deudas de una.
 *
 * Es la columna de la izquierda de la planilla: entra un ingreso y se va
 * aplicando a lo que se debe, a veces en partes, hasta que se acaba.
 *
 * NO se guarda qué ingreso pagó qué deuda. Esa trazabilidad obligaría a una
 * tabla de asignaciones y a mantenerla entera cada vez que se edita un monto,
 * y lo que la persona necesita saber es cuánto le falta a cada cuenta, no de
 * qué sobre salió cada peso. El monto a repartir arranca en el del ingreso
 * pero se puede cambiar: a veces se reparte parte y a veces plata que no
 * estaba anotada.
 */
export default function RepartirModal({ ingreso, pendientes, categorias, onClose }: Props) {
  const repartir = useRepartirIngreso()

  const [disponibleTexto, setDisponibleTexto] = useState(
    montoParaEditar(ingreso?.amount ?? 0)
  )
  const [asignado, setAsignado] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  // Primero lo que vence antes: es el orden en que se decide qué pagar.
  const ordenados = useMemo(
    () =>
      [...pendientes].sort((a, b) => {
        const va = a.due_date ?? '9999-12-31'
        const vb = b.due_date ?? '9999-12-31'
        return va !== vb ? va.localeCompare(vb) : b.amount - a.amount
      }),
    [pendientes]
  )

  const disponible = parsearMonto(disponibleTexto) ?? 0
  const falta = (m: FinMovement) => Math.max(0, m.amount - m.paid_amount)

  const totalAsignado =
    Object.values(asignado).reduce((acc, t) => acc + cent(parsearMonto(t) ?? 0), 0) / 100
  const sobrante = disponible - totalAsignado
  const pasado = sobrante < 0

  /** Reparte de arriba hacia abajo hasta que se acaba, como se hace a mano. */
  function automatico() {
    let resto = cent(disponible)
    const nuevo: Record<string, string> = {}
    for (const m of ordenados) {
      if (resto <= 0) break
      const debe = cent(falta(m))
      const aplicar = Math.min(debe, resto)
      if (aplicar > 0) {
        nuevo[m.id] = montoParaEditar(aplicar / 100)
        resto -= aplicar
      }
    }
    setAsignado(nuevo)
  }

  async function aplicar() {
    const asignaciones = Object.entries(asignado)
      .map(([id, texto]) => ({ id, monto: parsearMonto(texto) ?? 0 }))
      .filter((a) => a.monto > 0)

    if (asignaciones.length === 0) {
      setError('Todavía no asignaste nada.')
      return
    }
    if (pasado) {
      setError('Estás repartiendo más plata de la que pusiste arriba.')
      return
    }
    setError(null)

    try {
      await repartir.mutateAsync(asignaciones)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo repartir.')
    }
  }

  return (
    <Modal
      title="Repartir plata"
      accent="mint"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Sobra</p>
            <p
              className="text-sm font-semibold"
              style={{ color: pastel(pasado ? 'coral' : 'mint', 1) }}
            >
              {formatARS(sobrante)}
            </p>
          </div>
          <button
            onClick={aplicar}
            disabled={repartir.isPending || pasado}
            className="btn-primary ml-auto"
          >
            {repartir.isPending ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      }
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Cuánto vas a repartir
        </label>
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            value={disponibleTexto}
            onChange={(e) => setDisponibleTexto(e.target.value)}
            placeholder="0,00"
            className="field"
          />
          <button onClick={automatico} className="btn-ghost shrink-0 whitespace-nowrap">
            Repartir solo
          </button>
        </div>
        {ingreso && (
          <p className="mt-1 text-xs text-text-muted">
            Sale de «{ingreso.description}». Podés cambiar el monto.
          </p>
        )}
      </div>

      {ordenados.length === 0 ? (
        <p className="rounded-xl bg-white/[0.05] px-3 py-3 text-sm text-text-secondary">
          No hay nada pendiente en este período. Nada que repartir.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ordenados.map((m) => {
            const cat = categorias.find((c) => c.id === m.category_id)
            const color = safeColor(cat?.color ?? 'coral')
            const debe = falta(m)
            const puesto = parsearMonto(asignado[m.id] ?? '') ?? 0
            const quedaria = Math.max(0, debe - puesto)

            return (
              <div
                key={m.id}
                className="flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${pastel(color, 0.8)} 0px, ${pastel(color, 0.8)} 4px, ${pastel(color, 0.2)} 4px, transparent 70%)`
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.description}</p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-text-muted">
                    <span>falta {formatARS(debe)}</span>
                    {m.due_date && <span>vence {formatCorto(m.due_date)}</span>}
                    {puesto > 0 && (
                      <span style={{ color: pastel('mint', 1) }}>
                        {quedaria === 0 ? 'queda saldada' : `quedarían ${formatARS(quedaria)}`}
                      </span>
                    )}
                  </p>
                </div>

                <input
                  inputMode="decimal"
                  value={asignado[m.id] ?? ''}
                  onChange={(e) =>
                    setAsignado((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                  placeholder="0,00"
                  aria-label={`Cuánto aplicar a "${m.description}"`}
                  className="field w-28 shrink-0 text-right"
                />

                <button
                  onClick={() =>
                    setAsignado((prev) => ({ ...prev, [m.id]: montoParaEditar(debe) }))
                  }
                  className="shrink-0 text-xs text-accent-text underline"
                  title="Asignar lo que falta"
                >
                  todo
                </button>
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-xs text-text-muted">
        Lo que asignes se suma a lo ya pagado de cada cuenta. Si ponés de más, se recorta solo
        hasta lo que falta: no se puede pagar más que la deuda.
      </p>
    </Modal>
  )
}
