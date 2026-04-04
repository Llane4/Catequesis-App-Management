import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

function textoErrorRpc(err: PostgrestError): string {
  const partes = [err.message?.trim(), err.details?.trim(), err.hint?.trim()].filter(
    Boolean,
  )
  const textoBase = partes.length > 0 ? partes.join(' — ') : 'Error al promocionar.'
  const m = (err.message ?? '').toLowerCase()
  const denegado =
    err.code === '42501' ||
    m.includes('row-level security') ||
    m.includes('permission denied') ||
    m.includes('rls')
  if (denegado) {
    return `${textoBase} Si el error persiste, ejecuta en Supabase el script sql/patch_promocion_alumnos_rpc.sql.`
  }
  return textoBase
}

export function PromocionarAlumnosPage() {
  const { cursoId } = useParams<{ cursoId: string }>()
  const navigate = useNavigate()
  const { user, authReady } = useAuth()
  const [alumnos, setAlumnos] = useState<AlumnoFila[]>([])
  const [cursoCabecera, setCursoCabecera] = useState<CursoCabecera | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set())
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [nivelNuevo, setNivelNuevo] = useState('')
  const [anioNuevo, setAnioNuevo] = useState('')
  const [erroresCampos, setErroresCampos] = useState<{
    nombre?: string
    nivel?: string
    anio?: string
    alumnos?: string
  }>({})
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  const activos = useMemo(() => alumnos.filter((a) => !a.abandono), [alumnos])

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (!cursoId?.trim()) return
      setCargando(true)
      setErrorCarga(null)
      setCursoCabecera(null)

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
        setErrorCarga(resCurso.error.message)
        setAlumnos([])
        setCargando(false)
        return
      }

      if (!resCurso.data) {
        setErrorCarga('No se encontró el curso o no tienes permiso para verlo.')
        setAlumnos([])
        setCargando(false)
        return
      }

      if (resAlumnos.error) {
        setErrorCarga(resAlumnos.error.message)
        setAlumnos([])
      } else {
        setAlumnos((resAlumnos.data ?? []) as AlumnoFila[])
        setCursoCabecera(resCurso.data as CursoCabecera)
        setNivelNuevo((resCurso.data as CursoCabecera).nivel ?? '')
        setAnioNuevo((resCurso.data as CursoCabecera).anio_academico ?? '')
      }
      setCargando(false)
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [cursoId])

  function toggleId(id: string) {
    setElegidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarSoloActivos() {
    setElegidos(new Set(activos.map((a) => a.id)))
  }

  function limpiarSeleccion() {
    setElegidos(new Set())
  }

  function validarFormulario(): boolean {
    const next: typeof erroresCampos = {}
    if (!nombreNuevo.trim()) next.nombre = 'El nombre del curso nuevo es obligatorio.'
    if (!nivelNuevo.trim()) next.nivel = 'El nivel es obligatorio.'
    if (!anioNuevo.trim()) next.anio = 'Indica el curso académico (ej. 2025-2026).'
    if (elegidos.size === 0) next.alumnos = 'Selecciona al menos un alumno para promocionar.'
    setErroresCampos(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMensaje(null)
    if (!cursoId?.trim() || !user) return
    if (!validarFormulario()) return

    const ids = [...elegidos]
    setEnviando(true)
    const { data, error } = await supabase.rpc('promocionar_alumnos_a_nuevo_curso', {
      p_curso_origen_id: cursoId,
      p_nombre: nombreNuevo.trim(),
      p_nivel: nivelNuevo.trim(),
      p_anio_academico: anioNuevo.trim(),
      p_alumno_ids: ids,
    })
    setEnviando(false)

    if (error) {
      setMensaje({ tipo: 'err', texto: textoErrorRpc(error) })
      return
    }

    const payload = data as { curso_id?: string; alumnos_movidos?: number } | null
    const movidos = payload?.alumnos_movidos ?? 0
    const nuevoCursoId = payload?.curso_id

    if (movidos !== ids.length) {
      setMensaje({
        tipo: 'err',
        texto: `Solo se movieron ${movidos} de ${ids.length} alumnos. Es posible que algunos ya no estuvieran en este curso; recarga la página e inténtalo de nuevo.`,
      })
      return
    }

    if (nuevoCursoId) {
      navigate(`/cursos/${nuevoCursoId}/alumnos`, { replace: true })
      return
    }

    setMensaje({
      tipo: 'ok',
      texto: 'Promoción completada. Puedes abrir el nuevo curso desde el panel.',
    })
  }

  if (!cursoId?.trim()) {
    return <Navigate to="/dashboard" replace />
  }

  if (!authReady || !user) {
    return <p className="text-sm font-medium text-ink">Comprobando sesión…</p>
  }

  if (cargando) {
    return (
      <p className="text-sm font-medium text-ink-muted">Cargando datos del curso…</p>
    )
  }

  if (errorCarga || !cursoCabecera) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-red-800" role="alert">
          {errorCarga ?? 'No se pudo cargar el curso.'}
        </p>
        <Link
          to="/dashboard"
          className="inline-flex min-h-10 items-center text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        >
          ← Volver a mis cursos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          to={`/cursos/${cursoId}/alumnos`}
          className="inline-flex min-h-10 items-center text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        >
          ← Volver al listado de este curso
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-ink">Promocionar alumnos</h1>
        <p className="mt-1 text-base font-medium leading-relaxed text-ink">
          Curso actual:{' '}
          <span className="font-semibold">{cursoCabecera.nombre}</span> ({cursoCabecera.nivel},{' '}
          {cursoCabecera.anio_academico}). Elige a quiénes pasan a un curso nuevo del que serás
          profesor. Su historial registrará el cambio automáticamente.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-8 rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s md:p-6"
      >
        {mensaje ? (
          <p
            className={
              mensaje.tipo === 'ok'
                ? 'text-sm font-medium text-ink'
                : 'text-sm font-medium text-red-800'
            }
            role={mensaje.tipo === 'err' ? 'alert' : undefined}
          >
            {mensaje.texto}
          </p>
        ) : null}

        <div>
          <h2 className="text-lg font-semibold text-ink">Nuevo curso</h2>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Los datos del nivel y del año se rellenan con el curso actual; ajústalos si corresponde.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="promo-nombre" className="block text-sm font-medium text-ink">
                Nombre del nuevo curso <span className="text-red-700">*</span>
              </label>
              <input
                id="promo-nombre"
                name="nombre"
                autoComplete="off"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Ej. Primera comunión — grupo B"
                className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
              {erroresCampos.nombre ? (
                <p className="mt-1 text-sm font-medium text-red-800">{erroresCampos.nombre}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="promo-nivel" className="block text-sm font-medium text-ink">
                Nivel <span className="text-red-700">*</span>
              </label>
              <input
                id="promo-nivel"
                name="nivel"
                autoComplete="off"
                value={nivelNuevo}
                onChange={(e) => setNivelNuevo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
              {erroresCampos.nivel ? (
                <p className="mt-1 text-sm font-medium text-red-800">{erroresCampos.nivel}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="promo-anio" className="block text-sm font-medium text-ink">
                Curso académico <span className="text-red-700">*</span>
              </label>
              <input
                id="promo-anio"
                name="anio_academico"
                autoComplete="off"
                value={anioNuevo}
                onChange={(e) => setAnioNuevo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
              {erroresCampos.anio ? (
                <p className="mt-1 text-sm font-medium text-red-800">{erroresCampos.anio}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Alumnos a promocionar</h2>
              <p className="mt-1 text-sm font-medium text-ink-muted">
                {elegidos.size === 0
                  ? 'Nadie seleccionado.'
                  : `${elegidos.size} seleccionado${elegidos.size === 1 ? '' : 's'}.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={seleccionarSoloActivos}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/20 bg-background px-4 text-sm font-semibold text-ink transition hover:bg-background/80"
              >
                Seleccionar activos
              </button>
              <button
                type="button"
                onClick={limpiarSeleccion}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/20 bg-background px-4 text-sm font-semibold text-ink transition hover:bg-background/80"
              >
                Quitar selección
              </button>
            </div>
          </div>
          {erroresCampos.alumnos ? (
            <p className="mt-2 text-sm font-medium text-red-800">{erroresCampos.alumnos}</p>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-xl border border-ink/[0.1] bg-background shadow-s">
            <table className="min-w-full divide-y divide-ink/10 text-left text-sm">
              <thead className="bg-background/70">
                <tr>
                  <th scope="col" className="w-12 px-3 py-3 font-semibold text-ink">
                    <span className="sr-only">Elegir</span>
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-ink">
                    Apellidos
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-ink">
                    Nombre
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-ink">
                    DNI
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold text-ink">
                    Estado
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
                      No hay alumnos en este curso.
                    </td>
                  </tr>
                ) : (
                  alumnos.map((a) => (
                    <tr key={a.id} className="hover:bg-secondary/60">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={elegidos.has(a.id)}
                          onChange={() => toggleId(a.id)}
                          aria-label={`Promocionar a ${a.nombre} ${a.apellido}`}
                          className="h-4 w-4 rounded border-ink/30 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-3 py-3 font-medium text-ink">{a.apellido}</td>
                      <td className="px-3 py-3 font-medium text-ink">{a.nombre}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums font-medium text-ink">
                        {a.dni}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-ink">
                        {a.abandono ? (
                          <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                            Abandonó
                          </span>
                        ) : (
                          <span className="text-ink-muted">Activo</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 min-w-[12rem] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94] disabled:opacity-60"
          >
            {enviando ? 'Promocionando…' : 'Crear curso y promocionar'}
          </button>
          <Link
            to={`/cursos/${cursoId}/alumnos`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/20 bg-background px-5 text-sm font-semibold text-ink transition hover:bg-background/90"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
