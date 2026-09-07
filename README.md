# TAKU

> Tu día, en orden.

Calendario, gastos, facturas y tareas en una sola app, con pestañas totalmente
personalizables (nombre, color pastel y campos propios).

## Marca

La mascota se llama Taku y flota abajo a la derecha dentro de la app
(`src/components/ui/Mascota.tsx`).

El arte original vive en `assets/img/taku-mascota.png` y **no** se usa directo:
es RGB sin canal alfa, o sea que su fondo negro es opaco. `scripts/generar-mascota.mjs`
le recorta el fondo con un flood fill desde los bordes y genera los PNG de
`public/`. Para regenerarlos:

```
npm install --no-save pngjs
node scripts/generar-mascota.mjs
```

## Stack

React + Vite + TypeScript + Tailwind CSS + Supabase (auth, Postgres, RLS) + PWA instalable.

## Setup

1. `npm install`
2. Creá un proyecto en [supabase.com](https://supabase.com), andá al SQL editor y corré `supabase/schema.sql`.
3. Copiá `.env.example` a `.env` y completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. `npm run dev`

## Build de producción

```
npm run build
npm run preview
```

`vite-plugin-pwa` genera el service worker y el manifest en el build; para que la app sea instalable de verdad necesitás servirla sobre HTTPS (Vercel, Netlify, etc. lo dan gratis).

## Estado

Completo:

- Scaffold, design tokens pastel, routing, layout responsive con cajon en mobile.
- Auth: login, registro y recuperacion de cuenta por codigo (`/recuperar`).
  Requiere que el template "Reset Password" de Supabase incluya `{{ .Token }}`.
- Pestanas con campos propios (`save_tab`, un solo RPC transaccional).
- Items con campos dinamicos: alta, edicion, borrado y tilde optimista.
- Vistas `/dia`, `/semana`, `/mes` y comparativa mensual en `/gastos`.
- Reordenar pestanas, campos e items por drag & drop (dnd-kit, con soporte
  de teclado y de tactil).

Pendiente de configuracion (no de codigo):

- SMTP propio: el correo incluido de Supabase esta limitado a 2 mails/hora
  y Supabase lo marca como solo para testing.

## Base de datos

`supabase/schema.sql` es el schema completo para un proyecto **nuevo**.
Si el proyecto ya tiene las tablas, correr los archivos de
`supabase/migrations/` en orden.

Funciones: `save_tab` (guardado transaccional de pestana + campos),
`reorder_tabs` y `reorder_items`. Todas `security invoker`, asi que la RLS
de las tablas sigue aplicando adentro y la autorizacion no se duplica.
