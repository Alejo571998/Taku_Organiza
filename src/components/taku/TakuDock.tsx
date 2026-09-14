import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '@/hooks/useItems'
import { todayISO } from '@/lib/dates'
import TakuImage from './TakuImage'
import { useTaku } from './TakuProvider'

/**
 * Taku fijo abajo a la izquierda: su lugar en la app.
 *
 * Tres decisiones que hacen que acompañe en vez de estorbar:
 *
 * 1. El contenedor NO recibe clicks (pointer-events-none) y solo los reciben
 *    el botón y el globo. Taku ya se comió una vez el click de la última
 *    tarea de la lista; un personaje no puede costarle una tarea a nadie.
 * 2. Se esconde al scrollear hacia abajo y vuelve al frenar o al subir.
 *    Mientras se lee, la esquina es del contenido.
 * 3. Habla desde acá y no desde cada vista, así sabe cuánto queda pendiente
 *    hoy sin importar en qué pantalla esté parado el usuario.
 *
 * El panel es el chat de mañana: hoy muestra la conversación que Taku ya tuvo
 * y atajos que funcionan de verdad. Cuando haya un modelo detrás se habilita
 * el campo de texto y las respuestas entran por el mismo historial.
 */
export default function TakuDock() {
  const { estado, mensaje, historial, panelAbierto, decir, callar, abrirPanel, cerrarPanel } =
    useTaku()
  const navigate = useNavigate()

  const hoy = todayISO()
  const { data: itemsHoy } = useItems(hoy, hoy)
  const pendientes = itemsHoy?.filter((i) => !i.completed).length ?? 0

  const [scrolleando, setScrolleando] = useState(false)
  const pendientesPrevio = useRef<number | null>(null)

  // --- Saludo del día -------------------------------------------------------
  // Con un respiro: entrar a una app y que algo te hable en el mismo frame se
  // siente a pop-up. De que sea una sola vez por día se encarga el provider.
  useEffect(() => {
    if (!itemsHoy) return
    const t = window.setTimeout(() => {
      decir({
        clave: 'saludo',
        unaVezPorDia: true,
        estado: 'saludando',
        texto:
          pendientes === 0
            ? 'Hola. Hoy no tenés nada anotado.'
            : `Hola. Te quedan ${pendientes} tarea${pendientes === 1 ? '' : 's'} para hoy.`,
        acciones: [{ texto: 'Ver el día', onClick: () => navigate('/dia') }]
      })
    }, 1200)
    return () => window.clearTimeout(t)
  }, [itemsHoy, pendientes, decir, navigate])

  // --- Festejo al terminar el día ------------------------------------------
  useEffect(() => {
    if (!itemsHoy || itemsHoy.length === 0) {
      pendientesPrevio.current = null
      return
    }
    const antes = pendientesPrevio.current
    pendientesPrevio.current = pendientes
    // Solo en la transición. Si al abrir la app ya estaba todo tildado no hay
    // logro que festejar, y festejarlo igual sería un festejo falso.
    if (antes !== null && antes > 0 && pendientes === 0) {
      decir({
        texto: 'Listo, terminaste todo lo de hoy.',
        estado: 'festejando',
        prioridad: 1,
        duracion: 6000
      })
    }
  }, [itemsHoy, pendientes, decir])

  // --- Esconderse mientras se scrollea -------------------------------------
  useEffect(() => {
    let ultimoY = window.scrollY
    let frenada: number | undefined

    function alScrollear() {
      const y = window.scrollY
      // El umbral de 6px es por el rebote del scroll en mobile, que dispara
      // eventos de uno o dos píxeles todo el tiempo.
      if (y > ultimoY + 6 && y > 80) setScrolleando(true)
      else if (y < ultimoY - 6) setScrolleando(false)
      ultimoY = y
      window.clearTimeout(frenada)
      frenada = window.setTimeout(() => setScrolleando(false), 700)
    }

    window.addEventListener('scroll', alScrollear, { passive: true })
    return () => {
      window.removeEventListener('scroll', alScrollear)
      window.clearTimeout(frenada)
    }
  }, [])

  // Si Taku tiene algo que decir no se esconde, o el mensaje se perdería.
  const escondido = scrolleando && !panelAbierto && !mensaje

  function irA(ruta: string) {
    navigate(ruta)
    cerrarPanel()
  }

  const atajos = [
    { texto: 'Nueva tarea', al: () => irA('/dia?nueva=1') },
    {
      texto: 'Qué tengo hoy',
      al: () => {
        navigate('/dia')
        cerrarPanel()
        decir({
          prioridad: 1,
          estado: pendientes === 0 ? 'festejando' : 'saludando',
          texto:
            pendientes === 0
              ? 'Hoy no te queda nada pendiente.'
              : `Te quedan ${pendientes} tarea${pendientes === 1 ? '' : 's'} para hoy.`
        })
      }
    },
    { texto: 'Esta semana', al: () => irA('/semana') },
    { texto: 'Gastos', al: () => irA('/gastos') }
  ]

  return (
    // Esconderse es una clase y no un estilo en línea a propósito: el estilo
    // en línea le ganaba a la regla que lo oculta cuando se abre un modal, y
    // Taku quedaba flotando sobre el fondo oscurecido.
    <div
      className={`taku-dock pointer-events-none fixed left-3 z-40 flex flex-col items-start gap-2 transition-all duration-300 sm:left-4 ${
        escondido ? 'taku-dock--oculto' : ''
      }`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem)' }}
    >
      {/* --- Panel: el chat de mañana --------------------------------------- */}
      {panelAbierto && (
        <div className="taku-burbuja glass-strong pointer-events-auto w-[min(21rem,calc(100vw-1.5rem))] rounded-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <TakuImage px={36} estado="idle" className="h-7 w-7" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Taku</p>
              <p className="text-[11px] leading-tight text-text-muted">Te sigue el día</p>
            </div>
            <button
              onClick={cerrarPanel}
              aria-label="Cerrar a Taku"
              className="grid h-7 w-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="mb-2.5 flex max-h-44 flex-col gap-1.5 overflow-y-auto">
            {historial.length === 0 && (
              <p className="rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-text-secondary">
                Por ahora te aviso cosas del día. Pronto vas a poder preguntarme.
              </p>
            )}
            {historial.map((linea) => (
              <p
                key={linea.id}
                className={
                  linea.de === 'taku'
                    ? 'rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-text-secondary'
                    : 'self-end rounded-xl bg-accent/15 px-3 py-2 text-sm text-text-primary'
                }
              >
                {linea.texto}
              </p>
            ))}
          </div>

          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {atajos.map((a) => (
              <button
                key={a.texto}
                onClick={a.al}
                className="rounded-pill border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs transition-colors hover:bg-white/[0.12]"
              >
                {a.texto}
              </button>
            ))}
          </div>

          {/* Deshabilitado a propósito y dicho con todas las letras: prometer
              un chat que todavía no existe es peor que avisar que falta. */}
          <input
            disabled
            className="field cursor-not-allowed opacity-60"
            placeholder="Escribirle a Taku — muy pronto"
            aria-label="Chat con Taku, todavía no disponible"
          />
        </div>
      )}

      {/* --- Globo de diálogo ----------------------------------------------- */}
      {!panelAbierto && mensaje && (
        <div
          role="status"
          aria-live="polite"
          className="taku-burbuja glass-strong pointer-events-auto max-w-[min(17rem,calc(100vw-5.5rem))] rounded-card px-3 py-2.5"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm leading-snug text-text-primary">{mensaje.texto}</p>
            <button
              onClick={callar}
              aria-label="Cerrar el mensaje"
              className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {mensaje.acciones && mensaje.acciones.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mensaje.acciones.map((a) => (
                <button
                  key={a.texto}
                  onClick={() => {
                    a.onClick()
                    callar()
                  }}
                  className="rounded-pill bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent/30"
                >
                  {a.texto}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Taku ----------------------------------------------------------- */}
      <button
        onClick={() => (panelAbierto ? cerrarPanel() : abrirPanel())}
        aria-label={panelAbierto ? 'Cerrar a Taku' : 'Abrir a Taku'}
        aria-expanded={panelAbierto}
        title="Taku"
        className="pointer-events-auto rounded-full transition-transform hover:scale-105 active:scale-95"
      >
        <TakuImage
          px={72}
          estado={estado}
          className="h-14 w-14 drop-shadow-[0_6px_16px_rgba(0,0,0,0.55)] sm:h-16 sm:w-16"
        />
      </button>
    </div>
  )
}
