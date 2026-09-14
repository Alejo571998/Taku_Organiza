import { supabase } from '@/lib/supabase'
import type { CategoryColor, Item, Recurrence } from '@/types/database.types'

export const ITEM_SELECT =
  // Una sola cadena literal a proposito: partida con + deja de ser literal
  // y supabase-js pierde la inferencia de tipos del select.
  'id, user_id, tab_id, title, date, completed, sort_order, custom_data, series_id, recurrence, recurrence_until, note, color'

/** Trae los ítems de un rango de fechas inclusivo. Sirve para día, semana y mes. */
export async function fetchItems(from: string, to: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .gte('date', from)
    .lte('date', to)
    // Los completados se hunden al fondo: es el orden que pide la vista diaria
    // y no molesta en las otras.
    .order('completed', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Item[]
}

export interface SaveItemInput {
  id?: string
  tabId: string
  title: string
  date: string
  customData: Record<string, unknown>
  /** Vacío se guarda como null, para no distinguir "" de "sin nota". */
  note?: string | null
  /** null = hereda el color de la pestaña. */
  color?: CategoryColor | null
}

export async function saveItem(input: SaveItemInput): Promise<string> {
  if (input.id) {
    const { data, error } = await supabase
      .from('items')
      .update({
        tab_id: input.tabId,
        title: input.title,
        date: input.date,
        custom_data: input.customData,
        note: input.note?.trim() || null,
        color: input.color ?? null
      })
      .eq('id', input.id)
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('No hay sesión activa')

  // El ítem nuevo va al final de su día. La RLS ya limita el select a lo
  // propio, así que el máximo es el del usuario.
  const { data: last, error: lastError } = await supabase
    .from('items')
    .select('sort_order')
    .eq('date', input.date)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) throw lastError

  const { data, error } = await supabase
    .from('items')
    .insert({
      user_id: userId,
      tab_id: input.tabId,
      title: input.title,
      date: input.date,
      custom_data: input.customData,
      note: input.note?.trim() || null,
      color: input.color ?? null,
      sort_order: (last?.sort_order ?? -1) + 1
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function setItemCompleted(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from('items').update({ completed }).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

/** Persiste el orden nuevo de los ítems. `ids` va en el orden deseado. */
export async function reorderItems(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_items', { p_ids: ids })
  if (error) throw error
}

/** Todos los ítems de una pestaña, sin importar la fecha. */
export async function fetchItemsByTab(tabId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('tab_id', tabId)
    // Mismo criterio que el resto: lo hecho se hunde, y dentro de cada grupo
    // manda el orden que el usuario armó arrastrando.
    .order('completed', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Item[]
}

export const ETIQUETA_REPETICION: Record<Recurrence, string> = {
  daily: 'Todos los días',
  weekly: 'Todas las semanas',
  monthly: 'Todos los meses'
}

/** Crea las ocurrencias desde la fecha del ítem hasta `until` inclusive. */
export async function createRecurringItems(
  input: SaveItemInput & { recurrence: Recurrence; until: string }
): Promise<string> {
  const { data, error } = await supabase.rpc('create_recurring_items', {
    p_tab_id: input.tabId,
    p_title: input.title,
    p_date: input.date,
    p_custom_data: input.customData,
    p_recurrence: input.recurrence,
    p_until: input.until,
    p_note: input.note?.trim() || null,
    p_color: input.color ?? null
  })
  if (error) throw error
  return data as string
}

/**
 * Cambia la repetición de esta fecha en adelante, como Google Calendar.
 * Las ocurrencias anteriores no se tocan: son pasado y pueden estar tildadas.
 * `recurrence` en null deja la tarea suelta.
 */
export async function rescheduleItemSeries(input: {
  itemId: string
  recurrence: Recurrence | null
  until: string | null
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('reschedule_item_series', {
    p_item_id: input.itemId,
    p_recurrence: input.recurrence,
    p_until: input.until
  })
  if (error) throw error
  return (data as string | null) ?? null
}

/** Borra todas las ocurrencias de una serie. Devuelve cuántas borró. */
export async function deleteItemSeries(seriesId: string): Promise<number> {
  const { data, error } = await supabase.rpc('delete_item_series', {
    p_series_id: seriesId
  })
  if (error) throw error
  return (data as number) ?? 0
}
