import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { authUserFromSession } from '../services/authService'

export type AuthUser = {
  email: string
  userId: string
  /** Marcado en public.profesores.es_admin (tras ejecutar patch_admin_profesor.sql). */
  esAdmin: boolean
}

type AuthContextValue = {
  user: AuthUser | null
  /** true tras la primera lectura de sesión (evita parpadeos al refrescar). */
  authReady: boolean
  login: (user: AuthUser) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      const next = await authUserFromSession(session)
      if (!cancelled) {
        setUser(next)
        setAuthReady(true)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        const next = await authUserFromSession(session)
        if (!cancelled) setUser(next)
      })()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback((next: AuthUser) => {
    setUser(next)
  }, [])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, authReady, login, logout }),
    [user, authReady, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
