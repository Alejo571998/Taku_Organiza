import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Manda el mail con el código de recuperación. */
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  /** Valida el código y deja la contraseña nueva. */
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    // El finally es importante: si getSession falla (sin red, por ejemplo)
    // sin él loading queda en true para siempre y la app se cuelga en
    // "Cargando..." sin manera de salir.
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false))

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      // Sin esto, la caché de React Query sigue teniendo las pestañas del
      // usuario anterior y se ven por un instante si alguien más inicia
      // sesión en el mismo navegador.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })

    return () => listener.subscription.unsubscribe()
  }, [queryClient])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error?.message ?? null }
  }

  async function confirmPasswordReset(email: string, code: string, newPassword: string) {
    // verifyOtp valida el código y de paso abre sesión, que es lo que después
    // habilita el updateUser. Si se hiciera al revés no habría sesión con la
    // cual autorizar el cambio de contraseña.
    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'recovery'
    })
    if (otpError) return { error: otpError.message }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    return { error: updateError?.message ?? null }
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        confirmPasswordReset
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
