import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export default function RequireAuth() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="p-6 text-sm text-text-secondary">Cargando...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
