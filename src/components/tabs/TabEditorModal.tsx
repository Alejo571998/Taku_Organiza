import { useState } from 'react'
import { useSaveTab, useDeleteTab } from '@/hooks/useTabs'
import type { TabWithFields } from '@/lib/queries/tabs'
import { SortableList, SortableRow } from '@/components/ui/SortableList'
import type { CategoryColor, FieldType } from '@/types/database.types'

const COLORS: { key: CategoryColor; label: string }[] = [
  { key: 'peach', label: 'Durazno' },
  { key: 'sky', label: 'Cielo' },
  { key: 'mint', label: 'Menta' },
  { key: 'blush', label: 'Rosa' },
  { key: 'lavender', label: 'Lavanda' },
  { key: 'butter', label: 'Manteca' },
  { key: 'seafoam', label: 'Espuma de mar' }
]

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
  const [color, setColor] = useState<CategoryColor>(tab?.color ?? 'peach')
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
    setFields((prev) => [...prev, { clientKey: makeClientKey(), name: '', type: 'text', options: [] }])
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-card border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">{tab ? 'Editar pestaña' : 'Nueva pestaña'}</h2>
          <button onClick={onClose} className="text-text-secondary text-sm" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <label className="text-sm text-text-secondary block mb-1">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Gastos del auto"
          className="w-full rounded border border-border px-3 py-2 text-sm mb-4 bg-surface"
        />

        <label className="text-sm text-text-secondary block mb-2">Color</label>
        <div className="flex gap-2 flex-wrap mb-5">
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              onClick={() => setColor(c.key)}
              style={{ background: `var(--cat-${c.key})` }}
              className={`w-7 h-7 rounded-full ${
                color === c.key ? 'ring-2 ring-offset-2 ring-text-primary' : ''
              }`}
            />
          ))}
        </div>

        <div className="border-t border-border pt-4 mb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm text-text-secondary">Campos personalizados</p>
            <button
              type="button"
              onClick={addField}
              className="shrink-0 text-sm border border-border rounded px-2 py-1 whitespace-nowrap"
            >
              + Agregar campo
            </button>
          </div>
          {/* Sin esta aclaración la gente crea un campo "Título" a mano y
              después el formulario del ítem lo pide dos veces. */}
          <p className="text-xs text-text-muted mb-3">
            Todo ítem ya trae <strong>Título</strong> y <strong>Fecha</strong>. Agregá acá solo lo
            propio de esta pestaña.
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
            className="flex flex-col gap-3"
          >
            {fields.map((f) => (
              <SortableRow
                key={f.clientKey}
                id={f.clientKey}
                className="flex items-start gap-1 rounded border border-border bg-bg p-2"
              >
              {/* Nombre y tipo van uno debajo del otro. Puestos en la misma
                  fila no entraban ni en desktop y el modal scrolleaba en
                  horizontal, que fue lo que reportó el primer usuario. */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex gap-2 items-start">
                  <input
                    value={f.name}
                    onChange={(e) => updateField(f.clientKey, { name: e.target.value })}
                    placeholder="Nombre del campo"
                    className="min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-sm bg-surface"
                  />
                  <button
                    type="button"
                    onClick={() => removeField(f.clientKey)}
                    className="shrink-0 text-text-secondary text-sm px-1 py-1.5"
                    aria-label="Eliminar campo"
                  >
                    ✕
                  </button>
                </div>
                <select
                  value={f.type}
                  onChange={(e) => updateField(f.clientKey, { type: e.target.value as FieldType })}
                  className="w-full rounded border border-border px-2 py-1.5 text-sm bg-surface"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {f.type === 'select' && (
                  <input
                    value={f.options.join(', ')}
                    onChange={(e) =>
                      updateField(f.clientKey, {
                        options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      })
                    }
                    placeholder="Opciones separadas por coma"
                    className="w-full rounded border border-border px-2 py-1.5 text-sm bg-surface"
                  />
                )}
              </div>
              </SortableRow>
            ))}
          </SortableList>
          <div>
            {fields.length === 0 && (
              <p className="text-sm text-text-muted italic">Sin campos propios todavía.</p>
            )}
          </div>
        </div>

        {amountEligibleFields.length > 0 && (
          <div className="mb-5">
            <label className="text-sm text-text-secondary block mb-1">Comparativa mensual usa</label>
            <select
              value={effectiveAmountFieldKey ?? ''}
              onChange={(e) => setAmountFieldKey(e.target.value || null)}
              className="w-full rounded border border-border px-3 py-2 text-sm bg-surface"
            >
              <option value="">Ninguno</option>
              {amountEligibleFields.map((f) => (
                <option key={f.clientKey} value={f.clientKey}>
                  {f.name || '(sin nombre)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-danger mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saveTabMutation.isPending}
            className="flex-1 bg-accent text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saveTabMutation.isPending ? 'Guardando...' : tab ? 'Guardar cambios' : 'Crear pestaña'}
          </button>
          {tab && (
            <button
              onClick={handleDelete}
              disabled={deleteTabMutation.isPending}
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
