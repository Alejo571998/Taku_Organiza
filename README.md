# TAKU

> Tu día, en orden.

Calendario, gastos, facturas y tareas en una sola app, con pestañas totalmente
personalizables (nombre, color pastel y campos propios).

## Sistema de diseno

Tema oscuro con superficies de vidrio. Los tokens viven en `src/index.css`
como **tripletas RGB sin envolver** (`--pastel-mint: 152 235 196`): ese formato
es el que permite aplicarles opacidad desde Tailwind (`bg-mint/15`) y desde
`style`. Un token guardado como hex no lo admite.

La paleta pastel de 12 colores se define en `src/lib/palette.ts`. En la base se
guarda la **clave semantica** (`mint`), nunca el hex, asi que recalibrar un tono
no requiere migrar datos. Pestanas e items comparten la misma paleta; un item
sin color propio hereda el de su pestana.

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

## Contrasenas

`src/lib/pwned.ts` rechaza contrasenas que aparezcan en filtraciones
publicas, al registrarse y al cambiarlas. Reemplaza a la opcion "Prevent
use of leaked passwords" de Supabase, que es de plan Pro.

Usa k-anonimato contra la API de HaveIBeenPwned: se calcula el SHA-1 en el
navegador y se mandan **solo los primeros 5 de sus 40 caracteres**; la API
devuelve los cientos de hashes que empiezan igual y la comparacion final
pasa en el cliente. La contrasena no sale del navegador.

Falla abierta a proposito: si la API no responde o tarda mas de 3,5s, el
registro sigue. Es una capa extra, no la unica defensa.

## Base de datos

`supabase/schema.sql` es el schema completo para un proyecto **nuevo**.
Si el proyecto ya tiene las tablas, correr los archivos de
`supabase/migrations/` en orden.

Funciones: `save_tab` (guardado transaccional de pestana + campos),
`reorder_tabs` y `reorder_items`. Todas `security invoker`, asi que la RLS
de las tablas sigue aplicando adentro y la autorizacion no se duplica.
