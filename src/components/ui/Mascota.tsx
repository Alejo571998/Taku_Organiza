import { useState } from 'react'

/**
 * Taku, la mascota. Flota abajo a la derecha, por encima de la barra de
 * pestañas.
 *
 * NO recibe eventos de puntero. Flota sobre la columna de contenido, y con
 * pointer-events activos se comía el click de la última tarea de la lista:
 * un adorno no puede bloquear una tarea. Cuando le demos funcionalidad va a
 * necesitar reservar su lugar en el layout en vez de superponerse.
 *
 * Va translúcida por el mismo motivo: a plena opacidad tapaba la etiqueta de
 * pestaña de la fila de abajo.
 *
 * z-20 la deja por debajo de la barra de pestañas (z-30) y de los modales
 * (z-50), o se superpondría a los formularios.
 */
export default function Mascota() {
  const [falta, setFalta] = useState(false)

  // Si todavía no está el PNG en public/, no dibujamos el ícono roto.
  if (falta) return null

  return (
    <img
      src="/taku.png"
      alt=""
      aria-hidden="true"
      onError={() => setFalta(true)}
      className="pointer-events-none fixed bottom-16 right-2 z-20 h-14 w-14 select-none object-contain opacity-60 drop-shadow-lg sm:h-16 sm:w-16"
    />
  )
}
