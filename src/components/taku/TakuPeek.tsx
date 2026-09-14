import TakuImage from './TakuImage'
import type { EstadoTaku } from './TakuProvider'

/**
 * Taku asomándose por detrás de la tarjeta, para login y recuperación.
 *
 * Se ancla con `bottom-full`, que apoya su base justo en el borde superior de
 * la tarjeta, y después baja un 42% de su propio alto: así queda medio adentro
 * y medio afuera a cualquier tamaño de pantalla, sin cuentas en píxeles.
 *
 * El medio de abajo queda detrás del vidrio, que lo desenfoca. No es un
 * accidente: es lo que vuelve creíble que esté atrás y no pegado encima.
 *
 * El translate va en el div de afuera porque la clase de animación manda sobre
 * `transform` y lo pisaría.
 */
export default function TakuPeek({ estado = 'idle' }: { estado?: EstadoTaku }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-full z-0 flex justify-end pr-5 sm:pr-8"
    >
      <div className="translate-y-[42%]">
        <TakuImage
          px={176}
          estado={estado}
          className="h-28 w-28 drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] sm:h-44 sm:w-44"
        />
      </div>
    </div>
  )
}
