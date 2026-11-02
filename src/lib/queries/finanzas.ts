import { supabase } from '@/lib/supabase'
import type {
  FinCategory,
  FinMovement,
  FinSettings,
  MovementKind,
  PaymentMethod
} from '@/types/database.types'

/**
 * Una sola cadena literal, sin partirla con +: supabase-js infiere los tipos
 * de la fila leyendo este texto en tiempo de compilación, y si se corta pierde
 * el rastro y devuelve un error de tipos en vez de la fila.
 */
const MOVEMENT_SELECT =
  'id, user_id, category_id, kind, description, amount, paid_amount, date, due_date, method, note, series_id, installment, installments, recurring'

const CATEGORY_SELECT = 'id, user_id, name, kind, color, sort_order'

// ------------------------------------------------------------
// Categorías
// ------------------------------------------------------------

export async function fetchCategories(): Promise<FinCategory[]> {
  const { data, error } = await supabase
    .from('fin_categories')
    .select(CATEGORY_SELECT)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as FinCategory[]
}

export interface SaveCategoryInput {
  id?: string
  name: string
  kind: MovementKind
  color: string | null
}

export async function saveCategory(input: SaveCategoryInput): Promise<void> {
  const fila = { name: input.name, kind: input.kind, color: input.color }
  const { error } = input.id
    ? await supabase.from('fin_categories').update(fila).eq('id', input.id)
    : await supabase.from('fin_categories').insert(fila)
  if (error) throw error
}

/**
 * Los movimientos NO se borran con la categoría: la FK la pone en null. Perder
 * el historial de gastos por reorganizar las categorías sería un desastre
 * silencioso, y un movimiento sin categoría se sigue sumando al total.
 */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('fin_categories').delete().eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Movimientos
// ------------------------------------------------------------

/** Movimientos de un rango. Se pide por fecha de imputación, no de pago. */
export async function fetchMovements(from: string, to: string): Promise<FinMovement[]> {
  const { data, error } = await supabase
    .from('fin_movements')
    .select(MOVEMENT_SELECT)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('created_at')
  if (error) throw error
  return (data ?? []) as FinMovement[]
}

export interface SaveMovementInput {
  id?: string
  kind: MovementKind
  description: string
  amount: number
  paidAmount: number
  date: string
  dueDate: string | null
  categoryId: string | null
  method: PaymentMethod | null
  note: string | null
}

export async function saveMovement(input: SaveMovementInput): Promise<void> {
  const fila = {
    kind: input.kind,
    description: input.description,
    amount: input.amount,
    paid_amount: input.paidAmount,
    date: input.date,
    due_date: input.dueDate,
    category_id: input.categoryId,
    method: input.method,
    note: input.note
  }
  const { error } = input.id
    ? await supabase.from('fin_movements').update(fila).eq('id', input.id)
    : await supabase.from('fin_movements').insert(fila)
  if (error) throw error
}

export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from('fin_movements').delete().eq('id', id)
  if (error) throw error
}

/** Borra la serie completa: las 12 cuotas, o todos los meses del fijo. */
export async function deleteSeries(seriesId: string): Promise<void> {
  const { error } = await supabase.from('fin_movements').delete().eq('series_id', seriesId)
  if (error) throw error
}

/**
 * Marca cuánto se pagó. Sin monto, se salda entero: es el gesto de un toque
 * para el caso normal, y el parcial queda para cuando hace falta.
 */
export async function setPaid(id: string, paidAmount: number): Promise<void> {
  const { error } = await supabase
    .from('fin_movements')
    .update({ paid_amount: paidAmount })
    .eq('id', id)
  if (error) throw error
}

export interface SerieInput extends Omit<SaveMovementInput, 'id' | 'paidAmount'> {
  /** Cantidad de meses: cuotas de un consumo, o repeticiones del fijo. */
  meses: number
  /** true reparte el total entre los meses; false lo cobra entero cada mes. */
  esFijo: boolean
}

/**
 * Un gasto en cuotas, o un fijo mensual, en una sola transacción.
 *
 * Se materializa un movimiento por mes en vez de guardar la regla y expandirla
 * al leer. Son más filas, pero cada mes se paga, se edita y se ajusta por
 * separado —que es lo que pasa en la vida real con una cuota— y las consultas
 * del mes siguen siendo una consulta por rango de fechas.
 */
export async function crearSerie(input: SerieInput): Promise<string> {
  const { data, error } = await supabase.rpc('crear_movimientos_en_serie', {
    p_kind: input.kind,
    p_description: input.description,
    p_total: input.amount,
    p_date: input.date,
    p_cuotas: input.meses,
    p_category_id: input.categoryId,
    p_method: input.method,
    p_note: input.note,
    p_due_date: input.dueDate,
    p_es_fijo: input.esFijo
  })
  if (error) throw error
  return data as string
}

// ------------------------------------------------------------
// Configuración
// ------------------------------------------------------------

export async function fetchSettings(): Promise<FinSettings | null> {
  const { data, error } = await supabase
    .from('fin_settings')
    .select('user_id, monthly_income')
    .maybeSingle()
  if (error) throw error
  return (data as FinSettings) ?? null
}

/**
 * upsert y no update: la fila no existe hasta que la persona guarda su ingreso
 * por primera vez, y no hace falta crearla al registrarse.
 */
export async function saveMonthlyIncome(monto: number): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser()
  const userId = sesion.user?.id
  if (!userId) throw new Error('Hay que estar logueado.')

  const { error } = await supabase
    .from('fin_settings')
    .upsert({ user_id: userId, monthly_income: monto, updated_at: new Date().toISOString() })
  if (error) throw error
}
