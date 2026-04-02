import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoginPage } from '../pages/LoginPage'

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <p className="text-sm font-medium text-ink-muted">Cargando sesión…</p>
    </div>
  )
}

/** Solo rutas internas: redirige a /login si no hay usuario. */
export function RequireAuth() {
  const { user, authReady } = useAuth()

  if (!authReady) {
    return <AuthLoadingScreen />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

/** Pantalla de login: si ya hay sesión, va al inicio. */
export function LoginRoute() {
  const { user, authReady } = useAuth()

  if (!authReady) {
    return <AuthLoadingScreen />
  }
  if (user) {
    return <Navigate to="/" replace />
  }
  return <LoginPage />
}

/** Rutas desconocidas: inicio si hay sesión, login si no. */
export function DefaultRedirect() {
  const { user, authReady } = useAuth()

  if (!authReady) {
    return <AuthLoadingScreen />
  }
  return <Navigate to={user ? '/' : '/login'} replace />
}
