import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import TakuPeek from '@/components/taku/TakuPeek'
import type { EstadoTaku } from '@/components/taku/TakuProvider'

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

  // Mismo criterio que en el login: acá Taku acompaña un trámite que pone
  // nervioso a cualquiera, y su reacción es la señal más rápida de si salió.
  const estadoTaku: EstadoTaku = error
    ? 'alerta'
    : submitting
      ? 'pensando'
      : step === 'code'
        ? 'festejando'
        : 'idle'

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pb-10 pt-28 sm:pt-40">
      <div className="relative w-full max-w-sm">
        <TakuPeek estado={estadoTaku} />

        <div className="glass-strong relative z-10 rounded-card p-7">
          <p className="mb-1 text-xs tracking-[0.3em] text-text-muted">TAKU</p>
          <h1 className="text-xl font-bold mb-1">Recuperar cuenta</h1>
          <p className="text-sm text-text-secondary mb-6">
            {step === 'email'
              ? 'Te mandamos un código por mail para que puedas elegir una contraseña nueva.'
              : 'Pegá el código que te llegó y elegí tu contraseña nueva.'}
          </p>

          {step === 'email' ? (
            <form onSubmit={handleRequest} className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary mt-2"
              >
                {submitting ? 'Enviando...' : 'Enviarme el código'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="flex flex-col gap-3">
              {notice && <p className="text-sm text-accent-text">{notice}</p>}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Código</label>
                <input
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="field tracking-[0.3em]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Contraseña nueva</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field"
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary mt-2"
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
    </div>
  )
}
