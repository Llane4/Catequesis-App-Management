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

export type AuthUser = {
  email: string
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
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email?.trim()
      setUser(email ? { email } : null)
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email?.trim()
      setUser(email ? { email } : null)
    })

    return () => subscription.unsubscribe()
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
