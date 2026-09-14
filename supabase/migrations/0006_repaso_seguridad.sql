-- ============================================================
-- Migración 0006 · repaso de seguridad y rendimiento
-- Idempotente. Ya incluida en schema.sql para proyectos nuevos.
-- ============================================================

-- paso_repeticion había quedado ejecutable por anon. No filtra nada (es pura
-- y no toca datos), pero el resto de las funciones no lo están y conviene que
-- el criterio sea uniforme.
revoke all on function public.paso_repeticion(text) from public;
revoke execute on function public.paso_repeticion(text) from anon;
grant execute on function public.paso_repeticion(text) to authenticated;

-- Las FK compuestas no tenían índice que las cubriera: al borrar una pestaña,
-- Postgres tiene que escanear items para encontrar los hijos.
-- items_tab_idx queda cubierto por el nuevo (tab_id es su prefijo), así que se
-- elimina para no mantener dos índices que sirven lo mismo.
create index if not exists items_tab_user_idx on public.items(tab_id, user_id);
drop index if exists public.items_tab_idx;

create index if not exists tabs_amount_field_idx
  on public.tabs(amount_field_id, id) where amount_field_id is not null;
