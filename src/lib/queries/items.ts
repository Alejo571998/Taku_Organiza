import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/database.types'

const ITEM_SELECT = 'id, user_id, tab_id, title, date, completed, sort_order, custom_data'

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
}

export async function saveItem(input: SaveItemInput): Promise<string> {
  if (input.id) {
    const { data, error } = await supabase
      .from('items')
      .update({
        tab_id: input.tabId,
        title: input.title,
        date: input.date,
        custom_data: input.customData
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
