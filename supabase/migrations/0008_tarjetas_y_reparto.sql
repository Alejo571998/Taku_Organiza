-- ============================================================
-- Migración 0008 · Tarjetas y reparto de ingresos
--
-- Las dos piezas que faltaban de la planilla.
--
-- TARJETAS (hoja TARJETAS)
-- Ahí cada consumo es una fila y sus cuotas se reparten por columnas de
-- meses: la hoja es una tabla dinámica de consumos por mes. Acá no se
-- guarda ningún resumen mensual: el resumen de una tarjeta en un mes es
-- la SUMA de sus consumos de ese mes, calculada al leer. Guardarlo sería
-- tener el mismo número en dos lugares, y tarde o temprano uno de los
-- dos queda viejo.
--
-- Los intereses, el IVA y las comisiones no necesitan nada especial:
-- son consumos más de esa tarjeta, que es exactamente lo que son.
--
-- REPARTO (columnas de la izquierda de las hojas mensuales)
-- Entra plata y se va aplicando a las deudas, a veces en partes, hasta
-- que se acaba. Tiene que ser atómico: un reparto aplicado a medias deja
-- el balance mintiendo, y es justo la cuenta que la persona vino a
-- delegar.
--
-- Idempotente. Requiere Postgres 15+.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tarjetas
-- ------------------------------------------------------------
create table if not exists public.fin_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text check (color is null or color in (
    'mint','sage','sky','aqua','lavender','lilac',
    'pink','peach','coral','butter','cream','blue'
  )),
  -- Día del mes en que cierra y en que vence. Opcionales: sirven para
  -- avisar, no para calcular.
  closing_day smallint check (closing_day is null or closing_day between 1 and 31),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.fin_cards drop constraint if exists fin_cards_id_user_id_key;
alter table public.fin_cards add constraint fin_cards_id_user_id_key unique (id, user_id);

-- ------------------------------------------------------------
-- 2. Un movimiento puede pertenecer a una tarjeta
-- ------------------------------------------------------------
alter table public.fin_movements add column if not exists card_id uuid;

alter table public.fin_movements drop constraint if exists fin_movements_card_user_fkey;
alter table public.fin_movements add constraint fin_movements_card_user_fkey
  foreign key (card_id, user_id)
  references public.fin_cards(id, user_id)
  on delete set null (card_id);

-- Borrar una tarjeta deja sus consumos sin tarjeta, no los borra: son
-- gastos que existieron y siguen contando en el total del mes.

create index if not exists fin_movements_card_date_idx
  on public.fin_movements(card_id, date) where card_id is not null;

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
alter table public.fin_cards enable row level security;

drop policy if exists "fin_cards: el usuario administra las suyas" on public.fin_cards;
create policy "fin_cards: el usuario administra las suyas"
  on public.fin_cards for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 4. Repartir un ingreso entre varias deudas, todo o nada
--
-- Recibe [{"id": uuid, "monto": numeric}, ...] y SUMA cada monto al
-- pagado del movimiento correspondiente.
--
-- Suma en vez de reemplazar porque una deuda puede recibir plata de dos
-- ingresos distintos: así es como se paga la luz cuando no alcanza de
-- una, que es el caso que la planilla lleva a mano.
--
-- security invoker: la RLS de la tabla sigue aplicando adentro, así que
-- un id de otro usuario no se puede tocar y la autorización no se
-- duplica acá.
-- ------------------------------------------------------------
create or replace function public.repartir_ingreso(p_asignaciones jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_id uuid;
  v_monto numeric(14, 2);
  v_actual numeric(14, 2);
  v_total numeric(14, 2);
  v_aplicados integer := 0;
begin
  if v_user is null then
    raise exception 'Hay que estar logueado.';
  end if;
  if jsonb_typeof(p_asignaciones) <> 'array' then
    raise exception 'Se espera una lista de asignaciones.';
  end if;

  for v_item in select * from jsonb_array_elements(p_asignaciones) loop
    v_id := (v_item ->> 'id')::uuid;
    v_monto := round((v_item ->> 'monto')::numeric, 2);

    if v_monto is null or v_monto <= 0 then
      continue;
    end if;

    select paid_amount, amount into v_actual, v_total
    from public.fin_movements
    where id = v_id
    for update;

    if not found then
      raise exception 'No se encontró el movimiento %.', v_id;
    end if;

    -- No se deja pagar de más: el excedente sería plata inventada en el
    -- balance. Lo que sobra se queda sin asignar, que es la verdad.
    if v_actual + v_monto > v_total then
      v_monto := v_total - v_actual;
    end if;

    if v_monto > 0 then
      update public.fin_movements
      set paid_amount = paid_amount + v_monto
      where id = v_id;
      v_aplicados := v_aplicados + 1;
    end if;
  end loop;

  return v_aplicados;
end;
$$;

revoke all on function public.repartir_ingreso(jsonb) from public;
revoke execute on function public.repartir_ingreso(jsonb) from anon;
grant execute on function public.repartir_ingreso(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 5. Saldar el resumen de una tarjeta de un mes
--
-- La tarjeta se paga de una, no consumo por consumo. Esto marca pagados
-- todos los consumos de esa tarjeta imputados a ese mes, que es lo que
-- de verdad pasó cuando se paga el resumen.
-- ------------------------------------------------------------
create or replace function public.pagar_resumen_tarjeta(
  p_card_id uuid,
  p_desde date,
  p_hasta date,
  -- false deshace el pago y deja todo en cero otra vez.
  p_pagar boolean default true
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tocados integer;
begin
  if v_user is null then
    raise exception 'Hay que estar logueado.';
  end if;

  update public.fin_movements
  set paid_amount = case when p_pagar then amount else 0 end
  where card_id = p_card_id
    and kind = 'gasto'
    and date between p_desde and p_hasta;

  get diagnostics v_tocados = row_count;
  return v_tocados;
end;
$$;

revoke all on function public.pagar_resumen_tarjeta(uuid, date, date, boolean) from public;
revoke execute on function public.pagar_resumen_tarjeta(uuid, date, date, boolean) from anon;
grant execute on function public.pagar_resumen_tarjeta(uuid, date, date, boolean) to authenticated;

-- ------------------------------------------------------------
-- 6. La serie puede nacer ya asociada a una tarjeta
--
-- Una compra en cuotas es, casi siempre, una compra con tarjeta. Se
-- reemplaza la función con un parámetro más en vez de agregar una
-- sobrecarga, para que no queden dos versiones conviviendo.
-- ------------------------------------------------------------
drop function if exists public.crear_movimientos_en_serie(
  text, text, numeric, date, smallint, uuid, text, text, date, boolean
);

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
  p_es_fijo boolean default false,
  p_card_id uuid default null
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
    -- El redondeo sobrante va a la PRIMERA cuota y no se pierde: 100 en 3
    -- son 33,34 + 33,33 + 33,33 y la suma vuelve a dar 100.
    v_cuota := round(p_total / p_cuotas, 2);
    v_resto := round(p_total - (v_cuota * p_cuotas), 2);
  end if;

  for i in 1..p_cuotas loop
    insert into public.fin_movements (
      user_id, category_id, card_id, kind, description, amount, date, due_date,
      method, note, series_id, installment, installments, recurring
    ) values (
      v_user, p_category_id, p_card_id, p_kind, p_description,
      case when i = 1 then v_cuota + v_resto else v_cuota end,
      (p_date + (interval '1 month' * (i - 1)))::date,
      case when p_due_date is null then null
           else (p_due_date + (interval '1 month' * (i - 1)))::date end,
      p_method, p_note,
      case when p_cuotas > 1 then v_series else null end,
      case when p_es_fijo or p_cuotas = 1 then null else i end,
      case when p_es_fijo or p_cuotas = 1 then null else p_cuotas end,
      p_es_fijo
    );
  end loop;

  return v_series;
end;
$$;

revoke all on function public.crear_movimientos_en_serie(text, text, numeric, date, smallint, uuid, text, text, date, boolean, uuid) from public;
revoke execute on function public.crear_movimientos_en_serie(text, text, numeric, date, smallint, uuid, text, text, date, boolean, uuid) from anon;
grant execute on function public.crear_movimientos_en_serie(text, text, numeric, date, smallint, uuid, text, text, date, boolean, uuid) to authenticated;
