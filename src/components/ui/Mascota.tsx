import { useState } from 'react'

/**
 * Taku, la mascota. Flota abajo a la derecha.
 *
 * Es el punto de anclaje para la funcionalidad que venga después (asistente,
 * recordatorios, lo que sea): por ahora solo saluda con la frase al pasar el
 * mouse, así que va como decorativa y sin rol de botón.
 *
 * z-20 a propósito: queda por debajo de la barra de pestañas (z-30) y de los
 * modales (z-50), o se superpone a los formularios.
 *
 * El contenedor no recibe eventos y solo la imagen sí, para no tapar clicks
 * del contenido que queda abajo. El :hover igual llega al grupo, porque un
 * ancestro entra en :hover cuando lo hace un hijo que sí recibe el evento.
 */
export default function Mascota() {
  const [falta, setFalta] = useState(false)

  // Si todavía no está el PNG en public/, no dibujamos el ícono roto.
  if (falta) return null

  return (
    <div className="group/taku fixed bottom-16 right-3 z-20 flex items-end gap-2 pointer-events-none select-none">
      <span className="hidden sm:block mb-3 rounded-card border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary shadow-sm opacity-0 transition-opacity group-hover/taku:opacity-100">
        Tu día, en orden.
      </span>
      <img
        src="/taku.png"
        alt=""
        aria-hidden="true"
        onError={() => setFalta(true)}
        className="pointer-events-auto h-16 w-16 object-contain drop-shadow-lg transition-transform hover:scale-110 hover:-rotate-3 sm:h-20 sm:w-20"
      />
    </div>
  )
}
