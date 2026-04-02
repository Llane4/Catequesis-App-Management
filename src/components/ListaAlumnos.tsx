import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type AlumnoFila = {
  id: string
  nombre: string
  apellido: string
  dni: string
  abandono: boolean
}

type CursoCabecera = {
  nombre: string
  nivel: string
  anio_academico: string
}

type ListaAlumnosProps = {
  cursoId?: string
}

export function ListaAlumnos({ cursoId }: ListaAlumnosProps) {
  const [alumnos, setAlumnos] = useState<AlumnoFila[]>([])
  const [cursoCabecera, setCursoCabecera] = useState<CursoCabecera | null>(
    null,
  )
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      setCursoCabecera(null)

      if (cursoId) {
        const [resAlumnos, resCurso] = await Promise.all([
          supabase
            .from('alumnos')
            .select('id, nombre, apellido, dni, abandono')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true })
            .order('nombre', { ascending: true }),
          supabase
            .from('cursos')
            .select('nombre, nivel, anio_academico')
            .eq('id', cursoId)
            .maybeSingle(),
        ])

        if (cancelado) return

        if (resCurso.error) {
          setError(resCurso.error.message)
          setAlumnos([])
          setCargando(false)
          return
        }

        if (!resCurso.data) {
          setError(
            'No se encontró el curso o no tienes permiso para verlo.',
          )
          setAlumnos([])
          setCargando(false)
          return
        }

        if (resAlumnos.error) {
          setError(resAlumnos.error.message)
          setAlumnos([])
        } else {
          setAlumnos((resAlumnos.data ?? []) as AlumnoFila[])
          setCursoCabecera(resCurso.data as CursoCabecera)
        }
      } else {
        const { data, error: errConsulta } = await supabase
          .from('alumnos')
          .select('id, nombre, apellido, dni, abandono')
          .order('apellido', { ascending: true })
          .order('nombre', { ascending: true })

        if (cancelado) return

        if (errConsulta) {
          setError(errConsulta.message)
          setAlumnos([])
        } else {
          setAlumnos((data ?? []) as AlumnoFila[])
        }
      }

      setCargando(false)
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [cursoId])

  if (cargando) {
    return (
      <p className="text-sm font-medium text-ink-muted">Cargando alumnos…</p>
    )
  }

  if (error) {
    return (
      <p className="text-sm font-medium text-red-800" role="alert">
        No se pudieron cargar los datos: {error}
      </p>
    )
  }

  const cabeceraCurso =
    cursoId && cursoCabecera ? (
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">
          {cursoCabecera.nombre}
        </h1>
        <p className="text-sm font-medium text-ink">
          <span className="font-semibold text-ink">Nivel:</span>{' '}
          {cursoCabecera.nivel}
          {' · '}
          <span className="font-semibold text-ink">Curso académico:</span>{' '}
          {cursoCabecera.anio_academico}
        </p>
        <h2 className="pt-4 text-lg font-semibold text-ink">
          Alumnos
        </h2>
      </div>
    ) : null

  return (
    <div className="space-y-4">
      {cabeceraCurso}
      <div className="overflow-x-auto rounded-xl border border-ink/[0.1] bg-secondary shadow-s">
        <table className="min-w-full divide-y divide-ink/10 text-left text-sm">
          <thead className="bg-background/70">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 font-semibold text-ink"
              >
                Nombre
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-semibold text-ink"
              >
                Apellidos
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-semibold text-ink"
              >
                DNI
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-semibold text-ink"
              >
                Estado
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-ink"
              >
                Ficha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {alumnos.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm font-medium text-ink-muted"
                >
                  No hay alumnos registrados.
                </td>
              </tr>
            ) : (
              alumnos.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-background/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                    {a.nombre}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {a.apellido}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums font-medium text-ink">
                    {a.dni}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-ink">
                    {a.abandono ? (
                      <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                        Abandonó
                      </span>
                    ) : (
                      <span className="text-ink-muted">Activo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/alumnos/${a.id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
