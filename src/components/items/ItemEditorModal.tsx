import { useState } from 'react'
import { useSaveItem, useDeleteItem } from '@/hooks/useItems'
import type { TabWithFields } from '@/lib/queries/tabs'
import type { Item } from '@/types/database.types'

interface Props {
  tabs: TabWithFields[]
  item?: Item
  /** Fecha con la que se precarga un ítem nuevo. */
  defaultDate: string
  /** Pestaña con la que arranca un ítem nuevo (la activa en la barra). */
  defaultTabId?: string | null
  /** Rango de la vista que abrió el modal, para invalidar su cache. */
  range: { from: string; to: string }
  onClose: () => void
}

export default function ItemEditorModal({
  tabs,
  item,
  defaultDate,
  defaultTabId,
  range,
  onClose
}: Props) {
  const saveMutation = useSaveItem(range.from, range.to)
  const deleteMutation = useDeleteItem(range.from, range.to)

  const [tabId, setTabId] = useState(item?.tab_id ?? defaultTabId ?? tabs[0]?.id ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [date, setDate] = useState(item?.date ?? defaultDate)
  const [customData, setCustomData] = useState<Record<string, unknown>>(item?.custom_data ?? {})
  const [error, setError] = useState<string | null>(null)

  const activeTab = tabs.find((t) => t.id === tabId)
  const fields = activeTab?.tab_fields ?? []

  function setFieldValue(fieldId: string, value: unknown) {
    setCustomData((prev) => ({ ...prev, [fieldId]: value }))
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Ponele un título al ítem.')
      return
    }
    if (!tabId) {
      setError('Elegí una pestaña.')
      return
    }
    setError(null)
    try {
      await saveMutation.mutateAsync({
        id: item?.id,
        tabId,
        title: title.trim(),
        date,
        // Solo se guardan las claves de los campos que la pestaña tiene hoy:
        // si un campo se borró del editor, su valor viejo no se arrastra.
        customData: Object.fromEntries(
          fields
            .filter((f) => customData[f.id] !== undefined && customData[f.id] !== '')
            .map((f) => [f.id, customData[f.id]])
        )
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el ítem.')
    }
  }

  async function handleDelete() {
    if (!item) return
    if (!window.confirm(`¿Eliminar "${item.title}"?`)) return
    setError(null)
    try {
      await deleteMutation.mutateAsync(item.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el ítem.')
    }
  }

  const inputClass = 'w-full rounded border border-border px-3 py-2 text-sm bg-surface'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-card border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">{item ? 'Editar ítem' : 'Nuevo ítem'}</h2>
          <button onClick={onClose} className="text-text-secondary text-sm" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <label className="text-sm text-text-secondary block mb-1">Pestaña</label>
        <select value={tabId} onChange={(e) => setTabId(e.target.value)} className={`${inputClass} mb-4`}>
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label className="text-sm text-text-secondary block mb-1">Título</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Pagar la luz"
          className={`${inputClass} mb-4`}
        />

        <label className="text-sm text-text-secondary block mb-1">Fecha</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputClass} mb-4`}
        />

        {fields.length > 0 && (
          <div className="border-t border-border pt-4 mb-4 flex flex-col gap-3">
            {fields.map((f) => {
              const value = customData[f.id]
              if (f.type === 'boolean') {
                return (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => setFieldValue(f.id, e.target.checked)}
                    />
                    {f.name}
                  </label>
                )
              }
              return (
                <div key={f.id}>
                  <label className="text-sm text-text-secondary block mb-1">
                    {f.name}
                    {f.type === 'currency' && <span className="text-text-muted"> (ARS)</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      value={String(value ?? '')}
                      onChange={(e) => setFieldValue(f.id, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'date' ? 'date' : f.type === 'text' ? 'text' : 'number'}
                      inputMode={f.type === 'currency' ? 'decimal' : undefined}
                      step={f.type === 'currency' ? '0.01' : undefined}
                      value={String(value ?? '')}
                      onChange={(e) => {
                        const raw = e.target.value
                        const isNumeric = f.type === 'number' || f.type === 'currency'
                        // Guardar números como number y no como string: la
                        // comparativa mensual va a sumar estos valores.
                        setFieldValue(f.id, isNumeric && raw !== '' ? Number(raw) : raw)
                      }}
                      className={inputClass}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="text-sm text-danger mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="flex-1 bg-accent text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Guardando...' : item ? 'Guardar cambios' : 'Crear ítem'}
          </button>
          {item && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="text-sm text-danger px-3 py-2 border border-border rounded disabled:opacity-60"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
