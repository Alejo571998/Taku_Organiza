-- ============================================================
-- Migración 0010 · Hora opcional en las tareas
--
-- Hasta acá una tarea solo tenía fecha, que para "comprar pan" alcanza.
-- Para una reunión no: sin hora, en un calendario cae como evento de día
-- entero, que es decir "en algún momento del martes".
--
-- Nullable y sin default a propósito: la mayoría de las tareas NO tienen
-- hora, y pedirla sería ponerle fricción a lo que más se usa.
-- ============================================================
alter table public.items add column if not exists time time;

-- El día se lee en orden: primero lo que tiene hora, y después lo suelto
-- en el orden que la persona acomodó a mano.
create index if not exists items_user_date_time_idx
  on public.items(user_id, date, time nulls last, sort_order);

-- ------------------------------------------------------------
-- La serie repetida copia la hora a cada ocurrencia: una reunión semanal
-- de las 10 es a las 10 todas las semanas.
--
-- OJO, esto pasó: agregar un parámetro con "create or replace" NO
-- reemplaza la función, crea una SOBRECARGA — solo reemplaza cuando la
-- firma es idéntica. Con las dos versiones vivas, la llamada de la app
-- (ocho parámetros con nombre) encaja en ambas y Postgres responde
-- "function is not unique": el alta de tareas repetidas se cae entera.
-- Por eso el drop de abajo no es optativo.
-- ------------------------------------------------------------
create or replace function public.create_recurring_items(
  p_tab_id uuid,
  p_title text,
  p_date date,
  p_custom_data jsonb,
  p_recurrence text,
  p_until date,
  p_note text default null,
  p_color text default null,
  p_time time default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_series uuid := gen_random_uuid();
  v_user uuid := auth.uid();
  v_paso interval := public.paso_repeticion(p_recurrence);
  v_orden integer;
  i integer := 0;
  v_fecha date;
begin
  if v_user is null then
    raise exception 'Hay que estar logueado.';
  end if;
  if p_until < p_date then
    raise exception 'La fecha de fin no puede ser anterior a la de inicio.';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_orden
  from public.items where user_id = v_user and date = p_date;

  loop
    -- El intervalo se multiplica contra la fecha ORIGINAL. Sumando de a
    -- uno, un 31 de enero cae en 28 de febrero y queda clavado en 28.
    v_fecha := (p_date + (v_paso * i))::date;
    exit when v_fecha > p_until;

    insert into public.items (
      user_id, tab_id, title, date, time, custom_data,
      sort_order, series_id, recurrence, recurrence_until, note, color
    ) values (
      v_user, p_tab_id, p_title, v_fecha, p_time, p_custom_data,
      v_orden, v_series, p_recurrence, p_until, p_note, p_color
    );

    i := i + 1;
    exit when i > 400;
  end loop;

  return v_series;
end;
$$;

-- La vieja de ocho parámetros se va, o la llamada queda ambigua.
drop function if exists public.create_recurring_items(uuid, text, date, jsonb, text, date, text, text);

revoke all on function public.create_recurring_items(uuid, text, date, jsonb, text, date, text, text, time) from public;
revoke execute on function public.create_recurring_items(uuid, text, date, jsonb, text, date, text, text, time) from anon;
grant execute on function public.create_recurring_items(uuid, text, date, jsonb, text, date, text, text, time) to authenticated;
