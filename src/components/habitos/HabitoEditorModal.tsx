import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import ColorSwatches from '@/components/ui/ColorSwatches'
import { useSaveHabito, useDeleteHabito } from '@/hooks/useHabitos'
import { PALETTE, safeColor } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import type { Habit } from '@/types/database.types'

/** 0 es domingo, como el getDay() de JavaScript; se muestra arrancando lunes. */
const DIAS: { valor: number; letra: string }[] = [
  { valor: 1, letra: 'L' },
  { valor: 2, letra: 'M' },
  { valor: 3, letra: 'M' },
  { valor: 4, letra: 'J' },
  { valor: 5, letra: 'V' },
  { valor: 6, letra: 'S' },
  { valor: 0, letra: 'D' }
]

export default function HabitoEditorModal({
  habito,
  onClose
}: {
  habito?: Habit
  onClose: () => void
}) {
  const guardar = useSaveHabito()
  const borrar = useDeleteHabito()

  const [name, setName] = useState(habito?.name ?? '')
  const [color, setColor] = useState<PaletteKey>(safeColor(habito?.color ?? PALETTE[0].key))
  const [weekdays, setWeekdays] = useState<number[]>(habito?.weekdays ?? [])
  const [active, setActive] = useState(habito?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const todosLosDias = weekdays.length === 0

  function alternarDia(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Ponele un nombre al hábito.')
      return
    }
    setError(null)
    try {
      await guardar.mutateAsync({ id: habito?.id, name: name.trim(), color, weekdays, active })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  async function handleBorrar() {
    if (!habito) return
    if (
      !window.confirm(`¿Borrar "${habito.name}"?\n\nSe pierde todo su seguimiento.`)
    )
      return
    try {
      await borrar.mutateAsync(habito.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.')
    }
  }

  return (
    <Modal
      title={habito ? 'Editar hábito' : 'Nuevo hábito'}
      accent={color}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {habito && (
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
          Hábito
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Caminar, Leer, Tomar agua"
          className="field"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Color
        </label>
        <ColorSwatches value={color} onChange={setColor} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Qué días
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d, i) => {
            const elegido = weekdays.includes(d.valor)
            return (
              <button
                key={i}
                onClick={() => alternarDia(d.valor)}
                aria-pressed={elegido}
                className={`h-10 w-10 rounded-xl border text-sm transition-colors ${
                  elegido
                    ? 'border-accent/50 bg-accent/20 font-semibold text-accent-text'
                    : 'border-white/10 bg-white/[0.04] text-text-secondary hover:bg-white/10'
                }`}
              >
                {d.letra}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          {todosLosDias
            ? 'Sin elegir ninguno corre todos los días.'
            : 'Los días que no elegiste no cuentan ni a favor ni en contra.'}
        </p>
      </div>

      {habito && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Activo
          <span className="text-xs text-text-muted">
            — desactivarlo lo saca de la lista sin borrar el historial
          </span>
        </label>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  )
}
