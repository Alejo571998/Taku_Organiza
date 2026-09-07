-- ============================================================
-- Migración 0004 · la repetición ahora tiene fecha de fin,
-- y se puede cambiar sobre una serie que ya existe.
-- Idempotente. Ya incluida en schema.sql para proyectos nuevos.
-- ============================================================

-- La versión anterior recibía una cantidad fija de ocurrencias, que es un
-- detalle de implementación: la usuaria piensa en "hasta dentro de un mes".
-- Se reemplaza por una fecha de fin. Se borra la firma vieja para que no
-- queden dos funciones con el mismo nombre.
drop function if exists public.create_recurring_items(uuid, text, date, jsonb, text, integer);

-- Guarda hasta cuándo llega la serie, para poder mostrarlo al editar.
alter table public.items add column if not exists recurrence_until date;

/**
 * Paso de una repetición. Se usa en las dos funciones de abajo.
 */
create or replace function public.paso_repeticion(p_recurrence text)
returns interval
language sql
immutable
set search_path = pg_temp
as $$
  select case p_recurrence
           when 'daily' then interval '1 day'
           when 'weekly' then interval '1 week'
           when 'monthly' then interval '1 month'
         end;
$$;

-- ------------------------------------------------------------
-- CREATE_RECURRING_ITEMS: crea las ocurrencias desde p_date
-- hasta p_until inclusive, en un solo INSERT (atómico).
-- ------------------------------------------------------------
create or replace function public.create_recurring_items(
  p_tab_id uuid,
  p_title text,
  p_date date,
  p_custom_data jsonb,
  p_recurrence text,
  p_until date
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
  v_cuantas integer;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa' using errcode = '28000';
  end if;

  if coalesce(btrim(p_title), '') = '' then
    raise exception 'La tarea necesita un título' using errcode = '22000';
  end if;

  v_paso := public.paso_repeticion(p_recurrence);
  if v_paso is null then
    raise exception 'Repetición inválida: %', p_recurrence using errcode = '22000';
  end if;

  if p_until is null or p_until < p_date then
    raise exception 'La fecha de fin tiene que ser posterior al inicio'
      using errcode = '22000';
  end if;

  -- El intervalo se MULTIPLICA y se suma siempre a la fecha original. Con
  -- generate_series(fecha, fecha, interval) el avance es iterativo: al sumarle
  -- un mes a 31/01 cae en 28/02 y de ahi queda clavado en el 28. Asi, en
  -- cambio, 31/01 da 28/02, 31/03, 30/04.
  select count(*) into v_cuantas
    from generate_series(0, 401) as g
   where (p_date + (v_paso * g))::date <= p_until;

  -- Tope duro: evita que un rango absurdo escriba miles de filas.
  if v_cuantas > 400 then
    raise exception 'Son demasiadas repeticiones. Acortá la fecha de fin.'
      using errcode = '22000';
  end if;

  -- Todas comparten el sort_order del primer día; Postgres desempata por
  -- created_at, así que quedan en orden entre ellas.
  select coalesce(max(sort_order), -1) + 1 into v_sort
    from public.items where date = p_date;

  insert into public.items
    (user_id, tab_id, title, date, custom_data, sort_order,
     series_id, recurrence, recurrence_until)
  select
    auth.uid(), p_tab_id, btrim(p_title),
    (p_date + (v_paso * g))::date,
    coalesce(p_custom_data, '{}'::jsonb), v_sort,
    v_series, p_recurrence, p_until
  from generate_series(0, 401) as g
  where (p_date + (v_paso * g))::date <= p_until;

  return v_series;
end;
$$;

-- ------------------------------------------------------------
-- RESCHEDULE_ITEM_SERIES: cambia la repetición "de esta fecha en
-- adelante", como hace Google Calendar.
--
-- El ítem que se edita NO se borra y se vuelve a crear: se actualiza
-- en el lugar. Si se recreara, perdería su tilde, sus campos propios
-- y su posición. Solo se reemplazan las ocurrencias posteriores.
--
-- Las anteriores quedan con el series_id viejo y no se tocan: son
-- pasado, y varias pueden estar ya tildadas.
--
-- p_recurrence null = deja de repetirse (queda esta sola).
-- ------------------------------------------------------------
create or replace function public.reschedule_item_series(
  p_item_id uuid,
  p_recurrence text,
  p_until date
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item public.items;
  v_series uuid;
  v_paso interval;
  v_cuantas integer;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa' using errcode = '28000';
  end if;

  -- La RLS hace que un ítem ajeno simplemente no aparezca.
  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Esa tarea no existe o no es tuya' using errcode = '42501';
  end if;

  -- Fuera las ocurrencias futuras de la serie vieja (esta no).
  if v_item.series_id is not null then
    delete from public.items
     where series_id = v_item.series_id
       and date > v_item.date
       and id <> v_item.id;
  end if;

  if p_recurrence is null then
    update public.items
       set series_id = null, recurrence = null, recurrence_until = null
     where id = v_item.id;
    return null;
  end if;

  v_paso := public.paso_repeticion(p_recurrence);
  if v_paso is null then
    raise exception 'Repetición inválida: %', p_recurrence using errcode = '22000';
  end if;

  if p_until is null or p_until < v_item.date then
    raise exception 'La fecha de fin tiene que ser posterior a la de la tarea'
      using errcode = '22000';
  end if;

  select count(*) into v_cuantas
    from generate_series(0, 401) as g
   where (v_item.date + (v_paso * g))::date <= p_until;
  if v_cuantas > 400 then
    raise exception 'Son demasiadas repeticiones. Acortá la fecha de fin.'
      using errcode = '22000';
  end if;

  v_series := gen_random_uuid();

  update public.items
     set series_id = v_series, recurrence = p_recurrence, recurrence_until = p_until
   where id = v_item.id;

  -- Desde g = 1: la fecha del ítem editado ya está ocupada por él mismo.
  insert into public.items
    (user_id, tab_id, title, date, custom_data, sort_order,
     series_id, recurrence, recurrence_until)
  select
    v_item.user_id, v_item.tab_id, v_item.title,
    (v_item.date + (v_paso * g))::date,
    v_item.custom_data, v_item.sort_order,
    v_series, p_recurrence, p_until
  from generate_series(1, 401) as g
  where (v_item.date + (v_paso * g))::date <= p_until;

  return v_series;
end;
$$;

revoke all on function public.create_recurring_items(uuid, text, date, jsonb, text, date) from public;
revoke execute on function public.create_recurring_items(uuid, text, date, jsonb, text, date) from anon;
grant execute on function public.create_recurring_items(uuid, text, date, jsonb, text, date) to authenticated;

revoke all on function public.reschedule_item_series(uuid, text, date) from public;
revoke execute on function public.reschedule_item_series(uuid, text, date) from anon;
grant execute on function public.reschedule_item_series(uuid, text, date) to authenticated;
