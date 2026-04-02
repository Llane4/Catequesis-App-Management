import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type CursoFila = {
  id: string
  nombre: string
  nivel: string
  anio_academico: string
  alumnos?: { count: number }[] | null
}

function conteoAlumnosDesdeCurso(curso: CursoFila): number {
  const emb = curso.alumnos
  if (!emb) return 0
  if (Array.isArray(emb)) {
    const c = emb[0]?.count
    return typeof c === 'number' ? c : 0
  }
  return 0
}

type CursoProfesorFila = {
  id: string
  cursos: CursoFila | CursoFila[] | null
}

function cursoDesdeFila(
  c: CursoFila | CursoFila[] | null,
): CursoFila | null {
  if (!c) return null
  return Array.isArray(c) ? (c[0] ?? null) : c
}

export function DashboardPage() {
  const { user, authReady } = useAuth()
  const [filas, setFilas] = useState<CursoProfesorFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (!authReady || !user) {
        setFilas([])
        setCargando(false)
        setError(null)
        return
      }

      setCargando(true)
      setError(null)

      const { data, error: errConsulta } = await supabase
        .from('curso_profesor')
        .select('id, cursos(id, nombre, nivel, anio_academico, alumnos(count))')
        .order('id', { ascending: true })

      if (cancelado) return

      if (errConsulta) {
        setError(errConsulta.message)
        setFilas([])
      } else {
        setFilas((data ?? []) as unknown as CursoProfesorFila[])
      }
      setCargando(false)
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [authReady, user])

  if (!authReady) {
    return (
      <p className="text-sm font-medium text-ink">Comprobando sesión…</p>
    )
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Mis cursos</h1>
        <p className="text-base font-medium leading-relaxed text-ink">
          Inicia sesión para ver los cursos asignados a tu cuenta.
        </p>
        <Link
          to="/login"
          className="inline-flex min-h-11 min-w-[11rem] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94]"
        >
          Iniciar sesión
        </Link>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Mis cursos</h1>
        <p className="text-sm font-medium text-ink">Cargando cursos…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Mis cursos</h1>
        <p className="text-sm font-medium text-red-800" role="alert">
          No se pudieron cargar los datos: {error}
        </p>
      </div>
    )
  }

  const cursosOrdenados = [...filas]
    .map((f) => {
      const curso = cursoDesdeFila(f.cursos)
      return curso ? { asignacionId: f.id, curso } : null
    })
    .filter((x): x is { asignacionId: string; curso: CursoFila } => x !== null)
    .sort((a, b) =>
      (a.curso.nombre + a.curso.nivel).localeCompare(
        b.curso.nombre + b.curso.nivel,
        'es',
        { sensitivity: 'base' },
      ),
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Mis cursos</h1>
        <p className="mt-1 text-base font-medium leading-relaxed text-ink">
          Cursos donde figuras como profesor.
        </p>
      </div>

      {cursosOrdenados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-secondary px-5 py-8 text-center text-base font-medium text-ink">
          No tienes cursos asignados. Si es un error, contacta con
          administración.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {cursosOrdenados.map(({ asignacionId, curso }) => {
            const nAlumnos = conteoAlumnosDesdeCurso(curso)
            const textoAlumnos =
              nAlumnos === 1 ? '1 alumno' : `${nAlumnos} alumnos`
            return (
            <li key={asignacionId}>
              <Link
                to={`/cursos/${curso.id}/alumnos`}
                className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <article className="flex min-h-[7.5rem] cursor-pointer flex-col justify-center rounded-2xl border border-ink/[0.1] bg-secondary p-6 shadow-s transition hover:border-primary/40 hover:shadow-md active:scale-[0.99] active:brightness-[0.98] md:min-h-[8.5rem]">
                  <h2 className="text-xl font-semibold leading-snug text-ink">
                    {curso.nombre}
                  </h2>
                  <p className="mt-3 text-base text-ink leading-relaxed">
                    <span className="font-semibold text-ink">Alumnos:</span>{' '}
                    {textoAlumnos}
                  </p>
                  <p className="mt-1 text-base text-ink leading-relaxed">
                    <span className="font-semibold text-ink">Nivel:</span>{' '}
                    {curso.nivel}
                  </p>
                  <p className="mt-1 text-base text-ink leading-relaxed">
                    <span className="font-semibold text-ink">Curso académico:</span>{' '}
                    {curso.anio_academico}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-2">
                    Ver alumnos del curso →
                  </p>
                </article>
              </Link>
            </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
