-- ============================================================
-- Organizador · schema inicial
-- Ejecutar en el SQL editor de Supabase SOLO en un proyecto nuevo.
--
-- Si el proyecto ya tiene las tablas creadas, este archivo falla en
-- el primer create table: usá supabase/migrations/ en su lugar.
--
-- Requiere Postgres 15+ (Supabase provisiona 15/17 en proyectos
-- nuevos) por el "on delete set null (columna)" de más abajo.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TABS: pestañas creadas por el usuario. Sin tipo fijo.
-- ------------------------------------------------------------
create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Paleta compartida con los ítems. Se guarda la CLAVE semántica y no el
  -- hex: así se puede recalibrar cualquier tono sin migrar datos.
  color text not null default 'sky'
    check (color in (
      'mint','sage','sky','aqua','lavender','lilac',
      'pink','peach','coral','butter','cream','blue'
    )),
  sort_order integer not null default 0,
  amount_field_id uuid, -- apunta a tab_fields.id, FK compuesta más abajo
  created_at timestamptz not null default now(),
  -- Redundante para unicidad (id ya es PK), pero necesaria para que
  -- items pueda referenciar (id, user_id) y así garantizar que un
  -- ítem y su pestaña pertenecen al mismo usuario.
  constraint tabs_id_user_id_key unique (id, user_id)
);

-- ------------------------------------------------------------
-- TAB_FIELDS: campos personalizados que definen la "forma" de
-- los ítems de una pestaña. Sin este esquema no hay tipos fijos.
-- ------------------------------------------------------------
create table public.tab_fields (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs(id) on delete cascade,
  name text not null,
  type text not null
    check (type in ('text','number','currency','date','boolean','select')),
  options jsonb, -- solo se usa cuando type = 'select'
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  -- Necesaria para la FK compuesta de tabs.amount_field_id.
  constraint tab_fields_id_tab_id_key unique (id, tab_id)
);

-- FK diferida y compuesta: una pestaña puede señalar cuál de sus
-- campos numéricos alimenta la comparativa mensual. Al incluir
-- tabs.id en la FK queda garantizado que el campo elegido pertenece
-- a esa misma pestaña. Con amount_field_id en NULL la FK no se
-- evalúa (semántica MATCH SIMPLE), que es lo que queremos.
alter table public.tabs
  add constraint tabs_amount_field_id_fkey
  foreign key (amount_field_id, id)
  references public.tab_fields(id, tab_id)
  on delete set null (amount_field_id);

-- ------------------------------------------------------------
-- ITEMS: fuente única de verdad. Un ítem vive en una pestaña,
-- aparece en el calendario principal, y tiene un "completed"
-- universal para el checklist con orden hundido (vista diaria).
-- ------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tab_id uuid not null,
  title text not null,
  date date not null,
  completed boolean not null default false,
  sort_order integer not null default 0,
  custom_data jsonb not null default '{}'::jsonb,
  -- Texto libre opcional.
  note text,
  -- Color propio. null = hereda el de su pestaña.
  color text check (color is null or color in (
    'mint','sage','sky','aqua','lavender','lilac',
    'pink','peach','coral','butter','cream','blue'
  )),
  created_at timestamptz not null default now(),
  -- La FK apunta a (id, user_id) en vez de solo id: impide crear un
  -- ítem propio colgado de la pestaña de otro usuario, algo que la
  -- RLS por sí sola no puede detectar.
  constraint items_tab_id_user_id_fkey
    foreign key (tab_id, user_id)
    references public.tabs(id, user_id) on delete cascade
);

create index if not exists items_user_date_idx on public.items(user_id, date);
create index if not exists items_tab_user_idx on public.items(tab_id, user_id);
create index if not exists tabs_amount_field_idx
  on public.tabs(amount_field_id, id) where amount_field_id is not null;
-- Postgres no indexa las FK automáticamente y el embed
-- tabs -> tab_fields de fetchTabs joinea justo por acá.
create index if not exists tab_fields_tab_idx on public.tab_fields(tab_id);
create index if not exists tabs_user_sort_idx on public.tabs(user_id, sort_order);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY: cada usuario solo ve y modifica lo suyo.
-- auth.uid() va envuelto en un subselect para que Postgres lo
-- evalúe una vez por query y no una vez por fila.
-- ------------------------------------------------------------
alter table public.tabs enable row level security;
alter table public.tab_fields enable row level security;
alter table public.items enable row level security;

drop policy if exists "tabs: el usuario administra las suyas" on public.tabs;
create policy "tabs: el usuario administra las suyas"
  on public.tabs for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "tab_fields: el usuario administra los campos de sus pestañas" on public.tab_fields;
create policy "tab_fields: el usuario administra los campos de sus pestañas"
  on public.tab_fields for all
  using (exists (
    select 1 from public.tabs
    where tabs.id = tab_fields.tab_id and tabs.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.tabs
    where tabs.id = tab_fields.tab_id and tabs.user_id = (select auth.uid())
  ));

drop policy if exists "items: el usuario administra los suyos" on public.items;
create policy "items: el usuario administra los suyos"
  on public.items for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- SAVE_TAB: guardar una pestaña y todos sus campos en una sola
-- transacción.
--
-- Hacerlo desde el cliente requería cinco requests sueltos, y si
-- fallaba el del medio la pestaña quedaba a mitad de camino (campos
-- borrados pero no los nuevos, por ejemplo). Una función de Postgres
-- corre entera dentro de una transacción: o se aplica todo o nada.
--
-- El contrato es declarativo: p_fields es el estado FINAL deseado, en
-- orden. Lo que no venga en la lista se borra. Así el cliente no tiene
-- que llevar la cuenta de qué campos eliminó ni resolver ids nuevos.
--
-- security invoker (el default): la función corre con los permisos de
-- quien la llama, así que la RLS de arriba sigue aplicando a cada
-- statement de adentro. No hace falta reimplementar la autorización.
--
-- Forma de cada elemento de p_fields:
--   { "id": uuid | null,   -- null = campo nuevo
--     "name": text,
--     "type": text,
--     "options": string[] | null,
--     "is_amount": boolean }
-- ------------------------------------------------------------
create or replace function public.save_tab(
  p_tab_id uuid,
  p_name text,
  p_color text,
  p_fields jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tab_id uuid;
  v_fields jsonb;
  v_amount_field_id uuid;
  v_keep_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa' using errcode = '28000';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'La pestaña necesita un nombre' using errcode = '22000';
  end if;

  if jsonb_typeof(p_fields) is distinct from 'array' then
    raise exception 'p_fields tiene que ser un array JSON' using errcode = '22000';
  end if;

  -- 1. Crear o actualizar la pestaña. En el update no hace falta filtrar
  --    por user_id: la RLS hace que una pestaña ajena simplemente no
  --    matchee, y ahí v_tab_id queda en null y cortamos.
  if p_tab_id is null then
    insert into public.tabs (user_id, name, color, sort_order)
    values (
      auth.uid(),
      btrim(p_name),
      p_color,
      (select coalesce(max(sort_order), -1) + 1 from public.tabs)
    )
    returning id into v_tab_id;
  else
    update public.tabs
       set name = btrim(p_name), color = p_color
     where id = p_tab_id
    returning id into v_tab_id;

    if v_tab_id is null then
      raise exception 'La pestaña % no existe o no es tuya', p_tab_id
        using errcode = '42501';
    end if;
  end if;

  -- 2. Todo id que venga tiene que ser un campo de ESTA pestaña. Sin este
  --    chequeo, un id de otra pestaña caería en el ON CONFLICT de abajo y
  --    terminaría pisando un campo que no corresponde.
  if exists (
    select 1
      from jsonb_array_elements(p_fields) as f
     where f.value->>'id' is not null
       and not exists (
         select 1 from public.tab_fields
          where id = (f.value->>'id')::uuid
            and tab_id = v_tab_id
       )
  ) then
    raise exception 'Hay campos que no pertenecen a esta pestaña'
      using errcode = '42501';
  end if;

  -- 3. Soltar la referencia antes de tocar los campos, para que borrar el
  --    campo que alimenta la comparativa nunca choque con la FK.
  update public.tabs set amount_field_id = null where id = v_tab_id;

  -- 4. Reconciliar: se borra todo campo de la pestaña que no venga en
  --    p_fields, y con él los datos que los ítems tuvieran en esa clave.
  -- El coalesce no es cosmético: con v_keep_ids en null, el "= any(null)"
  -- de abajo daría null y el delete no borraría absolutamente nada.
  select coalesce(array_agg((f.value->>'id')::uuid), '{}'::uuid[])
    into v_keep_ids
    from jsonb_array_elements(p_fields) as f
   where f.value->>'id' is not null;

  delete from public.tab_fields
   where tab_id = v_tab_id
     and not (id = any (v_keep_ids));

  -- 5. Completar los ids de los campos nuevos y su posición de una sola
  --    vez, para poder referenciarlos después al resolver amount_field_id.
  select coalesce(
           jsonb_agg(
             f.value || jsonb_build_object(
               'id', coalesce(f.value->>'id', gen_random_uuid()::text),
               'sort_order', f.ordinality - 1
             )
             order by f.ordinality
           ),
           '[]'::jsonb
         )
    into v_fields
    from jsonb_array_elements(p_fields) with ordinality as f(value, ordinality);

  -- 6. Insertar y actualizar en un solo statement. El orden del array es
  --    el que el usuario armó en el editor.
  insert into public.tab_fields (id, tab_id, name, type, options, sort_order)
  select
    (f.value->>'id')::uuid,
    v_tab_id,
    f.value->>'name',
    f.value->>'type',
    case when jsonb_typeof(f.value->'options') = 'array' then f.value->'options' end,
    (f.value->>'sort_order')::integer
    from jsonb_array_elements(v_fields) as f
  on conflict (id) do update
    set name       = excluded.name,
        type       = excluded.type,
        options    = excluded.options,
        sort_order = excluded.sort_order;

  -- 7. Resolver la comparativa mensual. Se ignora una elección que no sea
  --    numérica en vez de fallar, igual que hace el editor en el cliente.
  select (f.value->>'id')::uuid
    into v_amount_field_id
    from jsonb_array_elements(v_fields) as f
   where coalesce((f.value->>'is_amount')::boolean, false)
     and f.value->>'type' in ('number', 'currency')
   limit 1;

  update public.tabs set amount_field_id = v_amount_field_id where id = v_tab_id;

  return v_tab_id;
end;
$$;

-- La función es security invoker y valida auth.uid(), pero igual conviene
-- que anon no la tenga a mano.
--
-- El revoke a anon va aparte y no alcanza con sacárselo a public: Supabase
-- le da a anon un grant explícito por default privileges sobre las funciones
-- de public, y ese sobrevive al revoke de public.
revoke all on function public.save_tab(uuid, text, text, jsonb) from public;
revoke execute on function public.save_tab(uuid, text, text, jsonb) from anon;
grant execute on function public.save_tab(uuid, text, text, jsonb) to authenticated;
-- ------------------------------------------------------------
-- REORDENAMIENTO: pestañas e ítems.
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- REPETICIÓN: tareas que se repiten.
--
-- Se materializa una fila por ocurrencia en vez de guardar solo la
-- regla y expandirla al leer. Es más filas, pero cada ocurrencia se
-- tilda, se edita y se reordena por separado —que es lo que un
-- checklist necesita— y las consultas del resto de la app siguen
-- funcionando sin tocarlas. series_id las mantiene unidas.
-- ------------------------------------------------------------
alter table public.items add column if not exists series_id uuid;
alter table public.items add column if not exists recurrence text;

alter table public.items drop constraint if exists items_recurrence_check;
alter table public.items add constraint items_recurrence_check
  check (recurrence is null or recurrence in ('daily', 'weekly', 'monthly'));

-- Parcial: la enorme mayoría de los ítems no pertenece a ninguna serie.
create index if not exists items_series_idx
  on public.items(series_id) where series_id is not null;

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

revoke all on function public.delete_item_series(uuid) from public;
revoke execute on function public.delete_item_series(uuid) from anon;
grant execute on function public.delete_item_series(uuid) to authenticated;
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

-- paso_repeticion había quedado ejecutable por anon. No filtra nada (es pura
-- y no toca datos), pero el resto de las funciones no lo están y conviene que
-- el criterio sea uniforme.
revoke all on function public.paso_repeticion(text) from public;
revoke execute on function public.paso_repeticion(text) from anon;
grant execute on function public.paso_repeticion(text) to authenticated;


-- ============================================================
-- FINANZAS Y HÁBITOS
--
-- La estructura sale de cómo se organiza la usuaria en su planilla:
-- obligaciones del mes con vencimiento, fijos que se repiten, cuotas
-- "n de m", ingresos de varias fuentes y PAGOS PARCIALES (por eso el
-- estado es un monto pagado y no un booleano).
-- ============================================================
-- ============================================================

-- ------------------------------------------------------------
-- 1. Categorías de movimientos
-- ------------------------------------------------------------
create table if not exists public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('gasto', 'ingreso')),
  color text check (color is null or color in (
    'mint','sage','sky','aqua','lavender','lilac',
    'pink','peach','coral','butter','cream','blue'
  )),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Destino de la FK compuesta de abajo. Redundante para unicidad
-- (id ya es PK), necesaria para que la FK pueda apuntar al par.
alter table public.fin_categories drop constraint if exists fin_categories_id_user_id_key;
alter table public.fin_categories add constraint fin_categories_id_user_id_key unique (id, user_id);

-- ------------------------------------------------------------
-- 2. Movimientos
-- ------------------------------------------------------------
create table if not exists public.fin_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid,
  kind text not null check (kind in ('gasto', 'ingreso')),
  description text not null,

  -- numeric y no float: con plata, 0.1 + 0.2 no puede dar 0.30000000000000004.
  amount numeric(14, 2) not null check (amount >= 0),
  -- Cuánto se pagó de ese monto. 0 = pendiente, < amount = parcial,
  -- >= amount = saldado. Es el "2300,62 / 253553,18" de la planilla.
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),

  -- Mes al que se imputa.
  date date not null,
  -- Vencimiento, si lo tiene. Es lo que ordena "qué pago primero".
  due_date date,

  method text check (method is null or method in (
    'efectivo', 'debito', 'credito', 'transferencia', 'otro'
  )),
  note text,

  -- Cuotas: series_id une a las m cuotas de un mismo consumo.
  series_id uuid,
  installment smallint check (installment is null or installment >= 1),
  installments smallint check (installments is null or installments >= 1),

  -- Fijo mensual: series_id lo une igual que a las cuotas, pero sin
  -- numerar. Se materializa un movimiento por mes, misma decisión que
  -- con las tareas repetidas: así cada mes se edita y se paga solo.
  recurring boolean not null default false,

  created_at timestamptz not null default now(),

  constraint fin_movements_cuota_coherente check (
    (installment is null and installments is null)
    or (installment is not null and installments is not null and installment <= installments)
  ),

  -- Apunta al par (id, user_id) y no solo a id: impide colgar un
  -- movimiento propio de la categoría de otro usuario, algo que la
  -- RLS por sí sola no detecta.
  constraint fin_movements_category_user_fkey
    foreign key (category_id, user_id)
    references public.fin_categories(id, user_id)
    on delete set null (category_id)
);

create index if not exists fin_movements_user_date_idx
  on public.fin_movements(user_id, date);
create index if not exists fin_movements_series_idx
  on public.fin_movements(series_id) where series_id is not null;
-- Postgres no indexa las FK solo, y el listado agrupa por categoría.
create index if not exists fin_movements_category_user_idx
  on public.fin_movements(category_id, user_id) where category_id is not null;

-- ------------------------------------------------------------
-- 3. Configuración: el ingreso mensual esperado
--
-- Convive con los movimientos de tipo ingreso y no los reemplaza:
-- esto es lo que la persona ESPERA cobrar por mes y sirve de línea
-- de base para el balance; los movimientos son lo que entró de
-- verdad. Comparar las dos cosas es justo la gracia.
-- ------------------------------------------------------------
create table if not exists public.fin_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric(14, 2) not null default 0 check (monthly_income >= 0),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Hábitos
-- ------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text check (color is null or color in (
    'mint','sage','sky','aqua','lavender','lilac',
    'pink','peach','coral','butter','cream','blue'
  )),
  -- Días en que el hábito corre: 0 domingo .. 6 sábado.
  -- Vacío = todos los días.
  weekdays smallint[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.habits drop constraint if exists habits_id_user_id_key;
alter table public.habits add constraint habits_id_user_id_key unique (id, user_id);

-- Una fila por día cumplido. Solo se guarda lo hecho: la ausencia
-- de fila es "no lo hizo", y así un año de hábitos no son 365 filas
-- por hábito sino las que efectivamente marcó.
create table if not exists public.habit_logs (
  habit_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, date),
  constraint habit_logs_habit_user_fkey
    foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete cascade
);

create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, date);

-- ------------------------------------------------------------
-- 5. RLS en todo
-- ------------------------------------------------------------
alter table public.fin_categories enable row level security;
alter table public.fin_movements enable row level security;
alter table public.fin_settings enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

drop policy if exists "fin_categories: el usuario administra las suyas" on public.fin_categories;
create policy "fin_categories: el usuario administra las suyas"
  on public.fin_categories for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "fin_movements: el usuario administra los suyos" on public.fin_movements;
create policy "fin_movements: el usuario administra los suyos"
  on public.fin_movements for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "fin_settings: el usuario administra la suya" on public.fin_settings;
create policy "fin_settings: el usuario administra la suya"
  on public.fin_settings for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "habits: el usuario administra los suyos" on public.habits;
create policy "habits: el usuario administra los suyos"
  on public.habits for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "habit_logs: el usuario administra los suyos" on public.habit_logs;
create policy "habit_logs: el usuario administra los suyos"
  on public.habit_logs for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 6. Crear un gasto en cuotas, o un fijo mensual, en una sola
-- transacción.
--
-- security invoker: la RLS de la tabla sigue aplicando adentro, así
-- que la autorización no se duplica acá.
--
-- El avance de mes multiplica el intervalo contra la fecha ORIGINAL
-- en vez de ir sumando un mes sobre el resultado anterior. Sumando
-- de a uno, un 31 de enero cae en 28 de febrero y queda clavado en
-- 28 para siempre; multiplicando, vuelve a 31 en marzo.
-- ------------------------------------------------------------
create or replace function public.crear_movimientos_en_serie(
  p_kind text,
  p_description text,
  p_total numeric,
  p_date date,
  p_cuotas smallint,
  p_category_id uuid default null,
  p_method text default null,
  p_note text default null,
  p_due_date date default null,
  -- true = fijo mensual (cada mes el monto completo).
  -- false = cuotas (el total se reparte entre las cuotas).
  p_es_fijo boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_series uuid := gen_random_uuid();
  v_user uuid := auth.uid();
  v_cuota numeric(14, 2);
  v_resto numeric(14, 2);
  i smallint;
begin
  if v_user is null then
    raise exception 'Hay que estar logueado.';
  end if;
  if p_cuotas < 1 then
    raise exception 'La cantidad de meses tiene que ser 1 o más.';
  end if;

  if p_es_fijo then
    v_cuota := round(p_total, 2);
    v_resto := 0;
  else
    -- El redondeo sobrante va a la PRIMERA cuota y no se pierde:
    -- 100 en 3 son 33,33 + 33,33 + 33,34, y la suma vuelve a dar 100.
    v_cuota := round(p_total / p_cuotas, 2);
    v_resto := round(p_total - (v_cuota * p_cuotas), 2);
  end if;

  for i in 1..p_cuotas loop
    insert into public.fin_movements (
      user_id, category_id, kind, description, amount, date, due_date,
      method, note, series_id, installment, installments, recurring
    ) values (
      v_user,
      p_category_id,
      p_kind,
      p_description,
      case when i = 1 then v_cuota + v_resto else v_cuota end,
      (p_date + (interval '1 month' * (i - 1)))::date,
      case when p_due_date is null then null
           else (p_due_date + (interval '1 month' * (i - 1)))::date end,
      p_method,
      p_note,
      case when p_cuotas > 1 then v_series else null end,
      case when p_es_fijo or p_cuotas = 1 then null else i end,
      case when p_es_fijo or p_cuotas = 1 then null else p_cuotas end,
      p_es_fijo
    );
  end loop;

  return v_series;
end;
$$;

revoke all on function public.crear_movimientos_en_serie(
  text, text, numeric, date, smallint, uuid, text, text, date, boolean
) from public;
revoke execute on function public.crear_movimientos_en_serie(
  text, text, numeric, date, smallint, uuid, text, text, date, boolean
) from anon;
grant execute on function public.crear_movimientos_en_serie(
  text, text, numeric, date, smallint, uuid, text, text, date, boolean
) to authenticated;
