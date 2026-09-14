import { useState } from 'react'
import {
  useSaveItem,
  useDeleteItem,
  useCreateRecurringItems,
  useRescheduleItemSeries,
  useDeleteItemSeries
} from '@/hooks/useItems'
import { ETIQUETA_REPETICION } from '@/lib/queries/items'
import { addMonthsISO, formatCorto } from '@/lib/dates'
import { itemColor, pastel } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import { useTaku } from '@/components/taku/TakuProvider'
import ColorSwatches from '@/components/ui/ColorSwatches'
import Modal from '@/components/ui/Modal'
import type { TabWithFields } from '@/lib/queries/tabs'
import type { Item, Recurrence } from '@/types/database.types'

interface Props {
  tabs: TabWithFields[]
  item?: Item
  /** Fecha con la que se precarga un ítem nuevo. */
  defaultDate: string
  /** Pestaña con la que arranca un ítem nuevo (la activa en la barra). */
  defaultTabId?: string | null
  onClose: () => void
}

export default function ItemEditorModal({
  tabs,
  item,
  defaultDate,
  defaultTabId,
  onClose
}: Props) {
  const saveMutation = useSaveItem()
  const deleteMutation = useDeleteItem()
  const recurringMutation = useCreateRecurringItems()
  const rescheduleMutation = useRescheduleItemSeries()
  const deleteSeriesMutation = useDeleteItemSeries()
  const taku = useTaku()

  const [tabId, setTabId] = useState(item?.tab_id ?? defaultTabId ?? tabs[0]?.id ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [date, setDate] = useState(item?.date ?? defaultDate)
  const [nota, setNota] = useState(item?.note ?? '')
  const [color, setColor] = useState<PaletteKey | null>(item?.color ?? null)
  const [customData, setCustomData] = useState<Record<string, unknown>>(item?.custom_data ?? {})
  const [repeticion, setRepeticion] = useState<Recurrence | ''>(item?.recurrence ?? '')
  // Si la tarea ya viene con fecha de fin se respeta tal cual; si no, se
  // ofrecen duraciones, que es como lo piensa quien la usa ("un mes").
  const [hastaModo, setHastaModo] = useState<'1' | '3' | '6' | '12' | 'fecha'>(
    item?.recurrence_until ? 'fecha' : '1'
  )
  const [hastaFecha, setHastaFecha] = useState(item?.recurrence_until ?? '')
  const [error, setError] = useState<string | null>(null)

  const hasta = hastaModo === 'fecha' ? hastaFecha : addMonthsISO(date, Number(hastaModo))

  // Con qué repetición y hasta cuándo entró al modal, para no regenerar la
  // serie entera si el usuario solo cambió el título.
  const repeticionOriginal = item?.recurrence ?? ''
  const hastaOriginal = item?.recurrence_until ?? ''
  const cambioLaRepeticion =
    repeticion !== repeticionOriginal || (repeticion !== '' && hasta !== hastaOriginal)

  const activeTab = tabs.find((t) => t.id === tabId)
  const fields = activeTab?.tab_fields ?? []
  /** Lo que se va a ver: el color propio, o el de la pestaña si no eligió. */
  const colorEfectivo = itemColor(color, activeTab?.color)

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
      const datos = {
        id: item?.id,
        tabId,
        title: title.trim(),
        date,
        note: nota,
        color,
        // Solo se guardan las claves de los campos que la pestaña tiene hoy:
        // si un campo se borró del editor, su valor viejo no se arrastra.
        customData: Object.fromEntries(
          fields
            .filter((f) => customData[f.id] !== undefined && customData[f.id] !== '')
            .map((f) => [f.id, customData[f.id]])
        )
      }

      if (!item && repeticion) {
        if (!hasta) throw new Error('Elegí hasta cuándo se repite.')
        await recurringMutation.mutateAsync({ ...datos, recurrence: repeticion, until: hasta })
        // El único guardado cuyo resultado no se ve: en el día queda una sola
        // fila y el resto de las ocurrencias se reparte por el futuro. Taku
        // confirma lo que la pantalla no puede mostrar.
        taku.decir({
          prioridad: 1,
          estado: 'festejando',
          texto: `Listo. "${datos.title}" se repite ${ETIQUETA_REPETICION[
            repeticion
          ].toLowerCase()} hasta el ${formatCorto(hasta)}.`
        })
      } else {
        // Primero los datos, después la repetición: reagendar arranca desde la
        // fecha del ítem, y esa fecha puede haber cambiado recién.
        await saveMutation.mutateAsync(datos)
        if (item && cambioLaRepeticion) {
          await rescheduleMutation.mutateAsync({
            itemId: item.id,
            recurrence: repeticion || null,
            until: repeticion ? hasta : null
          })
        }
      }

      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el ítem.')
    }
  }

  async function handleDeleteSeries() {
    if (!item?.series_id) return
    if (!window.confirm(`¿Eliminar "${item.title}" y todas sus repeticiones?`)) return
    setError(null)
    try {
      await deleteSeriesMutation.mutateAsync(item.series_id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la serie.')
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

  const label = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted'

  return (
    <Modal
      title={item ? 'Editar tarea' : 'Nueva tarea'}
      onClose={onClose}
      accent={colorEfectivo}
      footer={
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saveMutation.isPending || recurringMutation.isPending}
            className="btn-primary flex-1"
          >
            {saveMutation.isPending || recurringMutation.isPending
              ? 'Guardando…'
              : item
                ? 'Guardar cambios'
                : 'Crear tarea'}
          </button>
          {item && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn-ghost text-danger hover:text-danger"
            >
              Eliminar
            </button>
          )}
        </div>
      }
    >
      <div>
        <label className={label}>Pestaña</label>
        <select value={tabId} onChange={(e) => setTabId(e.target.value)} className="field">
          {tabs.map((t) => (
            <option key={t.id} value={t.id} className="bg-bg-deep">
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>Título</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Pagar la luz"
          className="field"
          autoFocus
        />
      </div>

      <div>
        <label className={label}>Fecha</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label className={label}>Nota</label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="Ej: Entrenamiento de piernas. Llevar botella de agua."
          className="field resize-y"
        />
        <p className="mt-1 text-xs text-text-muted">
          Opcional. En las listas aparece como un ícono que despliega el texto.
        </p>
      </div>

      <div>
        <label className={label}>Color</label>
        <ColorSwatches
          value={color}
          onChange={setColor}
          heredaLabel={activeTab ? `Igual que ${activeTab.name}` : undefined}
          onHeredar={() => setColor(null)}
        />
      </div>

      <div>
        {/* La repetición se ofrece igual al crear que al editar. Al editar,
            los cambios valen de esta fecha en adelante: las ocurrencias
            anteriores son pasado y varias pueden estar ya tildadas. */}
        <label className={label}>Repetir</label>
        <select
          value={repeticion}
          onChange={(e) => setRepeticion(e.target.value as Recurrence | '')}
          className="field"
        >
          <option value="" className="bg-bg-deep">
            No se repite
          </option>
          {(Object.keys(ETIQUETA_REPETICION) as Recurrence[]).map((r) => (
            <option key={r} value={r} className="bg-bg-deep">
              {ETIQUETA_REPETICION[r]}
            </option>
          ))}
        </select>

        {repeticion && (
          <div className="mt-2 space-y-2">
            <select
              value={hastaModo}
              onChange={(e) => setHastaModo(e.target.value as typeof hastaModo)}
              className="field"
              aria-label="Hasta cuándo se repite"
            >
              <option value="1" className="bg-bg-deep">
                Dentro de 1 mes
              </option>
              <option value="3" className="bg-bg-deep">
                Dentro de 3 meses
              </option>
              <option value="6" className="bg-bg-deep">
                Dentro de 6 meses
              </option>
              <option value="12" className="bg-bg-deep">
                Dentro de 1 año
              </option>
              <option value="fecha" className="bg-bg-deep">
                Hasta una fecha…
              </option>
            </select>

            {hastaModo === 'fecha' && (
              <input
                type="date"
                value={hastaFecha}
                min={date}
                onChange={(e) => setHastaFecha(e.target.value)}
                className="field"
                aria-label="Fecha de fin"
              />
            )}

            <p className="text-xs text-text-muted">
              {hasta
                ? `Se repite hasta el ${hasta.split('-').reverse().join('/')}. Cada fecha se tilda por separado.`
                : 'Elegí hasta cuándo se repite.'}
            </p>
          </div>
        )}
      </div>

      {item?.series_id && (
        <div
          className="rounded-xl px-3 py-2.5"
          style={{
            background: pastel(colorEfectivo, 0.09),
            borderLeft: `2px solid ${pastel(colorEfectivo, 0.5)}`
          }}
        >
          <p className="text-xs text-text-secondary">
            {cambioLaRepeticion
              ? 'Al guardar se rehacen las repeticiones desde esta fecha en adelante. Las anteriores quedan como están.'
              : 'Esta tarea es parte de una serie. Lo que edites acá afecta solo a esta fecha.'}
          </p>
          <button
            type="button"
            onClick={handleDeleteSeries}
            disabled={deleteSeriesMutation.isPending}
            className="mt-1 text-xs text-danger underline disabled:opacity-60"
          >
            Eliminar la serie completa
          </button>
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-3 border-t border-white/[0.07] pt-4">
          <p className={label}>Campos de {activeTab?.name}</p>
          {fields.map((f) => {
            const value = customData[f.id]
            if (f.type === 'boolean') {
              return (
                <label key={f.id} className="flex items-center gap-2.5 text-sm">
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
                <label className={label}>
                  {f.name}
                  {f.type === 'currency' && <span className="text-text-muted"> (ARS)</span>}
                </label>
                {f.type === 'select' ? (
                  <select
                    value={String(value ?? '')}
                    onChange={(e) => setFieldValue(f.id, e.target.value)}
                    className="field"
                  >
                    <option value="" className="bg-bg-deep">
                      —
                    </option>
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o} className="bg-bg-deep">
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
                    className="field"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}
    </Modal>
  )
}
