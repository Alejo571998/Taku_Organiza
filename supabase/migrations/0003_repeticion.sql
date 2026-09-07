-- ============================================================
-- Migración 0003 · tareas que se repiten
-- Idempotente. Ya incluida en schema.sql para proyectos nuevos.
-- ============================================================

-- Se materializa una fila por ocurrencia en vez de guardar solo la regla y
-- expandirla al leer. Es más filas, pero cada ocurrencia se tilda, se edita
-- y se reordena por separado —que es lo que un checklist necesita— y todas
-- las consultas que ya existen siguen funcionando sin tocarlas.
-- series_id las mantiene unidas para poder borrar la serie completa.
alter table public.items add column if not exists series_id uuid;
alter table public.items add column if not exists recurrence text;

alter table public.items drop constraint if exists items_recurrence_check;
alter table public.items add constraint items_recurrence_check
  check (recurrence is null or recurrence in ('daily', 'weekly', 'monthly'));

-- Parcial: la enorme mayoría de los ítems no pertenece a ninguna serie.
create index if not exists items_series_idx
  on public.items(series_id) where series_id is not null;

-- ------------------------------------------------------------
-- CREATE_RECURRING_ITEMS: crea todas las ocurrencias de una vez.
-- Un solo INSERT, asi que es atomico: o entran todas o ninguna.
-- ------------------------------------------------------------
create or replace function public.create_recurring_items(
  p_tab_id uuid,
  p_title text,
  p_date date,
  p_custom_data jsonb,
  p_recurrence text,
  p_count integer
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_series uuid := gen_random_uuid();
  v_sort integer;
  v_paso interval;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa' using errcode = '28000';
  end if;

  if coalesce(btrim(p_title), '') = '' then
    raise exception 'La tarea necesita un título' using errcode = '22000';
  end if;

  if p_recurrence not in ('daily', 'weekly', 'monthly') then
    raise exception 'Repetición inválida: %', p_recurrence using errcode = '22000';
  end if;

  -- El tope evita que un error de cálculo del cliente escriba miles de filas.
  if p_count < 1 or p_count > 400 then
    raise exception 'Cantidad de repeticiones fuera de rango: %', p_count
      using errcode = '22000';
  end if;

  v_paso := case p_recurrence
              when 'daily' then interval '1 day'
              when 'weekly' then interval '1 week'
              else interval '1 month'
            end;

  -- Todas las ocurrencias comparten el sort_order del primer día. Postgres
  -- desempata por created_at, asi que quedan en orden entre ellas.
  select coalesce(max(sort_order), -1) + 1 into v_sort
    from public.items where date = p_date;

  insert into public.items
    (user_id, tab_id, title, date, custom_data, sort_order, series_id, recurrence)
  select
    auth.uid(),
    p_tab_id,
    btrim(p_title),
    -- Sumar interval '1 month' respeta fin de mes: 31/01 + 1 mes da 28/02.
    (p_date + (v_paso * g))::date,
    coalesce(p_custom_data, '{}'::jsonb),
    v_sort,
    v_series,
    p_recurrence
  from generate_series(0, p_count - 1) as g;

  return v_series;
end;
$$;

-- ------------------------------------------------------------
-- DELETE_ITEM_SERIES: borra la serie entera.
-- La RLS acota el alcance a los ítems del usuario.
-- ------------------------------------------------------------
create or replace function public.delete_item_series(p_series_id uuid)
returns integer
language sql
security invoker
set search_path = public, pg_temp
as $$
  with borrados as (
    delete from public.items where series_id = p_series_id returning 1
  )
  select count(*)::integer from borrados;
$$;

revoke all on function public.create_recurring_items(uuid, text, date, jsonb, text, integer) from public;
revoke execute on function public.create_recurring_items(uuid, text, date, jsonb, text, integer) from anon;
grant execute on function public.create_recurring_items(uuid, text, date, jsonb, text, integer) to authenticated;

revoke all on function public.delete_item_series(uuid) from public;
revoke execute on function public.delete_item_series(uuid) from anon;
grant execute on function public.delete_item_series(uuid) to authenticated;
