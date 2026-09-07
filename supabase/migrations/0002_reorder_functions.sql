-- ============================================================
-- Migración 0002 · funciones de reordenamiento
-- Idempotente (create or replace). Ya incluida en schema.sql
-- para proyectos nuevos.
-- ============================================================

-- Reordenar en un solo UPDATE: es inherentemente atómico, así que no hace
-- falta plpgsql. La RLS limita el alcance a las filas del usuario, y las que
-- no le pertenezcan simplemente no matchean.
create or replace function public.reorder_tabs(p_ids uuid[])
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.tabs t
     set sort_order = i.ord - 1
    from unnest(p_ids) with ordinality as i(id, ord)
   where t.id = i.id;
$$;

create or replace function public.reorder_items(p_ids uuid[])
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.items it
     set sort_order = i.ord - 1
    from unnest(p_ids) with ordinality as i(id, ord)
   where it.id = i.id;
$$;

revoke all on function public.reorder_tabs(uuid[]) from public;
revoke execute on function public.reorder_tabs(uuid[]) from anon;
grant execute on function public.reorder_tabs(uuid[]) to authenticated;

revoke all on function public.reorder_items(uuid[]) from public;
revoke execute on function public.reorder_items(uuid[]) from anon;
grant execute on function public.reorder_items(uuid[]) to authenticated;
