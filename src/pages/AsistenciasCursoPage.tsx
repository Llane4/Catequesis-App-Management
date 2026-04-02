import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tituloFechaListaAsistencia } from '../lib/fechaLocal'

type CursoCabecera = {
  nombre: string
  nivel: string
  anio_academico: string
}

type ResumenDia = {
  fecha: string
  presentes: number
  ausentes: number
  justificados: number
}

function ChevronDerecha({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function resumenTexto(r: ResumenDia): string {
  const partes: string[] = []
  partes.push(`${r.presentes} Presentes`)
  if (r.ausentes > 0) partes.push(`${r.ausentes} Ausentes`)
  if (r.justificados > 0) partes.push(`${r.justificados} Justificados`)
  return partes.join(', ')
}

export function AsistenciasCursoPage() {
  const { cursoId } = useParams<{ cursoId: string }>()
  const [cabecera, setCabecera] = useState<CursoCabecera | null>(null)
  const [filas, setFilas] = useState<ResumenDia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (!cursoId?.trim()) return

      setCargando(true)
      setError(null)
      setCabecera(null)
      setFilas([])

      const [resCurso, resAsis] = await Promise.all([
        supabase
          .from('cursos')
          .select('nombre, nivel, anio_academico')
          .eq('id', cursoId)
          .maybeSingle(),
        supabase
          .from('asistencias')
          .select('fecha, estado')
          .eq('curso_id', cursoId),
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

      setCabecera(resCurso.data as CursoCabecera)

      if (resAsis.error) {
        setError(resAsis.error.message)
        setFilas([])
        setCargando(false)
        return
      }

      const porDia = new Map<string, { p: number; a: number; j: number }>()
      for (const row of resAsis.data ?? []) {
        const fechaVal = row.fecha as string
        const estado = row.estado as string
        if (!porDia.has(fechaVal)) {
          porDia.set(fechaVal, { p: 0, a: 0, j: 0 })
        }
        const acc = porDia.get(fechaVal)!
        if (estado === 'p') acc.p += 1
        else if (estado === 'a') acc.a += 1
        else if (estado === 'j') acc.j += 1
      }

      const ordenadas: ResumenDia[] = Array.from(porDia.entries())
        .map(([fecha, c]) => ({
          fecha,
          presentes: c.p,
          ausentes: c.a,
          justificados: c.j,
        }))
        .sort((x, y) => y.fecha.localeCompare(x.fecha))

      setFilas(ordenadas)
      setCargando(false)
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [cursoId])

  if (!cursoId?.trim()) {
    return <Navigate to="/dashboard" replace />
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-ink-muted">Cargando asistencias…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={`/cursos/${cursoId}/alumnos`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Volver al curso
        </Link>
      </div>

      {cabecera && (
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">Asistencias</h1>
          <p className="text-sm font-medium text-ink">{cabecera.nombre}</p>
          <p className="text-xs font-medium text-ink-muted">
            {cabecera.nivel} · {cabecera.anio_academico}
          </p>
        </header>
      )}

      {error && (
        <p className="text-sm font-medium text-red-800" role="alert">
          {error}
        </p>
      )}

      {filas.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-secondary px-5 py-8 text-center text-sm font-medium text-ink">
          Aún no hay registros de asistencia para este curso.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filas.map((r) => (
            <li key={r.fecha}>
              <Link
                to={`/cursos/${cursoId}/asistencias/${r.fecha}`}
                aria-label={`Ver ausencias del ${tituloFechaListaAsistencia(r.fecha)}`}
                className="flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl border border-ink/12 bg-secondary/40 px-4 py-3 shadow-s transition hover:border-primary/35 hover:bg-[#c5ddcb]/25"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-ink">
                    {tituloFechaListaAsistencia(r.fecha)}
                  </p>
                  <p className="text-sm font-medium text-ink-muted">{resumenTexto(r)}</p>
                </div>
                <ChevronDerecha className="shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
