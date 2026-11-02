import { supabase } from '@/lib/supabase'
import type { Habit, HabitLog } from '@/types/database.types'

const HABIT_SELECT = 'id, user_id, name, color, weekdays, active, sort_order'

export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_SELECT)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Habit[]
}

export interface SaveHabitInput {
  id?: string
  name: string
  color: string | null
  /** 0 domingo .. 6 sábado. Vacío = todos los días. */
  weekdays: number[]
  active: boolean
}

export async function saveHabit(input: SaveHabitInput): Promise<void> {
  const fila = {
    name: input.name,
    color: input.color,
    weekdays: input.weekdays,
    active: input.active
  }
  const { error } = input.id
    ? await supabase.from('habits').update(fila).eq('id', input.id)
    : await supabase.from('habits').insert(fila)
  if (error) throw error
}

/** Se lleva sus marcas por la FK en cascada: un hábito borrado no deja rastro. */
export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id)
  if (error) throw error
}

export async function fetchHabitLogs(from: string, to: string): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, user_id, date')
    .gte('date', from)
    .lte('date', to)
  if (error) throw error
  return (data ?? []) as HabitLog[]
}

/**
 * Marcar es insertar la fila; desmarcar es borrarla. No hay columna "hecho":
 * la ausencia ya significa que no lo hizo, y así un año de seguimiento pesa
 * lo que la persona efectivamente marcó y no 365 filas por hábito.
 */
export async function marcarHabito(
  habitId: string,
  date: string,
  hecho: boolean
): Promise<void> {
  if (!hecho) {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('date', date)
    if (error) throw error
    return
  }

  const { data: sesion } = await supabase.auth.getUser()
  const userId = sesion.user?.id
  if (!userId) throw new Error('Hay que estar logueado.')

  // upsert y no insert: tocar dos veces el mismo día no puede ser un error.
  const { error } = await supabase
    .from('habit_logs')
    .upsert({ habit_id: habitId, user_id: userId, date }, { onConflict: 'habit_id,date' })
  if (error) throw error
}
