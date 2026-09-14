import { PALETTE, pastel } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'

interface Props {
  value: PaletteKey | null
  onChange: (color: PaletteKey) => void
  /** Texto de la opción "sin color propio". Si falta, no se ofrece. */
  heredaLabel?: string
  onHeredar?: () => void
}

/**
 * Selector de color por pastillas.
 *
 * El seleccionado se marca con un anillo del propio color más un tilde, no
 * solo con el anillo: sobre pasteles cercanos (mint/sage, lilac/lavender) el
 * anillo solo es difícil de ubicar de un vistazo.
 */
export default function ColorSwatches({ value, onChange, heredaLabel, onHeredar }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {heredaLabel && onHeredar && (
        <button
          type="button"
          onClick={onHeredar}
          aria-pressed={value === null}
          className={`rounded-pill border px-3 py-1.5 text-xs transition-colors ${
            value === null
              ? 'border-accent/60 bg-accent/15 text-accent-text'
              : 'border-white/10 text-text-muted hover:text-text-secondary'
          }`}
        >
          {heredaLabel}
        </button>
      )}

      {PALETTE.map((c) => {
        const activo = value === c.key
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-label={c.label}
            aria-pressed={activo}
            title={c.label}
            className="grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-110"
            style={{
              // Siempre a opacidad plena: a 55% sobre el fondo oscuro los
              // pasteles se apagaban y dejaban de leerse como pasteles. La
              // selección se distingue por el anillo y el tilde, no por el tono.
              background: pastel(c.key, 1),
              boxShadow: activo
                ? `0 0 0 2px rgb(var(--color-bg)), 0 0 0 4px ${pastel(c.key, 0.9)}`
                : 'inset 0 0 0 1px rgb(0 0 0 / 0.2)',
              opacity: activo ? 1 : 0.92
            }}
          >
            {activo && (
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="rgb(10 15 30)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
