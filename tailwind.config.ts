import type { Config } from 'tailwindcss'

/**
 * Cada token se declara como `rgb(var(--x) / <alpha-value>)`. Ese
 * marcador es lo que deja usar `bg-surface/10`, `text-mint/70` o
 * `border-white/5` sobre variables CSS: sin él Tailwind no puede
 * inyectar la opacidad y habría que declarar un token por intensidad.
 */
const conVar = (nombre: string) => `rgb(var(${nombre}) / <alpha-value>)`

const PASTELES = [
  'mint',
  'sage',
  'aqua',
  'sky',
  'blue',
  'lavender',
  'lilac',
  'pink',
  'coral',
  'peach',
  'butter',
  'cream'
] as const

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: conVar('--color-bg'),
        'bg-deep': conVar('--color-bg-deep'),
        surface: conVar('--color-surface'),
        'text-primary': conVar('--color-text-primary'),
        'text-secondary': conVar('--color-text-secondary'),
        'text-muted': conVar('--color-text-muted'),
        accent: conVar('--color-accent'),
        'accent-text': conVar('--color-accent-text'),
        danger: conVar('--color-danger'),
        ...Object.fromEntries(PASTELES.map((c) => [c, conVar(`--pastel-${c}`)]))
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '12px',
        card: '20px',
        pill: '999px'
      },
      boxShadow: {
        glow: '0 0 24px -6px rgb(var(--color-accent) / 0.45)'
      }
    }
  },
  plugins: []
} satisfies Config
