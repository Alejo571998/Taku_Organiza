-- ============================================================
-- Migración 0005 · nota y color propios por ítem,
-- y una sola paleta pastel de 12 para pestañas e ítems.
-- Idempotente. Ya incluida en schema.sql para proyectos nuevos.
-- ============================================================

-- ------------------------------------------------------------
-- PALETA ÚNICA
-- Antes las pestañas tenían 7 colores propios. Ahora pestañas e
-- ítems comparten la misma paleta de 12, definida en un solo lugar
-- del lado del cliente (src/lib/palette.ts).
--
-- Se guarda la CLAVE semántica ('mint') y no el hex: así el valor
-- sobrevive a cualquier cambio de tono del sistema de diseño.
--
-- blush y seafoam salen de la paleta; las filas que los usan se
-- mueven a su equivalente (pink y aqua) para no arrastrar alias.
-- ------------------------------------------------------------
alter table public.tabs drop constraint if exists tabs_color_check;

update public.tabs set color = 'pink' where color = 'blush';
update public.tabs set color = 'aqua' where color = 'seafoam';

alter table public.tabs add constraint tabs_color_check
  check (color in (
    'mint','sage','sky','aqua','lavender','lilac',
    'pink','peach','coral','butter','cream','blue'
  ));

-- ------------------------------------------------------------
-- NOTA Y COLOR POR ÍTEM
-- Las dos nullables: los ítems que ya existen siguen válidos sin
-- tocar nada. color en null significa "heredá el de la pestaña".
-- ------------------------------------------------------------
alter table public.items add column if not exists note text;
alter table public.items add column if not exists color text;

alter table public.items drop constraint if exists items_color_check;
alter table public.items add constraint items_color_check
  check (color is null or color in (
    'mint','sage','sky','aqua','lavender','lilac',
    'pink','peach','coral','butter','cream','blue'
  ));

-- ------------------------------------------------------------
-- Las funciones de repetición tienen que arrastrar nota y color,
-- o las ocurrencias saldrían en blanco.
-- ------------------------------------------------------------
drop function if exists public.create_recurring_items(uuid, text, date, jsonb, text, date);

create or replace function public.create_recurring_items(
  p_tab_id uuid,
  p_title text,
  p_date date,
  p_custom_data jsonb,
  p_recurrence text,
  p_until date,
  p_note text default null,
  p_color text default null
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
  -- un mes a 31/01 cae en 28/02 y de ahí queda clavado en el 28. Así, en
  -- cambio, 31/01 da 28/02, 31/03, 30/04.
  select count(*) into v_cuantas
    from generate_series(0, 401) as g
   where (p_date + (v_paso * g))::date <= p_until;

  if v_cuantas > 400 then
    raise exception 'Son demasiadas repeticiones. Acortá la fecha de fin.'
      using errcode = '22000';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_sort
    from public.items where date = p_date;

  insert into public.items
    (user_id, tab_id, title, date, custom_data, sort_order,
     series_id, recurrence, recurrence_until, note, color)
  select
    auth.uid(), p_tab_id, btrim(p_title),
    (p_date + (v_paso * g))::date,
    coalesce(p_custom_data, '{}'::jsonb), v_sort,
    v_series, p_recurrence, p_until,
    nullif(btrim(coalesce(p_note, '')), ''), p_color
  from generate_series(0, 401) as g
  where (p_date + (v_paso * g))::date <= p_until;

  return v_series;
end;
$$;

-- reschedule_item_series copia el ítem editado, así que solo hay que
-- sumar las columnas nuevas a su INSERT.
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

  select * into v_item from public.items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Esa tarea no existe o no es tuya' using errcode = '42501';
  end if;

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

  insert into public.items
    (user_id, tab_id, title, date, custom_data, sort_order,
     series_id, recurrence, recurrence_until, note, color)
  select
    v_item.user_id, v_item.tab_id, v_item.title,
    (v_item.date + (v_paso * g))::date,
    v_item.custom_data, v_item.sort_order,
    v_series, p_recurrence, p_until,
    v_item.note, v_item.color
  from generate_series(1, 401) as g
  where (v_item.date + (v_paso * g))::date <= p_until;

  return v_series;
end;
$$;

revoke all on function public.create_recurring_items(uuid, text, date, jsonb, text, date, text, text) from public;
revoke execute on function public.create_recurring_items(uuid, text, date, jsonb, text, date, text, text) from anon;
grant execute on function public.create_recurring_items(uuid, text, date, jsonb, text, date, text, text) to authenticated;
