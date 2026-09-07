import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

/**
 * Menú de perfil. Reemplaza a la barra lateral: ahora que las pestañas viven
 * al pie, lo único que quedaba ahí era la cuenta, y una columna entera para
 * eso se comía el ancho de la app (en el celular, el 60% de la pantalla).
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
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Perfil y configuración"
      >
        {inicial}
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-60 rounded-card border border-border bg-surface p-3 shadow-lg"
        >
          <p className="text-xs text-text-muted">Sesión iniciada como</p>
          <p className="mb-3 truncate text-sm">{user?.email}</p>

          <div className="border-t border-border pt-2">
            <button
              onClick={() => {
                setAbierto(false)
                signOut()
              }}
              className="w-full rounded px-2 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-alt hover:text-text-primary"
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
