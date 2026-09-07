import { Outlet } from 'react-router-dom'
import ViewToggle from './ViewToggle'
import TabBar from './TabBar'
import ProfileMenu from './ProfileMenu'
import Mascota from '@/components/ui/Mascota'

export default function AppLayout() {
  return (
    // pb-14 reserva el alto de la barra de pestañas, que es fixed y si no
    // taparía el final del contenido.
    <div className="min-h-screen pb-14">
      <header className="flex items-center gap-3 px-4 pt-4 lg:px-6">
        <p className="hidden shrink-0 text-lg font-bold leading-none tracking-tight sm:block">
          TAKU
        </p>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <ViewToggle />
        </div>
        <ProfileMenu />
      </header>

      {/* min-w-0 permite que la grilla del mes se encoja en vez de desbordar
          el viewport: sin él, un hijo ancho fuerza el ancho del contenedor. */}
      <main className="min-w-0 px-4 pb-6 pt-5 lg:px-6">
        <Outlet />
      </main>

      <TabBar />
      <Mascota />
    </div>
  )
}
