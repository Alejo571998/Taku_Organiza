import type { EstadoTaku } from './TakuProvider'

/**
 * El arte de Taku, sin retoques.
 *
 * Único lugar de la app que nombra el archivo: si mañana cambia el PNG, cambia
 * acá y en ningún otro lado. La imagen no se recorta, no se tiñe y no se
 * reinterpreta; lo único que varía es cómo se mueve.
 *
 * Los dos tamaños salen de scripts/generar-mascota.mjs a partir del original.
 * El navegador elige según el tamaño de pantalla y la densidad: en el dock
 * (56px) baja 75 KB, y solo pide los 146 KB cuando Taku aparece grande.
 */

const CLASE_POR_ESTADO: Record<EstadoTaku, string> = {
  idle: 'taku-idle',
  saludando: 'taku-saluda',
  pensando: 'taku-piensa',
  festejando: 'taku-festeja',
  alerta: 'taku-alerta'
}

interface Props {
  /**
   * Lado en px al que se va a dibujar, para que el navegador elija archivo.
   * El tamaño real lo pone `className`: si acá se pasara un estilo en línea,
   * Taku no podría achicarse en el celular.
   */
  px: number
  estado?: EstadoTaku
  /** Tiene que traer alto y ancho. Sin `transform`: lo usa la animación. */
  className?: string
}

export default function TakuImage({ px, estado = 'idle', className = '' }: Props) {
  return (
    <img
      src="/taku.png"
      srcSet="/taku.png 256w, /taku-384.png 384w"
      sizes={`${px}px`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`${CLASE_POR_ESTADO[estado]} select-none object-contain ${className}`}
    />
  )
}
