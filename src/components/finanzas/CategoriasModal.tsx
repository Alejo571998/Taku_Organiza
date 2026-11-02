import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import ColorSwatches from '@/components/ui/ColorSwatches'
import { useSaveCategoria, useDeleteCategoria } from '@/hooks/useFinanzas'
import { PALETTE, safeColor, pastel } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import type { FinCategory, MovementKind } from '@/types/database.types'

/**
 * Las categorías las arma cada persona. No vienen precargadas a propósito: una
 * lista ajena ("Ocio", "Transporte") obliga a traducir la vida propia a las
 * palabras de otro, y la planilla de la que sale todo esto usa las suyas.
 *
 * Borrar una categoría NO borra sus movimientos: la FK los deja sin categoría
 * y se siguen sumando al total. Perder el historial de gastos por reordenar
 * las etiquetas sería un desastre silencioso.
 */
export default function CategoriasModal({
  categorias,
  onClose
}: {
  categorias: FinCategory[]
  onClose: () => void
}) {
  const guardar = useSaveCategoria()
  const borrar = useDeleteCategoria()

  const [nombre, setNombre] = useState('')
  const [kind, setKind] = useState<MovementKind>('gasto')
  const [color, setColor] = useState<PaletteKey>(PALETTE[0].key)
  const [error, setError] = useState<string | null>(null)

  async function agregar() {
    if (!nombre.trim()) {
      setError('Ponele un nombre.')
      return
    }
    setError(null)
    try {
      await guardar.mutateAsync({ name: nombre.trim(), kind, color })
      setNombre('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  async function eliminar(c: FinCategory) {
    if (
      !window.confirm(
        `¿Borrar la categoría "${c.name}"?\n\nLos movimientos que la usaban no se borran: quedan sin categoría.`
      )
    )
      return
    try {
      await borrar.mutateAsync(c.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.')
    }
  }

  const porTipo = (k: MovementKind) => categorias.filter((c) => c.kind === k)

  return (
    <Modal title="Categorías" onClose={onClose}>
      <div className="glass rounded-card p-3">
        <div className="mb-2 flex gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') agregar()
            }}
            placeholder="Nombre de la categoría"
            className="field"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MovementKind)}
            className="field w-32 shrink-0"
          >
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
        </div>

        <ColorSwatches value={color} onChange={setColor} />

        <button
          onClick={agregar}
          disabled={guardar.isPending}
          className="btn-primary mt-3 w-full"
        >
          Agregar
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {(['gasto', 'ingreso'] as MovementKind[]).map((k) => (
        <div key={k}>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
            {k === 'gasto' ? 'Gastos' : 'Ingresos'}
          </p>
          {porTipo(k).length === 0 && (
            <p className="text-sm italic text-text-muted">Todavía ninguna.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {porTipo(k).map((c) => {
              const col = safeColor(c.color)
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: pastel(col, 0.12) }}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: pastel(col, 1) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <button
                    onClick={() => eliminar(c)}
                    className="shrink-0 text-xs text-text-muted transition-colors hover:text-danger"
                  >
                    Borrar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </Modal>
  )
}
