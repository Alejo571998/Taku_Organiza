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
  color text not null default 'peach'
    check (color in ('peach','sky','mint','blush','lavender','butter','seafoam')),
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
  created_at timestamptz not null default now(),
  -- La FK apunta a (id, user_id) en vez de solo id: impide crear un
  -- ítem propio colgado de la pestaña de otro usuario, algo que la
  -- RLS por sí sola no puede detectar.
  constraint items_tab_id_user_id_fkey
    foreign key (tab_id, user_id)
    references public.tabs(id, user_id) on delete cascade
);

create index if not exists items_user_date_idx on public.items(user_id, date);
create index if not exists items_tab_idx on public.items(tab_id);
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
-- ------------------------------------------------------------

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
