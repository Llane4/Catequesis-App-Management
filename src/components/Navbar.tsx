import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToggle } from '../hooks/useToggle'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/25 text-ink font-semibold'
      : 'text-ink hover:bg-secondary',
  ].join(' ')

export function Navbar() {
  const { user } = useAuth()
  const { on: menuOpen, toggle: toggleMenu, setFalse: closeMenu } =
    useToggle()

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, closeMenu])

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-3 sm:max-w-2xl md:max-w-5xl sm:px-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/"
            className="text-base font-semibold text-ink"
            onClick={closeMenu}
          >
            Catequesis
          </Link>
          {user?.esAdmin ? (
            <span className="hidden shrink-0 rounded-md bg-primary/20 px-2 py-0.5 text-xs font-semibold text-ink sm:inline">
              Admin
            </span>
          ) : null}
        </div>

        {/* Escritorio */}
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Principal"
        >
          <NavLink to="/" end className={navLinkClass}>
            Inicio
          </NavLink>
          <NavLink to="/dashboard" className={navLinkClass}>
            Cursos
          </NavLink>
          {user?.esAdmin ? (
            <NavLink to="/cursos/nuevo" className={navLinkClass}>
              Nuevo curso
            </NavLink>
          ) : null}
          <NavLink to="/alumnos" className={navLinkClass}>
            Alumnos
          </NavLink>
          <NavLink to="/alumnos/buscar" className={navLinkClass}>
            Buscar
          </NavLink>
          {user ? null : (
            <NavLink to="/login" className={navLinkClass}>
              Entrar
            </NavLink>
          )}
        </nav>

        {/* Móvil: botón menú */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink/15 text-ink md:hidden"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {menuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Panel móvil */}
      {menuOpen ? (
        <div
          id="mobile-menu"
          className="border-t border-ink/10 bg-background px-4 py-3 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Móvil">
            <NavLink to="/" end className={navLinkClass} onClick={closeMenu}>
              Inicio
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass} onClick={closeMenu}>
              Cursos
            </NavLink>
            {user?.esAdmin ? (
              <NavLink
                to="/cursos/nuevo"
                className={navLinkClass}
                onClick={closeMenu}
              >
                Nuevo curso
              </NavLink>
            ) : null}
            <NavLink to="/alumnos" className={navLinkClass} onClick={closeMenu}>
              Alumnos
            </NavLink>
            <NavLink
              to="/alumnos/buscar"
              className={navLinkClass}
              onClick={closeMenu}
            >
              Buscar
            </NavLink>
            {user ? null : (
              <NavLink
                to="/login"
                className={navLinkClass}
                onClick={closeMenu}
              >
                Entrar
              </NavLink>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
