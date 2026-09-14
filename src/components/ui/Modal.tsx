import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { pastel } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
  /** Tiñe el halo superior con el color del contenido que se edita. */
  accent?: PaletteKey
  /** Acciones fijas al pie; no scrollean con el contenido. */
  footer?: ReactNode
}

/**
 * Modal de vidrio, compartido por toda la app.
 *
 * El pie queda fijo y solo scrollea el medio: en el celular, con el teclado
 * abierto, un botón de guardar que se va con el scroll obliga a cerrar el
 * teclado para encontrarlo.
 */
export default function Modal({ title, children, onClose, accent, footer }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', alEscape)
    // Sin esto el fondo scrollea detrás del modal en mobile.
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // La clase la lee index.css para esconder a Taku: es la única pieza fija
    // que quedaría flotando sobre el fondo oscurecido.
    document.body.classList.add('modal-abierto')
    return () => {
      document.removeEventListener('keydown', alEscape)
      document.body.style.overflow = overflowPrevio
      document.body.classList.remove('modal-abierto')
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgb(3 6 16 / 0.72)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => {
        // Solo si el gesto empieza Y termina fuera: si no, arrastrar para
        // seleccionar texto y soltar afuera cerraría el modal.
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panel}
        className="glass-strong flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-card sm:max-w-lg sm:rounded-card"
      >
        <div className="relative flex items-center justify-between px-5 pb-3 pt-5">
          {accent && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              style={{
                background: `radial-gradient(60% 100% at 50% 0%, ${pastel(accent, 0.16)}, transparent 70%)`
              }}
            />
          )}
          <h2 className="relative text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="relative grid h-8 w-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4">{children}</div>

        {footer && (
          <div className="border-t border-white/[0.07] bg-black/20 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
