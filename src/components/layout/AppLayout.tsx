import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import ViewToggle from './ViewToggle'
import Mascota from '@/components/ui/Mascota'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Cerrar el cajón al navegar: en el celular queda tapando toda la pantalla
  // y obligar a cerrarlo a mano después de cada toque es insufrible.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  return (
    <div className="flex min-h-screen">
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* En lg+ es una columna más del flex; abajo de eso es un cajón fijo
          que entra deslizándose. */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 lg:static lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>

      {/* min-w-0 es lo que permite que la grilla del mes se encoja en vez de
          desbordar el viewport: sin él, un hijo con contenido ancho fuerza
          el ancho del flex item. */}
      <main className="flex-1 min-w-0 p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setMenuOpen(true)}
            className="lg:hidden border border-border rounded p-1.5 shrink-0"
            aria-label="Abrir pestañas"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <ViewToggle />
        </div>
        <Outlet />
      </main>

      <Mascota />
    </div>
  )
}
