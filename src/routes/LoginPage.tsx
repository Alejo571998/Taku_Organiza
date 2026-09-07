import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/dia" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    const action = mode === 'signin' ? signIn : signUp
    const { error } = await action(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    if (mode === 'signup') {
      setNotice('Cuenta creada. Si tu proyecto pide confirmación por email, revisá tu bandeja de entrada antes de iniciar sesión.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-card p-6">
        <h1 className="text-2xl font-bold tracking-tight">TAKU</h1>
        <p className="text-sm text-accent-text mb-5">Tu día, en orden.</p>
        <p className="text-sm text-text-secondary mb-6">
          {mode === 'signin' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-border px-3 py-2 text-sm bg-surface"
            />
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-border px-3 py-2 text-sm bg-surface"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-accent-text">{notice}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 bg-accent text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? 'Un momento...' : mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>
        {mode === 'signin' && (
          <Link to="/recuperar" className="mt-4 block text-sm text-accent-text underline">
            Me olvidé la contraseña
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
          className="mt-4 text-sm text-accent-text underline"
        >
          {mode === 'signin' ? '¿No tenés cuenta? Creá una' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </div>
    </div>
  )
}
