import type { PaletteKey } from '@/lib/palette'

export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'select'

/**
 * El color de pestañas e ítems sale de la misma paleta. Se reexporta con el
 * nombre viejo para no tocar cada import, pero la fuente es lib/palette.ts.
 */
export type CategoryColor = PaletteKey

/** Cada cuánto se repite una tarea. null = no se repite. */
export type Recurrence = 'daily' | 'weekly' | 'monthly'

export interface TabField {
  id: string
  tab_id: string
  name: string
  type: FieldType
  options: string[] | null
  sort_order: number
}

export interface Tab {
  id: string
  user_id: string
  name: string
  color: CategoryColor
  sort_order: number
  amount_field_id: string | null
}

export interface Item {
  id: string
  user_id: string
  tab_id: string
  title: string
  date: string
  completed: boolean
  sort_order: number
  custom_data: Record<string, unknown>
  /** Une a todas las ocurrencias de una misma tarea repetida. */
  series_id: string | null
  recurrence: Recurrence | null
  /** Hasta cuándo llega la serie. */
  recurrence_until: string | null
  /** Texto libre opcional. null si nunca se escribió. */
  note: string | null
  /** Color propio. null = hereda el de su pestaña. */
  color: CategoryColor | null
}
