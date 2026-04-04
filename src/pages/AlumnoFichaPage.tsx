import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { edadDesdeFechaNacimiento } from '../lib/edad'
import { supabase } from '../lib/supabase'

type TipoHitoSacramental =
  | 'bautismo'
  | 'comunion'
  | 'entrega_biblia'
  | 'entrega_rosario'
  | 'entrega_jesus'
  | 'entrega_cruz'
  | 'promesas_bautismales'
  | 'confirmacion'

const ETIQUETA_HITO: Record<TipoHitoSacramental, string> = {
  bautismo: 'Bautismo',
  comunion: 'Primera comunión',
  entrega_biblia: 'Entrega de Biblia',
  entrega_rosario: 'Entrega de rosario',
  entrega_jesus: 'Entrega de Jesús',
  entrega_cruz: 'Entrega de cruz',
  promesas_bautismales: 'Promesas bautismales',
  confirmacion: 'Confirmación',
}

function etiquetaTipoHito(tipo: string): string {
  return tipo in ETIQUETA_HITO
    ? ETIQUETA_HITO[tipo as TipoHitoSacramental]
    : tipo
}

type CursoEmb = {
  id: string
  nombre: string
  nivel: string
  anio_academico: string
}

type SeguimientoRow = {
  tipo_hito: string
  completado: boolean
  fecha_hito: string | null
}

type HistorialCursoRow = {
  id: string
  curso_id: string
  fecha_inicio: string
  fecha_fin: string | null
  nota: string | null
  cursos: CursoEmb | CursoEmb[] | null
}

type AlumnoFichaRow = {
  id: string
  nombre: string
  apellido: string
  dni: string
  curso_id: string
  abandono: boolean
  fecha_nacimiento: string | null
  padre_nombre: string | null
  padre_telefono: string | null
  padre_dni: string | null
  madre_nombre: string | null
  madre_telefono: string | null
  madre_dni: string | null
  cursos: CursoEmb | CursoEmb[] | null
  seguimiento_sacramental: SeguimientoRow[] | null
  alumnos_historial_cursos: HistorialCursoRow[] | null
}

function cursoNormalizado(
  c: CursoEmb | CursoEmb[] | null,
): CursoEmb | null {
  if (!c) return null
  return Array.isArray(c) ? (c[0] ?? null) : c
}

function formatearFecha(isoDate: string | null): string | null {
  if (!isoDate?.trim()) return null
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/** fechas con hora (timestamptz desde Supabase) */
function formatearFechaHora(iso: string | null): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function AlumnoFichaPage() {
  const { alumnoId } = useParams<{ alumnoId: string }>()
  const { user } = useAuth()
  const [fila, setFila] = useState<AlumnoFichaRow | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (!alumnoId?.trim()) {
        setFila(null)
        setCargando(false)
        setError(null)
        return
      }

      setCargando(true)
      setError(null)

      const { data, error: errConsulta } = await supabase
        .from('alumnos')
        .select(
          `
          id,
          nombre,
          apellido,
          dni,
          curso_id,
          abandono,
          fecha_nacimiento,
          padre_nombre,
          padre_telefono,
          padre_dni,
          madre_nombre,
          madre_telefono,
          madre_dni,
          cursos ( id, nombre, nivel, anio_academico ),
          seguimiento_sacramental ( tipo_hito, completado, fecha_hito ),
          alumnos_historial_cursos (
            id,
            curso_id,
            fecha_inicio,
            fecha_fin,
            nota,
            cursos ( id, nombre, nivel, anio_academico )
          )
        `,
        )
        .eq('id', alumnoId)
        .maybeSingle()

      if (cancelado) return

      if (errConsulta) {
        setError(errConsulta.message)
        setFila(null)
      } else if (!data) {
        setFila(null)
      } else {
        setFila(data as unknown as AlumnoFichaRow)
      }
      setCargando(false)
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [alumnoId])

  if (!alumnoId?.trim()) {
    return <Navigate to="/alumnos" replace />
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">Cargando ficha del alumno…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          to="/alumnos"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
        >
          ← Volver al listado de alumnos
        </Link>
        <p className="text-sm text-red-800" role="alert">
          No se pudieron cargar los datos: {error}
        </p>
      </div>
    )
  }

  if (!fila) {
    return (
      <div className="space-y-4">
        <Link
          to="/alumnos"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
        >
          ← Volver al listado de alumnos
        </Link>
        <p className="text-ink-muted">No se encontró el alumno o no tienes permiso para ver su ficha.</p>
      </div>
    )
  }

  const curso = cursoNormalizado(fila.cursos)
  const hitos = [...(fila.seguimiento_sacramental ?? [])].sort((a, b) =>
    etiquetaTipoHito(a.tipo_hito).localeCompare(
      etiquetaTipoHito(b.tipo_hito),
      'es',
      { sensitivity: 'base' },
    ),
  )
  const historialOrdenado = [...(fila.alumnos_historial_cursos ?? [])].sort(
    (a, b) =>
      new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime(),
  )
  const hitosRealizados = hitos.filter((h) => h.completado)
  const fechaNacStr = fila.fecha_nacimiento
    ? String(fila.fecha_nacimiento).slice(0, 10)
    : null
  const edad = edadDesdeFechaNacimiento(fechaNacStr)
  const hayDatosPadres = Boolean(
    fila.padre_nombre?.trim() ||
      fila.padre_telefono?.trim() ||
      fila.padre_dni?.trim() ||
      fila.madre_nombre?.trim() ||
      fila.madre_telefono?.trim() ||
      fila.madre_dni?.trim(),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <Link
          to="/alumnos"
          className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
        >
          ← Todos los alumnos
        </Link>
        {curso ? (
          <Link
            to={`/cursos/${fila.curso_id}/alumnos`}
            className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
          >
            ← Alumnos del curso ({curso.nombre})
          </Link>
        ) : null}
      </div>

      {Boolean(fila.abandono) ? (
        <div
          className="rounded-2xl border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Este alumno consta como haber abandonado la catequesis.
        </div>
      ) : null}

      <header className="flex flex-col gap-3 border-b border-ink/10 pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {fila.nombre} {fila.apellido}
          </h1>
          <p className="text-sm font-medium text-ink-muted">Ficha del alumno</p>
        </div>
        <Link
          to={`/alumnos/${fila.id}/editar`}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94] sm:w-auto"
        >
          Editar ficha
        </Link>
      </header>

      <section
        aria-labelledby="datos-personales-heading"
        className="rounded-3xl border border-ink/[0.08] bg-secondary p-5 shadow-s sm:p-6"
      >
        <h2
          id="datos-personales-heading"
          className="text-lg font-semibold text-ink"
        >
          Datos personales
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Nombre
            </dt>
            <dd className="mt-1 text-base font-medium text-ink">
              {fila.nombre}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Apellidos
            </dt>
            <dd className="mt-1 text-base font-medium text-ink">
              {fila.apellido}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              DNI
            </dt>
            <dd className="mt-1 tabular-nums text-base font-medium text-ink">
              {fila.dni}
            </dd>
          </div>
          {fechaNacStr ? (
            <>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Fecha de nacimiento
                </dt>
                <dd className="mt-1 text-base font-medium text-ink">
                  <time dateTime={fechaNacStr}>
                    {formatearFecha(fechaNacStr)}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Edad
                </dt>
                <dd className="mt-1 text-base font-medium text-ink">
                  {edad !== null ? `${edad} años` : '—'}
                </dd>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Fecha de nacimiento
              </dt>
              <dd className="mt-1 text-base font-medium text-ink-muted">
                Sin registrar
              </dd>
            </div>
          )}
        </dl>
      </section>

      {hayDatosPadres ? (
        <section
          aria-labelledby="padres-heading"
          className="rounded-3xl border border-ink/[0.08] bg-secondary p-5 shadow-s sm:p-6"
        >
          <h2 id="padres-heading" className="text-lg font-semibold text-ink">
            Padres o tutores
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Padre o tutor</h3>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Nombre
                  </dt>
                  <dd className="mt-0.5 font-medium text-ink">
                    {fila.padre_nombre?.trim() || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Teléfono
                  </dt>
                  <dd className="mt-0.5 tabular-nums font-medium text-ink">
                    {fila.padre_telefono?.trim() || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    DNI
                  </dt>
                  <dd className="mt-0.5 tabular-nums font-medium text-ink">
                    {fila.padre_dni?.trim() || '—'}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Madre o tutor</h3>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Nombre
                  </dt>
                  <dd className="mt-0.5 font-medium text-ink">
                    {fila.madre_nombre?.trim() || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Teléfono
                  </dt>
                  <dd className="mt-0.5 tabular-nums font-medium text-ink">
                    {fila.madre_telefono?.trim() || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    DNI
                  </dt>
                  <dd className="mt-0.5 tabular-nums font-medium text-ink">
                    {fila.madre_dni?.trim() || '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="curso-heading"
        className="rounded-3xl border border-ink/[0.08] bg-secondary p-5 shadow-s sm:p-6"
      >
        <h2 id="curso-heading" className="text-lg font-semibold text-ink">
          Curso
        </h2>
        {curso ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Nombre del curso
              </dt>
              <dd className="mt-1 text-base font-medium text-ink">
                {curso.nombre}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Nivel
              </dt>
              <dd className="mt-1 text-base font-medium text-ink">
                {curso.nivel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Curso académico
              </dt>
              <dd className="mt-1 text-base font-medium text-ink">
                {curso.anio_academico}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm font-medium text-ink-muted">
            No se pudo cargar la información del curso.
          </p>
        )}
      </section>

      <section
        aria-labelledby="historial-cursos-heading"
        className="rounded-3xl border border-ink/[0.08] bg-secondary p-5 shadow-s sm:p-6"
      >
        <h2
          id="historial-cursos-heading"
          className="text-lg font-semibold text-ink"
        >
          Historial de cursos
        </h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-ink-muted">
          Períodos en cada curso (desde la fecha de alta o cambio). El período
          sin fecha de fin es el actual.
        </p>
        {user && !user.esAdmin ? (
          <p className="mt-2 text-xs font-medium text-ink-muted">
            Solo verás entradas de cursos en los que figuras como profesor.
          </p>
        ) : null}

        {historialOrdenado.length === 0 ? (
          <p className="mt-4 text-sm font-medium text-ink-muted">
            No hay registros de historial para este alumno.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-background shadow-s">
            <table className="min-w-full divide-y divide-ink/10 text-left text-sm">
              <thead className="bg-background/80">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold text-ink"
                  >
                    Curso
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 font-semibold text-ink"
                  >
                    Desde
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 font-semibold text-ink"
                  >
                    Hasta
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-ink">
                    Nota
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {historialOrdenado.map((h) => {
                  const cursoH = cursoNormalizado(h.cursos)
                  const desdeTxt = formatearFechaHora(h.fecha_inicio)
                  const hastaTxt = h.fecha_fin
                    ? formatearFechaHora(h.fecha_fin)
                    : null
                  return (
                    <tr key={h.id} className="hover:bg-secondary/50">
                      <td className="px-4 py-3">
                        {cursoH ? (
                          <div className="font-medium text-ink">
                            <Link
                              to={`/cursos/${h.curso_id}/alumnos`}
                              className="text-ink underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
                            >
                              {cursoH.nombre}
                            </Link>
                          </div>
                        ) : (
                          <span className="font-medium text-ink-muted">
                            Curso sin datos
                          </span>
                        )}
                        {cursoH ? (
                          <p className="mt-0.5 text-xs font-medium text-ink-muted">
                            {cursoH.nivel} · {cursoH.anio_academico}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink">
                        {desdeTxt ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink">
                        {hastaTxt ? (
                          hastaTxt
                        ) : (
                          <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-xs font-semibold text-ink">
                            Actual
                          </span>
                        )}
                      </td>
                      <td className="max-w-[14rem] px-4 py-3 text-ink-muted">
                        {h.nota?.trim() ? h.nota.trim() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="hitos-heading"
        className="rounded-3xl border border-ink/[0.08] bg-secondary p-5 shadow-s sm:p-6"
      >
        <h2 id="hitos-heading" className="text-lg font-semibold text-ink">
          Hitos sacramentales
        </h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-ink-muted">
          Hitos marcados como realizados, con la fecha registrada cuando exista.
        </p>

        {hitos.length === 0 ? (
          <p className="mt-4 text-sm font-medium text-ink-muted">
            No hay registros de seguimiento sacramental para este alumno.
          </p>
        ) : hitosRealizados.length === 0 ? (
          <p className="mt-4 text-sm font-medium text-ink-muted">
            No consta ningún hito sacramental completado.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/10">
            {hitosRealizados.map((h) => {
              const fechaTxt = formatearFecha(h.fecha_hito)
              return (
                <li
                  key={h.tipo_hito}
                  className="flex flex-col gap-1 border-l-[3px] border-accent py-3 pl-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-semibold text-ink">
                    {etiquetaTipoHito(h.tipo_hito)}
                  </span>
                  <span className="text-sm font-medium text-ink-muted">
                    {fechaTxt ? (
                      <>
                        Realizado el{' '}
                        <time dateTime={h.fecha_hito ?? undefined}>
                          {fechaTxt}
                        </time>
                      </>
                    ) : (
                      'Realizado (sin fecha registrada)'
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {hitos.some((h) => !h.completado) ? (
          <div className="mt-4 rounded-2xl border border-accent/35 bg-background px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink">
              Pendientes
            </p>
            <ul className="mt-2 list-inside list-disc text-sm font-medium text-ink-muted">
              {hitos
                .filter((h) => !h.completado)
                .map((h) => (
                  <li key={`pend-${h.tipo_hito}`}>
                    {etiquetaTipoHito(h.tipo_hito)}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  )
}
