import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { fechaLocalISO } from '../lib/fechaLocal'
import { supabase } from '../lib/supabase'

type AlumnoFila = {
  id: string
  nombre: string
  apellido: string
  abandono: boolean
}

type CursoCabecera = {
  nombre: string
  nivel: string
  anio_academico: string
}

export function PasarAsistencia() {
  const { cursoId } = useParams<{ cursoId: string }>()
  const [alumnos, setAlumnos] = useState<AlumnoFila[]>([])
  const [presentePorId, setPresentePorId] = useState<Record<string, boolean>>({})
  const [cursoCabecera, setCursoCabecera] = useState<CursoCabecera | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const fechaHoy = useMemo(() => fechaLocalISO(), [])

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (!cursoId?.trim()) return

      setCargando(true)
      setError(null)
      setExito(null)
      setCursoCabecera(null)
      setPresentePorId({})

      const [resAlumnos, resCurso] = await Promise.all([
        supabase
          .from('alumnos')
          .select('id, nombre, apellido, abandono')
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
        setError('No se encontró el curso o no tienes permiso para verlo.')
        setAlumnos([])
        setCargando(false)
        return
      }

      if (resAlumnos.error) {
        setError(resAlumnos.error.message)
        setAlumnos([])
      } else {
        const lista = (resAlumnos.data ?? []) as AlumnoFila[]
        setAlumnos(lista)
        const inicial: Record<string, boolean> = {}
        for (const a of lista) inicial[a.id] = true
        setPresentePorId(inicial)
        setCursoCabecera(resCurso.data as CursoCabecera)
      }

      setCargando(false)
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [cursoId])

  const togglePresente = useCallback((alumnoId: string) => {
    setPresentePorId((prev) => ({
      ...prev,
      [alumnoId]: !prev[alumnoId],
    }))
    setExito(null)
  }, [])

  const finalizar = useCallback(async () => {
    if (!cursoId?.trim() || alumnos.length === 0 || guardando) return

    setGuardando(true)
    setError(null)
    setExito(null)

    const filas = alumnos.map((a) => ({
      alumno_id: a.id,
      curso_id: cursoId,
      fecha: fechaHoy,
      estado: (presentePorId[a.id] !== false ? 'p' : 'a') as 'p' | 'a',
    }))

    const { error: errUpsert } = await supabase
      .from('asistencias')
      .upsert(filas, { onConflict: 'alumno_id,fecha' })

    setGuardando(false)

    if (errUpsert) {
      setError(errUpsert.message)
      return
    }

    setExito('Asistencia guardada correctamente.')
  }, [alumnos, cursoId, fechaHoy, guardando, presentePorId])

  if (!cursoId?.trim()) {
    return <Navigate to="/dashboard" replace />
  }

  if (cargando) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-2">
        <p className="text-sm font-medium text-ink-muted">Cargando alumnos…</p>
      </div>
    )
  }

  return (
    <div
      className={`mx-auto flex min-h-0 max-w-lg flex-col px-4 pt-2 ${exito ? 'pb-48' : 'pb-36'}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          to={`/cursos/${cursoId}/alumnos`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Volver al curso
        </Link>
      </div>

      {cursoCabecera && (
        <header className="mb-5 space-y-1">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">
            Pasar asistencia
          </h1>
          <p className="text-sm font-medium text-ink">{cursoCabecera.nombre}</p>
          <p className="text-xs font-medium text-ink-muted">
            {cursoCabecera.nivel} · {cursoCabecera.anio_academico} · Hoy:{' '}
            {new Date(fechaHoy + 'T12:00:00').toLocaleDateString('es', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </header>
      )}

      {error && (
        <p className="mb-4 text-sm font-medium text-red-800" role="alert">
          {error}
        </p>
      )}

      {alumnos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-secondary px-5 py-8 text-center text-sm font-medium text-ink">
          No hay alumnos en este curso.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alumnos.map((a) => {
            const presente = presentePorId[a.id] !== false
            return (
              <li key={a.id}>
                <article
                  className={`flex min-h-[3.5rem] items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-s transition-colors ${
                    presente
                      ? 'border-primary/35 bg-[#c5ddcb]/50'
                      : 'border-stone-400/35 bg-stone-400/20'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ink">
                      {a.apellido}, {a.nombre}
                    </p>
                    <p className="text-xs font-medium text-ink-muted">
                      {presente ? 'Presente' : 'Ausente'}
                      {a.abandono ? ' · Abandonó' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={presente}
                    aria-label={`${presente ? 'Presente' : 'Ausente'}: ${a.apellido}, ${a.nombre}`}
                    onClick={() => togglePresente(a.id)}
                    className={`relative h-9 w-[3.25rem] shrink-0 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      presente
                        ? 'border-primary/60 bg-primary/40'
                        : 'border-stone-500/50 bg-stone-300/80'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-7 rounded-full bg-secondary shadow-s transition-transform ${
                        presente ? 'left-0.5 translate-x-[1.35rem]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-ink/10 bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto max-w-lg space-y-3">
          {exito && (
            <p
              className="rounded-xl border border-primary/40 bg-primary/15 px-4 py-3 text-center text-sm font-medium text-ink"
              role="status"
            >
              {exito}
            </p>
          )}
          <button
            type="button"
            disabled={alumnos.length === 0 || guardando}
            onClick={() => void finalizar()}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-ink shadow-s transition enabled:hover:brightness-[0.97] enabled:active:brightness-[0.94] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Finalizar asistencia'}
          </button>
        </div>
      </div>
    </div>
  )
}
