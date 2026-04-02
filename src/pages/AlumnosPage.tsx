import { Link } from 'react-router-dom'
import { ListaAlumnos } from '../components/ListaAlumnos'

export function AlumnosPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink">
          Alumnos
        </h1>
        <Link
          to="/alumnos/nuevo"
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94]"
        >
          Nuevo alumno
        </Link>
      </div>
      <ListaAlumnos />
    </div>
  )
}
