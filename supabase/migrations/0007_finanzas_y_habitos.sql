-- ============================================================
-- Migración 0007 · Finanzas y hábitos
--
-- La estructura sale de cómo ya se organiza la usuaria en su
-- planilla, no de sus números: se tomó la FORMA, ningún valor ni
-- ningún concepto suyo queda cargado acá.
--
-- Lo que la planilla hace y esto tiene que poder hacer:
--
--  · Obligaciones del mes con monto, vencimiento y estado.
--  · Fijos que se repiten todos los meses (luz, internet, obra
--    social, gimnasio).
--  · Cuotas "n de m" (un consumo en 12 cuotas cae un mes por vez).
--  · Ingresos de varias fuentes, no de una sola.
--  · PAGOS PARCIALES: en la planilla aparecen como "2300,62 /
--    253553,18". Por eso el estado no es un booleano pagado/no
--    pagado sino un monto pagado: un booleano perdería justo el
--    dato que ella lleva a mano.
--  · Vista del mes y vista del año.
--
-- Idempotente. Requiere Postgres 15+ por "on delete set null (col)".
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
