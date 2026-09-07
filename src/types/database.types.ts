export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'select'

export type CategoryColor =
  | 'peach'
  | 'sky'
  | 'mint'
  | 'blush'
  | 'lavender'
  | 'butter'
  | 'seafoam'

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

/** Cada cuánto se repite una tarea. null = no se repite. */
export type Recurrence = 'daily' | 'weekly' | 'monthly'

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
}
