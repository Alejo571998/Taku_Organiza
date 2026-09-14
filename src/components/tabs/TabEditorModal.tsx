import { useState } from 'react'
import { useSaveTab, useDeleteTab } from '@/hooks/useTabs'
import { SortableList, SortableRow } from '@/components/ui/SortableList'
import ColorSwatches from '@/components/ui/ColorSwatches'
import Modal from '@/components/ui/Modal'
import { safeColor } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import type { TabWithFields } from '@/lib/queries/tabs'
import type { FieldType } from '@/types/database.types'

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Notas (texto libre)' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moneda (ARS)' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Casilla sí/no' },
  { value: 'select', label: 'Lista de opciones' }
]

interface FieldFormValue {
  clientKey: string
  id?: string
  name: string
  type: FieldType
  options: string[]
}

function makeClientKey() {
  return Math.random().toString(36).slice(2)
}

interface Props {
  tab?: TabWithFields
  onClose: () => void
}

export default function TabEditorModal({ tab, onClose }: Props) {
  const saveTabMutation = useSaveTab()
  const deleteTabMutation = useDeleteTab()

  const [name, setName] = useState(tab?.name ?? '')
  const [color, setColor] = useState<PaletteKey>(safeColor(tab?.color))
  const [fields, setFields] = useState<FieldFormValue[]>(
    tab?.tab_fields.map((f) => ({
      clientKey: f.id,
      id: f.id,
      name: f.name,
      type: f.type,
      options: f.options ?? []
    })) ?? []
  )
  const [amountFieldKey, setAmountFieldKey] = useState<string | null>(
    tab?.tab_fields.find((f) => f.id === tab.amount_field_id)?.id ?? null
  )
  const [error, setError] = useState<string | null>(null)

  const amountEligibleFields = fields.filter((f) => f.type === 'number' || f.type === 'currency')

  // El campo elegido puede haber dejado de ser elegible (le cambiaron el tipo
  // a texto, por ejemplo). Se recalcula en cada render en vez de sincronizar
  // el estado a mano, así el select y lo que se guarda nunca se desfasan.
  const effectiveAmountFieldKey =
    amountFieldKey && amountEligibleFields.some((f) => f.clientKey === amountFieldKey)
      ? amountFieldKey
      : null

  function addField() {
    setFields((prev) => [
      ...prev,
      { clientKey: makeClientKey(), name: '', type: 'text', options: [] }
    ])
  }

  function updateField(clientKey: string, patch: Partial<FieldFormValue>) {
    setFields((prev) => prev.map((f) => (f.clientKey === clientKey ? { ...f, ...patch } : f)))
  }

  // No hace falta acordarse de qué campos se sacaron: save_tab recibe el
  // estado final y borra en el servidor todo lo que no venga en la lista.
  function removeField(clientKey: string) {
    setFields((prev) => prev.filter((f) => f.clientKey !== clientKey))
    if (amountFieldKey === clientKey) setAmountFieldKey(null)
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Ponele un nombre a la pestaña primero.')
      return
    }
    setError(null)
    try {
      await saveTabMutation.mutateAsync({
        id: tab?.id,
        name: name.trim(),
        color,
        fields: fields.map((f) => ({
          id: f.id,
          name: f.name.trim() || 'Campo sin nombre',
          type: f.type,
          options: f.type === 'select' ? f.options : null,
          isAmount: f.clientKey === effectiveAmountFieldKey
        }))
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la pestaña.')
    }
  }

  async function handleDelete() {
    if (!tab?.id) return
    const confirmed = window.confirm(
      `¿Eliminar "${tab.name}" y todos sus ítems? Esta acción no se puede deshacer.`
    )
    if (!confirmed) return
    setError(null)
    try {
      await deleteTabMutation.mutateAsync(tab.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la pestaña.')
    }
  }

  const label = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted'

  return (
    <Modal
      title={tab ? 'Editar pestaña' : 'Nueva pestaña'}
      onClose={onClose}
      accent={color}
      footer={
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saveTabMutation.isPending}
            className="btn-primary flex-1"
          >
            {saveTabMutation.isPending ? 'Guardando…' : tab ? 'Guardar cambios' : 'Crear pestaña'}
          </button>
          {tab && (
            <button
              onClick={handleDelete}
              disabled={deleteTabMutation.isPending}
              className="btn-ghost text-danger hover:text-danger"
            >
              Eliminar
            </button>
          )}
        </div>
      }
    >
      <div>
        <label className={label}>Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Gastos del auto"
          className="field"
          autoFocus
        />
      </div>

      <div>
        <label className={label}>Color</label>
        <ColorSwatches value={color} onChange={setColor} />
      </div>

      <div className="border-t border-white/[0.07] pt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className={`${label} mb-0`}>Campos personalizados</p>
          <button
            type="button"
            onClick={addField}
            className="btn-ghost shrink-0 whitespace-nowrap px-2.5 py-1 text-xs"
          >
            + Agregar campo
          </button>
        </div>
        {/* Sin esta aclaración la gente crea un campo "Título" a mano y
            después el formulario de la tarea lo pide dos veces. */}
        <p className="mb-3 text-xs text-text-muted">
          Toda tarea ya trae <strong className="text-text-secondary">Título</strong>,{' '}
          <strong className="text-text-secondary">Fecha</strong> y{' '}
          <strong className="text-text-secondary">Nota</strong>. Agregá acá solo lo propio de
          esta pestaña.
        </p>

        <SortableList
          ids={fields.map((f) => f.clientKey)}
          onReorder={(ids) =>
            setFields((prev) =>
              ids
                .map((k) => prev.find((f) => f.clientKey === k))
                .filter((f): f is FieldFormValue => Boolean(f))
            )
          }
          className="flex flex-col gap-2.5"
        >
          {fields.map((f) => (
            <SortableRow
              key={f.clientKey}
              id={f.clientKey}
              className="flex items-start gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-2.5"
            >
              {/* Nombre y tipo van uno debajo del otro. Puestos en la misma
                  fila no entraban ni en desktop y el modal scrolleaba en
                  horizontal, que fue lo que reportó el primer usuario. */}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start gap-2">
                  <input
                    value={f.name}
                    onChange={(e) => updateField(f.clientKey, { name: e.target.value })}
                    placeholder="Nombre del campo"
                    className="field min-w-0 flex-1 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => removeField(f.clientKey)}
                    className="shrink-0 px-1 py-1.5 text-sm text-text-muted hover:text-danger"
                    aria-label="Eliminar campo"
                  >
                    ✕
                  </button>
                </div>
                <select
                  value={f.type}
                  onChange={(e) => updateField(f.clientKey, { type: e.target.value as FieldType })}
                  className="field py-1.5"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-bg-deep">
                      {t.label}
                    </option>
                  ))}
                </select>
                {f.type === 'select' && (
                  <input
                    value={f.options.join(', ')}
                    onChange={(e) =>
                      updateField(f.clientKey, {
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      })
                    }
                    placeholder="Opciones separadas por coma"
                    className="field py-1.5"
                  />
                )}
              </div>
            </SortableRow>
          ))}
        </SortableList>

        {fields.length === 0 && (
          <p className="text-sm italic text-text-muted">Sin campos propios todavía.</p>
        )}
      </div>

      {amountEligibleFields.length > 0 && (
        <div>
          <label className={label}>Comparativa mensual usa</label>
          <select
            value={effectiveAmountFieldKey ?? ''}
            onChange={(e) => setAmountFieldKey(e.target.value || null)}
            className="field"
          >
            <option value="" className="bg-bg-deep">
              Ninguno
            </option>
            {amountEligibleFields.map((f) => (
              <option key={f.clientKey} value={f.clientKey} className="bg-bg-deep">
                {f.name || '(sin nombre)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
