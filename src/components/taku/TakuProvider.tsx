import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Estados de Taku.
 *
 * El arte es UNO solo y no se rediseña, así que un estado no es otro dibujo:
 * es otra manera de moverse. Todo el vocabulario del personaje vive en las
 * animaciones de index.css (.taku-idle, .taku-saluda, ...). Agregar un estado
 * es agregar un keyframe, nunca tocar la imagen.
 */
export type EstadoTaku = 'idle' | 'saludando' | 'pensando' | 'festejando' | 'alerta'

export interface AccionTaku {
  texto: string
  onClick: () => void
}

export interface MensajeTaku {
  texto: string
  estado?: EstadoTaku
  /** Botones que acompañan al mensaje. Taku sugiere, no solo comenta. */
  acciones?: AccionTaku[]
  /** ms visible. 0 lo deja hasta que lo cierren. */
  duracion?: number
  /** Identidad del mensaje; con `unaVezPorDia` evita repetirlo en el día. */
  clave?: string
  unaVezPorDia?: boolean
  /**
   * 0 = ambiente: Taku habla porque sí, y se calla si habló recién.
   * 1 = respuesta directa a algo que hizo el usuario: siempre se muestra.
   *
   * Esta distinción es lo que separa un personaje de un pop-up.
   */
  prioridad?: 0 | 1
}

/** Una línea de conversación. `de` ya contempla al usuario para el chat futuro. */
export interface LineaTaku {
  id: number
  de: 'taku' | 'vos'
  texto: string
}

interface TakuApi {
  estado: EstadoTaku
  mensaje: MensajeTaku | null
  historial: LineaTaku[]
  panelAbierto: boolean
  decir: (m: MensajeTaku) => void
  reaccionar: (estado: EstadoTaku, ms?: number) => void
  callar: () => void
  abrirPanel: () => void
  cerrarPanel: () => void
}

/** Mínimo entre dos mensajes de ambiente. Sin esto Taku se vuelve un pop-up. */
const SILENCIO_MS = 45_000
const DURACION_POR_DEFECTO = 7_000
/** Lo que guarda el panel. Alcanza para dar contexto sin volverse un registro. */
const MAX_HISTORIAL = 8

const HOY_KEY = 'taku:dicho'

/** El almacenamiento puede fallar (modo privado, sitio bloqueado): nunca rompe. */
function yaSeDijoHoy(clave: string): boolean {
  try {
    return window.localStorage.getItem(`${HOY_KEY}:${clave}`) === new Date().toDateString()
  } catch {
    return false
  }
}

function anotarDelDia(clave: string) {
  try {
    window.localStorage.setItem(`${HOY_KEY}:${clave}`, new Date().toDateString())
  } catch {
    /* sin memoria: como mucho Taku repite el saludo */
  }
}

const TakuContext = createContext<TakuApi | null>(null)

/**
 * Fuera del provider la app funciona igual y Taku simplemente no habla.
 * Es un personaje, no una función crítica: si una pieza suya termina en una
 * pantalla sin provider, no puede tumbar la vista.
 */
const MUDO: TakuApi = {
  estado: 'idle',
  mensaje: null,
  historial: [],
  panelAbierto: false,
  decir: () => {},
  reaccionar: () => {},
  callar: () => {},
  abrirPanel: () => {},
  cerrarPanel: () => {}
}

export function useTaku(): TakuApi {
  return useContext(TakuContext) ?? MUDO
}

export function TakuProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoTaku>('idle')
  const [mensaje, setMensaje] = useState<MensajeTaku | null>(null)
  const [historial, setHistorial] = useState<LineaTaku[]>([])
  const [panelAbierto, setPanelAbierto] = useState(false)

  const ultimoHabla = useRef(0)
  const temporizadorMensaje = useRef<number | undefined>(undefined)
  const temporizadorEstado = useRef<number | undefined>(undefined)
  const proximoId = useRef(1)

  useEffect(
    () => () => {
      window.clearTimeout(temporizadorMensaje.current)
      window.clearTimeout(temporizadorEstado.current)
    },
    []
  )

  const reaccionar = useCallback((nuevo: EstadoTaku, ms = 2400) => {
    window.clearTimeout(temporizadorEstado.current)
    setEstado(nuevo)
    // Los estados son gestos, no modos: siempre se vuelve a respirar tranquilo.
    if (nuevo !== 'idle') {
      temporizadorEstado.current = window.setTimeout(() => setEstado('idle'), ms)
    }
  }, [])

  const callar = useCallback(() => {
    window.clearTimeout(temporizadorMensaje.current)
    setMensaje(null)
  }, [])

  const decir = useCallback(
    (m: MensajeTaku) => {
      if (m.clave && m.unaVezPorDia && yaSeDijoHoy(m.clave)) return

      const ambiente = (m.prioridad ?? 0) === 0
      if (ambiente && Date.now() - ultimoHabla.current < SILENCIO_MS) return

      ultimoHabla.current = Date.now()
      if (m.clave && m.unaVezPorDia) anotarDelDia(m.clave)

      window.clearTimeout(temporizadorMensaje.current)
      setMensaje(m)
      setHistorial((prev) =>
        [...prev, { id: proximoId.current++, de: 'taku' as const, texto: m.texto }].slice(
          -MAX_HISTORIAL
        )
      )
      reaccionar(m.estado ?? 'saludando')

      const duracion = m.duracion ?? DURACION_POR_DEFECTO
      if (duracion > 0) {
        temporizadorMensaje.current = window.setTimeout(() => setMensaje(null), duracion)
      }
    },
    [reaccionar]
  )

  const abrirPanel = useCallback(() => {
    // Al abrir el panel el globo sobra: el mensaje ya está en el historial.
    window.clearTimeout(temporizadorMensaje.current)
    setMensaje(null)
    setPanelAbierto(true)
  }, [])

  const cerrarPanel = useCallback(() => setPanelAbierto(false), [])

  const api = useMemo<TakuApi>(
    () => ({
      estado,
      mensaje,
      historial,
      panelAbierto,
      decir,
      reaccionar,
      callar,
      abrirPanel,
      cerrarPanel
    }),
    [estado, mensaje, historial, panelAbierto, decir, reaccionar, callar, abrirPanel, cerrarPanel]
  )

  return <TakuContext.Provider value={api}>{children}</TakuContext.Provider>
}
