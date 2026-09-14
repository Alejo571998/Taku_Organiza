import { Outlet } from 'react-router-dom'
import ViewToggle from './ViewToggle'
import TabBar from './TabBar'
import ProfileMenu from './ProfileMenu'
import Mascota from '@/components/ui/Mascota'

export default function AppLayout() {
  return (
    // pb-16 reserva el alto de la barra de pestañas, que es fixed y si no
    // taparía el final del contenido.
    <div className="min-h-screen pb-16">
      <header className="flex items-center gap-3 px-4 pt-4 sm:px-5 lg:px-8">
        <p className="hidden shrink-0 text-lg font-bold leading-none tracking-tight sm:block">
          TAKU
        </p>
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ViewToggle />
        </div>
        <ProfileMenu />
      </header>

      {/* min-w-0 permite que la grilla del mes se encoja en vez de desbordar
          el viewport: sin él, un hijo ancho fuerza el ancho del contenedor. */}
      <main className="mx-auto min-w-0 max-w-6xl px-4 pb-8 pt-6 sm:px-5 lg:px-8">
        <Outlet />
      </main>

      <TabBar />
      <Mascota />
    </div>
  )
}
