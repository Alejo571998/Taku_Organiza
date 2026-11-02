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

// ============================================================
// Finanzas
//
// La estructura sale de cómo se organiza la usuaria en su planilla:
// obligaciones del mes con vencimiento, fijos que se repiten, cuotas
// "n de m", ingresos de varias fuentes y pagos PARCIALES.
// ============================================================

export type MovementKind = 'gasto' | 'ingreso'

export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro'

export interface FinCategory {
  id: string
  user_id: string
  name: string
  kind: MovementKind
  color: CategoryColor | null
  sort_order: number
}

export interface FinMovement {
  id: string
  user_id: string
  category_id: string | null
  kind: MovementKind
  description: string
  amount: number
  /**
   * Cuánto se pagó de `amount`. No es un booleano a propósito: en la
   * planilla los pagos van por partes ("2300,62 / 253553,18"), y un
   * sí/no perdería justo el dato que ella lleva a mano.
   */
  paid_amount: number
  date: string
  due_date: string | null
  method: PaymentMethod | null
  note: string | null
  /** Une a las cuotas de un mismo consumo, o a los meses de un fijo. */
  series_id: string | null
  installment: number | null
  installments: number | null
  recurring: boolean
}

export interface FinSettings {
  user_id: string
  /** Lo que espera cobrar por mes. Es la línea de base del balance. */
  monthly_income: number
}

// ============================================================
// Hábitos
// ============================================================

export interface Habit {
  id: string
  user_id: string
  name: string
  color: CategoryColor | null
  /** Días en que corre: 0 domingo .. 6 sábado. Vacío = todos. */
  weekdays: number[]
  active: boolean
  sort_order: number
}

/** Solo existe fila para los días cumplidos; la ausencia es "no lo hizo". */
export interface HabitLog {
  habit_id: string
  user_id: string
  date: string
}
