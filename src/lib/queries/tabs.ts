import { supabase } from '@/lib/supabase'
import type { CategoryColor, FieldType } from '@/types/database.types'

export interface TabWithFields {
  id: string
  name: string
  color: CategoryColor
  sort_order: number
  amount_field_id: string | null
  tab_fields: {
    id: string
    name: string
    type: FieldType
    options: string[] | null
    sort_order: number
  }[]
}

// Hay dos foreign keys entre tabs y tab_fields (tab_fields.tab_id y
// tabs.amount_field_id), así que el embed tiene que decir explícitamente
// cuál usar o PostgREST responde PGRST201 ("more than one relationship").
const TABS_SELECT =
  'id, name, color, sort_order, amount_field_id, ' +
  'tab_fields!tab_fields_tab_id_fkey(id, name, type, options, sort_order)'

export async function fetchTabs(): Promise<TabWithFields[]> {
  const { data, error } = await supabase
    .from('tabs')
    .select(TABS_SELECT)
    // created_at como desempate: sin él, dos filas con el mismo sort_order
    // pueden volver en cualquier orden entre una query y la siguiente.
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .order('sort_order', { ascending: true, foreignTable: 'tab_fields' })
    .order('created_at', { ascending: true, foreignTable: 'tab_fields' })

  if (error) throw error
  return (data ?? []) as unknown as TabWithFields[]
}

export interface SaveTabFieldInput {
  /** Sin id = campo nuevo. Lo genera Postgres dentro de la transacción. */
  id?: string
  name: string
  type: FieldType
  options: string[] | null
  isAmount: boolean
}

export interface SaveTabInput {
  id?: string
  name: string
  color: CategoryColor
  /** Estado final deseado, en orden. Lo que no esté acá se borra. */
  fields: SaveTabFieldInput[]
}

/**
 * Guarda la pestaña entera en una transacción (ver save_tab en
 * supabase/schema.sql). Antes esto eran cinco requests sueltos y si fallaba
 * el del medio la pestaña quedaba a mitad de camino.
 *
 * p_tab_id va explícitamente en null y no undefined: PostgREST resuelve la
 * función por los nombres de parámetro que recibe, y JSON.stringify borra
 * las claves undefined, con lo cual la llamada fallaría con un PGRST202.
 */
export async function saveTab(input: SaveTabInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_tab', {
    p_tab_id: input.id ?? null,
    p_name: input.name,
    p_color: input.color,
    p_fields: input.fields.map((f) => ({
      id: f.id ?? null,
      name: f.name,
      type: f.type,
      options: f.options,
      is_amount: f.isAmount
    }))
  })

  if (error) throw error
  return data as string
}

export async function deleteTab(tabId: string): Promise<void> {
  const { error } = await supabase.from('tabs').delete().eq('id', tabId)
  if (error) throw error
}

/** Persiste el orden nuevo de las pestañas. `ids` va en el orden deseado. */
export async function reorderTabs(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_tabs', { p_ids: ids })
  if (error) throw error
}
