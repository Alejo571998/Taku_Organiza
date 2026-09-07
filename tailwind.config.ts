import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-alt': 'var(--color-surface-alt)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        accent: 'var(--color-accent)',
        'accent-soft': 'var(--color-accent-soft)',
        'accent-text': 'var(--color-accent-text)',
        danger: 'var(--color-danger)',
        cat: {
          peach: 'var(--cat-peach)',
          'peach-text': 'var(--cat-peach-text)',
          sky: 'var(--cat-sky)',
          'sky-text': 'var(--cat-sky-text)',
          mint: 'var(--cat-mint)',
          'mint-text': 'var(--cat-mint-text)',
          blush: 'var(--cat-blush)',
          'blush-text': 'var(--cat-blush-text)',
          lavender: 'var(--cat-lavender)',
          'lavender-text': 'var(--cat-lavender-text)',
          butter: 'var(--cat-butter)',
          'butter-text': 'var(--cat-butter-text)',
          seafoam: 'var(--cat-seafoam)',
          'seafoam-text': 'var(--cat-seafoam-text)'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '10px',
        card: '14px'
      }
    }
  },
  plugins: []
} satisfies Config
