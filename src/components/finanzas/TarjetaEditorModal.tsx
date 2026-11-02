import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import ColorSwatches from '@/components/ui/ColorSwatches'
import { useSaveTarjeta, useDeleteTarjeta } from '@/hooks/useFinanzas'
import { PALETTE, safeColor } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import type { FinCard } from '@/types/database.types'

export default function TarjetaEditorModal({
  tarjeta,
  onClose
}: {
  tarjeta?: FinCard
  onClose: () => void
}) {
  const guardar = useSaveTarjeta()
  const borrar = useDeleteTarjeta()

  const [name, setName] = useState(tarjeta?.name ?? '')
  const [color, setColor] = useState<PaletteKey>(safeColor(tarjeta?.color ?? PALETTE[6].key))
  const [closingDay, setClosingDay] = useState(tarjeta?.closing_day?.toString() ?? '')
  const [dueDay, setDueDay] = useState(tarjeta?.due_day?.toString() ?? '')
  const [active, setActive] = useState(tarjeta?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const dia = (t: string) => {
    const n = Number(t)
    return t.trim() && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Ponele un nombre a la tarjeta.')
      return
    }
    setError(null)
    try {
      await guardar.mutateAsync({
        id: tarjeta?.id,
        name: name.trim(),
        color,
        closingDay: dia(closingDay),
        dueDay: dia(dueDay),
        active
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  async function handleBorrar() {
    if (!tarjeta) return
    if (
      !window.confirm(
        `¿Borrar la tarjeta "${tarjeta.name}"?\n\nLos consumos NO se borran: quedan sueltos y se siguen contando en el mes.`
      )
    )
      return
    try {
      await borrar.mutateAsync(tarjeta.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.')
    }
  }

  return (
    <Modal
      title={tarjeta ? 'Editar tarjeta' : 'Nueva tarjeta'}
      accent={color}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {tarjeta && (
            <button
              onClick={handleBorrar}
              disabled={borrar.isPending}
              className="btn-ghost px-3 py-2 text-sm text-danger"
            >
              Borrar
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={guardar.isPending}
            className="btn-primary ml-auto"
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Nombre
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Visa, Mastercard"
          className="field"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Color
        </label>
        <ColorSwatches value={color} onChange={setColor} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Cierra el día
          </label>
          <input
            inputMode="numeric"
            value={closingDay}
            onChange={(e) => setClosingDay(e.target.value)}
            placeholder="—"
            className="field"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Vence el día
          </label>
          <input
            inputMode="numeric"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            placeholder="—"
            className="field"
          />
        </div>
      </div>
      <p className="-mt-1 text-xs text-text-muted">
        Opcionales. Son un recordatorio: el resumen se calcula con los consumos que cargues,
        no con estas fechas.
      </p>

      {tarjeta && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Activa
          <span className="text-xs text-text-muted">
            — desactivarla la saca de la lista sin perder el historial
          </span>
        </label>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  )
}
