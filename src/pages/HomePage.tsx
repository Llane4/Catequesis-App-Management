import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Bienvenida</h1>
      <p className="max-w-xl text-base font-medium leading-relaxed text-ink">
        Vista principal dentro del layout con barra de navegación. Desde aquí
        podrás enlazar módulos de la catequesis.
      </p>
      {user ? (
        <p className="text-sm font-medium text-ink">
          Sesión: <span className="font-semibold">{user.email}</span>
          <button
            type="button"
            onClick={logout}
            className="ml-3 text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-2 hover:decoration-primary"
          >
            Cerrar sesión
          </button>
        </p>
      ) : (
        <p className="text-sm font-medium text-ink">
          <Link
            to="/login"
            className="font-semibold underline decoration-primary/70 underline-offset-2 hover:decoration-primary"
          >
            Iniciar sesión
          </Link>
        </p>
      )}
    </div>
  )
}
