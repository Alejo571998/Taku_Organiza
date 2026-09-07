import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export default function RecoverPage() {
  const { user, requestPasswordReset, confirmPasswordReset } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/dia" replace />

  async function handleRequest(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await requestPasswordReset(email.trim())
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    // Supabase responde igual exista o no la cuenta, para que nadie pueda
    // averiguar qué mails están registrados. Por eso el mensaje es ambiguo.
    setNotice('Si ese mail tiene cuenta, te llegó un código de 6 dígitos. Revisá también el spam.')
    setStep('code')
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await confirmPasswordReset(email.trim(), code, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate('/dia', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-card p-6">
        <p className="text-xs text-text-muted tracking-widest mb-1">TAKU</p>
        <h1 className="text-xl font-bold mb-1">Recuperar cuenta</h1>
        <p className="text-sm text-text-secondary mb-6">
          {step === 'email'
            ? 'Te mandamos un código por mail para que puedas elegir una contraseña nueva.'
            : 'Pegá el código que te llegó y elegí tu contraseña nueva.'}
        </p>

        {step === 'email' ? (
          <form onSubmit={handleRequest} className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-border px-3 py-2 text-sm bg-surface"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 bg-accent text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? 'Enviando...' : 'Enviarme el código'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="flex flex-col gap-3">
            {notice && <p className="text-sm text-accent-text">{notice}</p>}
            <div>
              <label className="text-sm text-text-secondary block mb-1">Código</label>
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded border border-border px-3 py-2 text-sm bg-surface tracking-widest"
              />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Contraseña nueva</label>
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
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 bg-accent text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : 'Cambiar contraseña y entrar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setError(null)
                setNotice(null)
                setCode('')
              }}
              className="text-sm text-text-secondary underline"
            >
              Usar otro mail o pedir el código de nuevo
            </button>
          </form>
        )}

        <Link to="/login" className="mt-4 block text-sm text-accent-text underline">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
