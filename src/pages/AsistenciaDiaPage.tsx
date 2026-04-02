import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tituloFechaListaAsistencia } from '../lib/fechaLocal'

type EstadoDia = 'p' | 'a' | 'j' | null

type FilaAlumnoDia = {
  id: string
  nombre: string
  apellido: string
  estado: EstadoDia
}

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/

function clasesTarjeta(estado: EstadoDia): string {
  const base =
    'rounded-2xl border px-4 py-3 shadow-s transition-colors'
  switch (estado) {
    case 'p':
      return `${base} border-primary/35 bg-[#c5ddcb]/50`
    case 'a':
      return `${base} border-stone-400/35 bg-stone-400/20`
    case 'j':
      return `${base} border-amber-500/40 bg-amber-100/55 dark:border-amber-400/35 dark:bg-amber-950/35`
    default:
      return `${base} border-dashed border-ink/20 bg-secondary/50`
  }
}

function etiquetaEstado(estado: EstadoDia): string {
  switch (estado) {
    case 'p':
      return 'Presente'
    case 'a':
      return 'Ausente'
    case 'j':
      return 'Justificado'
    default:
      return 'Sin registro'
  }
}

export function AsistenciaDiaPage() {
  const { cursoId, fecha } = useParams<{ cursoId: string; fecha: string }>()
  const [cursoNombre, setCursoNombre] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaAlumnoDia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fechaValida = fecha && ISO_FECHA.test(fecha)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (!cursoId?.trim() || !fechaValida) return

      setCargando(true)
      setError(null)
      setCursoNombre(null)
      setFilas([])

      const [resCurso, resAlumnos, resAsis] = await Promise.all([
        supabase.from('cursos').select('nombre').eq('id', cursoId).maybeSingle(),
        supabase
          .from('alumnos')
          .select('id, nombre, apellido')
          .eq('curso_id', cursoId)
          .order('apellido', { ascending: true })
          .order('nombre', { ascending: true }),
        supabase
          .from('asistencias')
          .select('alumno_id, estado')
          .eq('curso_id', cursoId)
          .eq('fecha', fecha!),
      ])

      if (cancelado) return

      if (resCurso.error) {
        setError(resCurso.error.message)
        setCargando(false)
        return
      }

      if (!resCurso.data) {
        setError('No se encontró el curso o no tienes permiso para verlo.')
        setCargando(false)
        return
      }

      setCursoNombre((resCurso.data as { nombre: string }).nombre)

      if (resAlumnos.error) {
        setError(resAlumnos.error.message)
        setFilas([])
        setCargando(false)
        return
      }

      if (resAsis.error) {
        setError(resAsis.error.message)
        setFilas([])
        setCargando(false)
        return
      }

      const porAlumno = new Map<string, 'p' | 'a' | 'j'>()
      for (const row of resAsis.data ?? []) {
        const aid = row.alumno_id as string
        const e = row.estado as string
        if (e === 'p' || e === 'a' || e === 'j') porAlumno.set(aid, e)
      }

      const lista: FilaAlumnoDia[] = (resAlumnos.data ?? []).map((a) => ({
        id: a.id as string,
        nombre: a.nombre as string,
        apellido: a.apellido as string,
        estado: porAlumno.get(a.id as string) ?? null,
      }))

      setFilas(lista)
      setCargando(false)
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [cursoId, fecha, fechaValida])

  if (!cursoId?.trim()) {
    return <Navigate to="/dashboard" replace />
  }

  if (!fechaValida) {
    return <Navigate to={`/cursos/${cursoId}/asistencias`} replace />
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-ink-muted">Cargando…</p>
      </div>
    )
  }

  const tituloDia = tituloFechaListaAsistencia(fecha!)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={`/cursos/${cursoId}/asistencias`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Todas las asistencias
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{tituloDia}</h1>
        {cursoNombre && (
          <p className="text-sm font-medium text-ink-muted">{cursoNombre}</p>
        )}
        <p className="text-sm font-medium text-ink-muted">
          Cada color indica el estado de asistencia de ese día.
        </p>
      </header>

      {error && (
        <p className="text-sm font-medium text-red-800" role="alert">
          {error}
        </p>
      )}

      {filas.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-secondary px-5 py-8 text-center text-sm font-medium text-ink">
          No hay alumnos en este curso.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filas.map((f) => (
            <li key={f.id}>
              <article className={clasesTarjeta(f.estado)}>
                <p className="text-base font-semibold text-ink">
                  {f.apellido}, {f.nombre}
                </p>
                <p className="text-xs font-medium text-ink-muted">
                  {etiquetaEstado(f.estado)}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
