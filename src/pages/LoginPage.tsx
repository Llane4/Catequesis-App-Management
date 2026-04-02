import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signIn } from '../services/authService'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await signIn(email, password)
      login(user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold text-ink">
          Iniciar sesión
        </h1>
        <p className="mt-1 text-center text-sm font-medium text-ink-muted">
          Acceso a la plataforma de catequesis
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-ink/[0.1] bg-secondary p-6 shadow-s"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-ink"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/20 bg-background px-3 py-2.5 text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-ink"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/20 bg-background px-3 py-2.5 text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
          </div>

          {error ? (
            <p className="text-sm font-medium text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-ink transition hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
