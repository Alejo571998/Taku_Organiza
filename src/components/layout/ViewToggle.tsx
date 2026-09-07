import { NavLink } from 'react-router-dom'

const views = [
  { path: '/dia', label: 'Día' },
  { path: '/semana', label: 'Semana' },
  { path: '/mes', label: 'Mes' },
  { path: '/gastos', label: 'Gastos' }
]

export default function ViewToggle() {
  return (
    <div className="inline-flex bg-surface-alt rounded p-1 mb-6">
      {views.map((v) => (
        <NavLink
          key={v.path}
          to={v.path}
          className={({ isActive }) =>
            `px-4 py-1.5 text-sm rounded transition-colors ${
              isActive ? 'bg-surface text-text-primary font-medium' : 'text-text-secondary'
            }`
          }
        >
          {v.label}
        </NavLink>
      ))}
    </div>
  )
}
