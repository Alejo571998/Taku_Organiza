import { NavLink } from 'react-router-dom'
import { SECCIONES } from './secciones'

/**
 * Barra lateral, solo en escritorio.
 *
 * En el celular no existe: una lateral fija se come un tercio de una pantalla
 * de 390px, y ahí la navegación ya la resuelven las píldoras de arriba y la
 * barra de pestañas de abajo. Son dos formas de la misma lista, no dos
 * navegaciones distintas: SECCIONES es una sola.
 */
export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-white/[0.07] px-3 py-5 lg:flex"
      style={{ background: 'rgb(5 8 18 / 0.5)', backdropFilter: 'blur(20px)' }}
    >
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <img src="/taku.png" srcSet="/taku.png 256w, /taku-384.png 384w" sizes="36px" alt="" aria-hidden="true" className="h-9 w-9 select-none object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-none tracking-tight">TAKU</p>
          <p className="mt-0.5 truncate text-[11px] leading-none text-text-muted">
            Tu día, en orden.
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {SECCIONES.map((s) => (
          <NavLink
            key={s.path}
            to={s.path}
            end={s.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-white/[0.08] font-semibold text-text-primary'
                  : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
              }`
            }
          >
            <span aria-hidden="true" className="shrink-0 text-base leading-none">
              {s.icono}
            </span>
            {s.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
