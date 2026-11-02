-- ============================================================
-- Migración 0009 · El user_id sale solo de la sesión
--
-- Hasta acá, cada insert del cliente tenía que acordarse de mandar
-- user_id. La columna es not null, así que alcanzaba con olvidarlo una
-- vez para que esa pantalla no pudiera crear NADA: el insert moría con
-- "null value in column user_id". Pasó exactamente eso con las cuatro
-- altas nuevas (categoría, movimiento, tarjeta, hábito).
--
-- Con el default, el que no lo manda recibe el suyo.
--
-- No afloja la seguridad: la policy sigue exigiendo
-- with check (auth.uid() = user_id), así que mandar el id de otro sigue
-- siendo imposible. Esto cubre solo el caso de no mandar ninguno.
--
-- Un valor explícito le gana al default, así que el código que ya lo
-- manda (tabs, items) sigue funcionando igual.
-- ============================================================
alter table public.tabs            alter column user_id set default auth.uid();
alter table public.items           alter column user_id set default auth.uid();
alter table public.fin_categories  alter column user_id set default auth.uid();
alter table public.fin_movements   alter column user_id set default auth.uid();
alter table public.fin_cards       alter column user_id set default auth.uid();
alter table public.fin_settings    alter column user_id set default auth.uid();
alter table public.habits          alter column user_id set default auth.uid();
alter table public.habit_logs      alter column user_id set default auth.uid();
