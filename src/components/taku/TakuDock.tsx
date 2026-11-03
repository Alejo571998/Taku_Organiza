import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useItems, itemsKey } from '@/hooks/useItems'
import { movimientosKey } from '@/hooks/useFinanzas'
import { habitosKey, marcasKey } from '@/hooks/useHabitos'
import { fetchItems } from '@/lib/queries/items'
import { fetchTabs } from '@/lib/queries/tabs'
import { fetchMovements } from '@/lib/queries/finanzas'
import { fetchHabits, fetchHabitLogs } from '@/lib/queries/habitos'
import { armarResumen } from '@/lib/resumenDelDia'
import { hablar, callarVoz, despertarVoz, puedeHablar } from '@/lib/voz'
import { todayISO, addDays } from '@/lib/dates'
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
  const {
    estado,
    mensaje,
    historial,
    panelAbierto,
    decir,
    reaccionar,
    callar,
    abrirPanel,
    cerrarPanel
  } = useTaku()
  const navigate = useNavigate()

  const hoy = todayISO()
  const { data: itemsHoy } = useItems(hoy, hoy)
  const pendientes = itemsHoy?.filter((i) => !i.completed).length ?? 0

  const queryClient = useQueryClient()
  const [scrolleando, setScrolleando] = useState(false)
  const [pensando, setPensando] = useState(false)

  // La voz arranca encendida pero se recuerda apagada: alguien que la apaga
  // no quiere que vuelva sola en la próxima visita.
  const [vozActiva, setVozActiva] = useState(() => {
    try {
      return window.localStorage.getItem('taku:voz') !== '0'
    } catch {
      return true
    }
  })
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

  function alternarVoz() {
    setVozActiva((previo) => {
      const siguiente = !previo
      try {
        window.localStorage.setItem('taku:voz', siguiente ? '1' : '0')
      } catch {
        /* sin memoria: como mucho vuelve encendida la próxima vez */
      }
      if (!siguiente) callarVoz()
      return siguiente
    })
  }

  /**
   * El resumen del día: lo que queda por hacer, lo que vence y los hábitos
   * que faltan, en una frase.
   *
   * Los datos se piden ACÁ y no con hooks arriba del componente: el dock está
   * en todas las pantallas, y tener cinco consultas corriendo siempre para una
   * pregunta que se hace una vez al día sería cobrarle a toda la app el costo
   * de un botón. fetchQuery reusa lo que ya esté en caché.
   */
  async function contarElDia() {
    // La chispa de voz va primero y sin await: iOS solo deja hablar dentro
    // del gesto que lo pidió, y abajo hay que esperar a la red.
    if (vozActiva) despertarVoz()

    setPensando(true)
    reaccionar('pensando', 6000)
    try {
      // Dos meses hacia atrás para las cuentas vencidas: una deuda de hace
      // tres semanas sigue siendo deuda de hoy.
      const desde = addDays(hoy, -60)
      const [tareas, pestanas, movs, habitos, marcas] = await Promise.all([
        queryClient.fetchQuery({ queryKey: itemsKey(hoy, hoy), queryFn: () => fetchItems(hoy, hoy) }),
        queryClient.fetchQuery({ queryKey: ['tabs'], queryFn: fetchTabs }),
        queryClient.fetchQuery({
          queryKey: movimientosKey(desde, hoy),
          queryFn: () => fetchMovements(desde, hoy)
        }),
        queryClient.fetchQuery({ queryKey: habitosKey, queryFn: fetchHabits }),
        queryClient.fetchQuery({
          queryKey: marcasKey(hoy, hoy),
          queryFn: () => fetchHabitLogs(hoy, hoy)
        })
      ])

      const resumen = armarResumen({
        tareas,
        pestanas,
        movimientos: movs,
        habitos,
        cumplidos: new Set(marcas.map((m) => `${m.habit_id}|${m.date}`)),
        hoy
      })

      cerrarPanel()
      decir({
        prioridad: 1,
        estado: resumen.todoListo ? 'festejando' : 'saludando',
        texto: resumen.escrito,
        // Más largo que un aviso común: es un texto para leer, no un cartel.
        duracion: 16000,
        acciones: [{ texto: 'Ver el día', onClick: () => navigate('/dia') }]
      })
      if (vozActiva) hablar(resumen.hablado)
    } catch {
      decir({
        prioridad: 1,
        estado: 'alerta',
        texto: 'No pude leer tu día. Fijate la conexión y probá de nuevo.'
      })
    } finally {
      setPensando(false)
    }
  }

  function irA(ruta: string) {
    navigate(ruta)
    cerrarPanel()
  }

  const atajos = [
    { texto: 'Nueva tarea', al: () => irA('/dia?nueva=1') },
    { texto: pensando ? 'Mirando…' : 'Resumen de hoy', al: contarElDia },
    { texto: 'Esta semana', al: () => irA('/semana') },
    { texto: 'Gastos', al: () => irA('/gastos') }
  ]

  return (
    // Esconderse es una clase y no un estilo en línea a propósito: el estilo
    // en línea le ganaba a la regla que lo oculta cuando se abre un modal, y
    // Taku quedaba flotando sobre el fondo oscurecido.
    <div
      className={`taku-dock pointer-events-none fixed left-3 z-40 flex flex-col items-start gap-2 transition-all duration-300 sm:left-4 lg:left-[15.5rem] ${
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
            {/* La voz se puede apagar. Alguien en una oficina, en un colectivo
                o que simplemente prefiere leer no tiene por qué pelearse con
                una app que habla. */}
            {puedeHablar() && (
              <button
                onClick={alternarVoz}
                aria-pressed={vozActiva}
                aria-label={vozActiva ? 'Apagar la voz de Taku' : 'Encender la voz de Taku'}
                title={vozActiva ? 'Voz encendida' : 'Voz apagada'}
                className={`grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-white/5 ${
                  vozActiva ? 'text-accent-text' : 'text-text-muted'
                }`}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                  {vozActiva ? <path d="M15.5 8.5a5 5 0 0 1 0 7" /> : <path d="m16 9 5 6m0-6-5 6" />}
                </svg>
              </button>
            )}

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

            {/* Volver a escucharlo, sin tener que pedir el resumen de nuevo. */}
            {puedeHablar() && (
              <button
                onClick={() => hablar(mensaje.texto)}
                aria-label="Leer en voz alta"
                title="Leer en voz alta"
                className="-mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                </svg>
              </button>
            )}

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
