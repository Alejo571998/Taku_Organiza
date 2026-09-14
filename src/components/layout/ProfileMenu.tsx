import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

/**
 * Menú de perfil. Reemplaza a la barra lateral: ahora que las pestañas viven
 * al pie, lo único que quedaba ahí era la cuenta, y una columna entera para
 * eso se comía el ancho (en el celular, el 60% de la pantalla).
 */
export default function ProfileMenu() {
  const { user, signOut } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const cont = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function alTocarAfuera(e: MouseEvent) {
      if (!cont.current?.contains(e.target as Node)) setAbierto(false)
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alTocarAfuera)
    document.addEventListener('keydown', alEscape)
    return () => {
      document.removeEventListener('mousedown', alTocarAfuera)
      document.removeEventListener('keydown', alEscape)
    }
  }, [abierto])

  const inicial = (user?.email ?? '?').charAt(0).toUpperCase()

  return (
    <div ref={cont} className="relative shrink-0">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-[rgb(6,26,18)] transition-transform hover:scale-105"
        style={{
          background:
            'linear-gradient(145deg, rgb(var(--color-accent)), rgb(var(--pastel-aqua)))',
          boxShadow: '0 4px 16px -4px rgb(var(--color-accent) / 0.5)'
        }}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Perfil y configuración"
      >
        {inicial}
      </button>

      {abierto && (
        <div
          role="menu"
          className="glass-strong absolute right-0 top-12 z-40 w-64 rounded-card p-3"
        >
          <p className="text-xs text-text-muted">Sesión iniciada como</p>
          <p className="mb-3 truncate text-sm">{user?.email}</p>

          <div className="border-t border-white/[0.07] pt-2">
            <button
              onClick={() => {
                setAbierto(false)
                signOut()
              }}
              className="w-full rounded-lg px-2 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
              role="menuitem"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
