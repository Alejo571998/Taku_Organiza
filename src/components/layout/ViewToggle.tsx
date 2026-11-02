import { NavLink } from 'react-router-dom'
import { SECCIONES } from './secciones'

/**
 * Las secciones como píldoras, para celular y tablet.
 *
 * En escritorio desaparece: ahí la misma lista la muestra la barra lateral, y
 * tener las dos sería decir lo mismo dos veces en la misma pantalla.
 */
export default function ViewToggle() {
  return (
    <div className="glass inline-flex rounded-pill p-1 lg:hidden">
      {SECCIONES.map((s) => (
        <NavLink
          key={s.path}
          to={s.path}
          end={s.path === '/'}
          className={({ isActive }) =>
            `rounded-pill px-3.5 py-1.5 text-sm whitespace-nowrap transition-all ${
              isActive
                ? 'bg-white/10 font-semibold text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`
          }
        >
          {s.corto ?? s.label}
        </NavLink>
      ))}
    </div>
  )
}
