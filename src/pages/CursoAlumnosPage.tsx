import { Link, Navigate, useParams } from 'react-router-dom'
import { ListaAlumnos } from '../components/ListaAlumnos'

export function CursoAlumnosPage() {
  const { cursoId } = useParams<{ cursoId: string }>()

  if (!cursoId?.trim()) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          to="/dashboard"
          className="inline-flex min-h-10 items-center text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        >
          ← Volver a mis cursos
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Link
            to={`/cursos/${cursoId}/asistencias`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-primary/50 bg-secondary px-5 text-sm font-semibold text-ink shadow-s transition hover:border-primary hover:brightness-[0.99] active:brightness-[0.96]"
          >
            Ver asistencias
          </Link>
          <Link
            to={`/cursos/${cursoId}/asistencia`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94]"
          >
            Pasar asistencia hoy
          </Link>
        </div>
      </div>
      <ListaAlumnos cursoId={cursoId} />
    </div>
  )
}
