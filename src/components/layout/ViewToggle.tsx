import { NavLink } from 'react-router-dom'

const views = [
  { path: '/dia', label: 'Día' },
  { path: '/semana', label: 'Semana' },
  { path: '/mes', label: 'Mes' },
  { path: '/gastos', label: 'Gastos' }
]

export default function ViewToggle() {
  return (
    <div className="glass inline-flex rounded-pill p-1">
      {views.map((v) => (
        <NavLink
          key={v.path}
          to={v.path}
          className={({ isActive }) =>
            `rounded-pill px-3.5 py-1.5 text-sm whitespace-nowrap transition-all sm:px-4 ${
              isActive
                ? 'bg-white/10 font-semibold text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`
          }
        >
          {v.label}
        </NavLink>
      ))}
    </div>
  )
}
