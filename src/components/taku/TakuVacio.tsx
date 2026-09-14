import type { ReactNode } from 'react'
import TakuImage from './TakuImage'

/**
 * Estado vacío con Taku.
 *
 * Acá el personaje es lo que más rinde: una pantalla sin datos es el peor
 * momento de cualquier app, es justo donde no hay contenido que tapar, y Taku
 * ya viene dibujado con una lista de tareas en la mano. En vez de un renglón
 * gris que informa que no hay nada, alguien te dice qué hacer.
 */
interface Props {
  titulo: string
  detalle?: ReactNode
  /** Botón o enlace para salir del vacío. Un estado vacío sin salida no sirve. */
  accion?: ReactNode
}

export default function TakuVacio({ titulo, detalle, accion }: Props) {
  return (
    <div className="glass flex flex-col items-center gap-1.5 rounded-card px-5 py-9 text-center">
      <TakuImage px={128} className="mb-1 h-20 w-20 opacity-95 sm:h-24 sm:w-24" />
      <p className="text-sm font-medium text-text-primary">{titulo}</p>
      {detalle && <p className="max-w-sm text-sm text-text-secondary">{detalle}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}
