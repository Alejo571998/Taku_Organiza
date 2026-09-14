import { useState } from 'react'
import { pastel } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'

/**
 * Indicador de nota. Discreto cuando está cerrado y expandible en el lugar.
 *
 * Se eligió expansión en línea y no popover ni modal: en el celular un
 * popover termina siendo una pantalla completa igual, y un modal sobre una
 * lista rompe el hilo de lectura. Así la tarjeta crece solo cuando el
 * usuario lo pide y vuelve a su alto normal al cerrarla.
 */
export default function NoteToggle({ note, color }: { note: string; color: PaletteKey }) {
  const [abierta, setAbierta] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Las tarjetas de Semana y Mes navegan al hacer click; la nota no
          // tiene por qué sacarte de la vista.
          e.stopPropagation()
          setAbierta((v) => !v)
        }}
        aria-expanded={abierta}
        aria-label={abierta ? 'Ocultar nota' : 'Ver nota'}
        title={abierta ? 'Ocultar nota' : 'Ver nota'}
        className="shrink-0 rounded-lg p-1 transition-colors"
        style={{
          color: pastel(color, abierta ? 1 : 0.7),
          background: abierta ? pastel(color, 0.14) : 'transparent'
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 11h16M4 16h9" />
        </svg>
      </button>

      {abierta && (
        <p
          className="mt-2 w-full whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed text-text-secondary"
          style={{
            background: 'rgb(0 0 0 / 0.22)',
            borderLeft: `2px solid ${pastel(color, 0.55)}`
          }}
        >
          {note}
        </p>
      )}
    </>
  )
}
