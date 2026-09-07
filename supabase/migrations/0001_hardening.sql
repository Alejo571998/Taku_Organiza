-- ============================================================
-- Migración 0001 · endurecer el schema + save_tab transaccional
--
-- Para proyectos que YA tienen corrido el schema.sql original y
-- tienen datos adentro. Si arrancás un proyecto de cero, corré
-- supabase/schema.sql en vez de esto: ese archivo ya incluye todo.
--
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- Requiere Postgres 15+ por el "on delete set null (columna)".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tipos de campo: agregar 'currency'.
-- (Puede que ya esté si se parcheó a mano; el drop/add lo deja
-- igual en cualquier caso y hace que el repo sea la verdad.)
-- ------------------------------------------------------------
alter table public.tab_fields drop constraint if exists tab_fields_type_check;
alter table public.tab_fields add constraint tab_fields_type_check
  check (type in ('text','number','currency','date','boolean','select'));

-- ------------------------------------------------------------
-- 2. Constraints unique que hacen falta como destino de las FK
-- compuestas de abajo. Redundantes para unicidad (id ya es PK).
-- ------------------------------------------------------------
alter table public.tabs drop constraint if exists tabs_id_user_id_key;
alter table public.tabs add constraint tabs_id_user_id_key unique (id, user_id);

alter table public.tab_fields drop constraint if exists tab_fields_id_tab_id_key;
alter table public.tab_fields add constraint tab_fields_id_tab_id_key unique (id, tab_id);

-- ------------------------------------------------------------
-- 3. FK compuesta en items: impide crear un ítem propio colgado
-- de la pestaña de otro usuario, algo que la RLS no detecta.
-- ------------------------------------------------------------
alter table public.items drop constraint if exists items_tab_id_fkey;
alter table public.items drop constraint if exists items_tab_id_user_id_fkey;
alter table public.items add constraint items_tab_id_user_id_fkey
  foreign key (tab_id, user_id)
  references public.tabs(id, user_id) on delete cascade;

-- ------------------------------------------------------------
-- 4. FK compuesta en tabs.amount_field_id: garantiza que el campo
-- elegido para la comparativa pertenece a esa misma pestaña.
-- Con amount_field_id en NULL la FK no se evalúa (MATCH SIMPLE).
-- ------------------------------------------------------------
alter table public.tabs drop constraint if exists tabs_amount_field_id_fkey;
alter table public.tabs add constraint tabs_amount_field_id_fkey
  foreign key (amount_field_id, id)
  references public.tab_fields(id, tab_id)
  on delete set null (amount_field_id);

-- ------------------------------------------------------------
-- 5. Índices que faltaban.
-- ------------------------------------------------------------
create index if not exists tab_fields_tab_idx on public.tab_fields(tab_id);
create index if not exists tabs_user_sort_idx on public.tabs(user_id, sort_order);

-- ------------------------------------------------------------
-- 6. Policies: envolver auth.uid() en un subselect para que
-- Postgres lo evalúe una vez por query y no una vez por fila.
-- ------------------------------------------------------------
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
-- 7. SAVE_TAB: guardar una pestaña y todos sus campos en una sola
-- transacción. Ver el comentario largo en supabase/schema.sql.
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

  update public.tabs set amount_field_id = null where id = v_tab_id;

  select coalesce(array_agg((f.value->>'id')::uuid), '{}'::uuid[])
    into v_keep_ids
    from jsonb_array_elements(p_fields) as f
   where f.value->>'id' is not null;

  delete from public.tab_fields
   where tab_id = v_tab_id
     and not (id = any (v_keep_ids));

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

-- El revoke a anon va aparte y no alcanza con sacárselo a public: Supabase
-- le da a anon un grant explícito por default privileges sobre las funciones
-- de public, y ese sobrevive al revoke de public.
revoke all on function public.save_tab(uuid, text, text, jsonb) from public;
revoke execute on function public.save_tab(uuid, text, text, jsonb) from anon;
grant execute on function public.save_tab(uuid, text, text, jsonb) to authenticated;
