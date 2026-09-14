import type { TabWithFields } from '@/lib/queries/tabs'
import type { Item } from '@/types/database.types'

/**
 * Resumen en una línea de los campos propios de la pestaña con valor.
 * Estaba duplicado en la vista diaria y en la lista de pestaña.
 */
export function itemSummary(item: Item, tab: TabWithFields | undefined): string {
  if (!tab) return ''
  return tab.tab_fields
    .map((f) => {
      const v = item.custom_data[f.id]
      if (v === undefined || v === '' || v === null) return null
      if (f.type === 'boolean') return v ? f.name : null
      if (f.type === 'currency')
        return `${f.name}: $${Number(v).toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`
      return `${f.name}: ${v}`
    })
    .filter(Boolean)
    .join(' · ')
}
