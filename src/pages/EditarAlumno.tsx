import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchCursosParaSelector } from '../services/cursosDisponibles'

type TipoHitoSacramental =
  | 'bautismo'
  | 'comunion'
  | 'entrega_biblia'
  | 'entrega_rosario'
  | 'entrega_jesus'
  | 'entrega_cruz'
  | 'promesas_bautismales'
  | 'confirmacion'

const TIPOS_HITO: TipoHitoSacramental[] = [
  'bautismo',
  'comunion',
  'entrega_biblia',
  'entrega_rosario',
  'entrega_jesus',
  'entrega_cruz',
  'promesas_bautismales',
  'confirmacion',
]

const TIPOS_ENTREGA_MATERIAL: TipoHitoSacramental[] = [
  'entrega_biblia',
  'entrega_rosario',
  'entrega_jesus',
  'entrega_cruz',
]

const ETIQUETA_HITO: Record<TipoHitoSacramental, string> = {
  bautismo: 'Bautizado (bautismo)',
  comunion: 'Primera comunión',
  entrega_biblia: 'Entrega de Biblia',
  entrega_rosario: 'Entrega de rosario',
  entrega_jesus: 'Entrega de imagen de Jesús',
  entrega_cruz: 'Entrega de cruz',
  promesas_bautismales: 'Promesas bautismales',
  confirmacion: 'Confirmación',
}

type HitoForm = { marcado: boolean; fecha: string }

function estadoInicialHitos(): Record<TipoHitoSacramental, HitoForm> {
  return TIPOS_HITO.reduce(
    (acc, t) => {
      acc[t] = { marcado: false, fecha: '' }
      return acc
    },
    {} as Record<TipoHitoSacramental, HitoForm>,
  )
}

function hitosDesdeFilasSeguimiento(
  filas: { tipo_hito: string; completado: boolean; fecha_hito: string | null }[],
): Record<TipoHitoSacramental, HitoForm> {
  const base = estadoInicialHitos()
  for (const r of filas) {
    if (!TIPOS_HITO.includes(r.tipo_hito as TipoHitoSacramental)) continue
    const tipo = r.tipo_hito as TipoHitoSacramental
    const fecha = r.fecha_hito ? String(r.fecha_hito).slice(0, 10) : ''
    if (r.completado && fecha) {
      base[tipo] = { marcado: true, fecha }
    } else if (r.completado && !fecha) {
      base[tipo] = { marcado: true, fecha: '' }
    } else {
      base[tipo] = { marcado: false, fecha: '' }
    }
  }
  return base
}

type CursoFila = {
  id: string
  nombre: string
  nivel: string
  anio_academico: string
}

function cursoDesdeFila(
  c: CursoFila | CursoFila[] | null,
): CursoFila | null {
  if (!c) return null
  return Array.isArray(c) ? (c[0] ?? null) : c
}

function fechaMaxHoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function textoErrorEscrituraSupabase(err: PostgrestError): string {
  const partes = [err.message?.trim(), err.details?.trim(), err.hint?.trim()].filter(
    Boolean,
  )
  const textoBase = partes.length > 0 ? partes.join(' — ') : 'Error al guardar.'
  const m = (err.message ?? '').toLowerCase()
  const denegado =
    err.code === '42501' ||
    m.includes('row-level security') ||
    m.includes('permission denied') ||
    m.includes('rls')
  if (denegado) {
    return `${textoBase} Si acabas de desplegar la base de datos, ejecuta en Supabase el script sql/patch_fix_403_alumnos_rls.sql y comprueba que tu usuario tenga filas en curso_profesor para el curso elegido.`
  }
  return textoBase
}

type AlumnoCargaRow = {
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
  cursos: CursoFila | CursoFila[] | null
  seguimiento_sacramental:
    | { tipo_hito: string; completado: boolean; fecha_hito: string | null }[]
    | null
}

function textoOpcionalDb(s: string): string | null {
  const t = s.trim()
  return t.length > 0 ? t : null
}

export function EditarAlumno() {
  const { alumnoId } = useParams<{ alumnoId: string }>()
  const navigate = useNavigate()
  const { user, authReady } = useAuth()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [abandono, setAbandono] = useState(false)
  const [padreNombre, setPadreNombre] = useState('')
  const [padreTelefono, setPadreTelefono] = useState('')
  const [padreDni, setPadreDni] = useState('')
  const [madreNombre, setMadreNombre] = useState('')
  const [madreTelefono, setMadreTelefono] = useState('')
  const [madreDni, setMadreDni] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [hitos, setHitos] = useState(estadoInicialHitos)

  const [cursos, setCursos] = useState<
    { asignacionId: string; curso: CursoFila }[]
  >([])
  const [cursoDelAlumno, setCursoDelAlumno] = useState<CursoFila | null>(null)
  const [cargandoCursos, setCargandoCursos] = useState(true)
  const [errorCursos, setErrorCursos] = useState<string | null>(null)

  const [cargandoAlumno, setCargandoAlumno] = useState(true)
  const [errorAlumno, setErrorAlumno] = useState<string | null>(null)
  const [alumnoExiste, setAlumnoExiste] = useState(true)

  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'err'
    texto: string
  } | null>(null)

  const [erroresCampos, setErroresCampos] = useState<{
    nombre?: string
    apellido?: string
    dni?: string
    fecha_nacimiento?: string
    curso_id?: string
    hitos?: string
  }>({})

  const maxFecha = useMemo(() => fechaMaxHoy(), [])

  const cursosOpciones = useMemo(() => {
    const base = [...cursos]
    if (
      cursoDelAlumno &&
      !base.some((b) => b.curso.id === cursoDelAlumno.id)
    ) {
      return [
        {
          asignacionId: `__alumno__${cursoDelAlumno.id}`,
          curso: cursoDelAlumno,
        },
        ...base,
      ]
    }
    return base
  }, [cursos, cursoDelAlumno])

  useEffect(() => {
    let cancelado = false

    async function cargarCursos() {
      if (!authReady || !user) {
        setCursos([])
        setCargandoCursos(false)
        setErrorCursos(null)
        return
      }

      setCargandoCursos(true)
      setErrorCursos(null)

      const { cursos: lista, messageError } = await fetchCursosParaSelector(
        user.esAdmin,
      )

      if (cancelado) return

      if (messageError) {
        setErrorCursos(messageError)
        setCursos([])
      } else {
        setCursos(lista)
      }
      setCargandoCursos(false)
    }

    void cargarCursos()
    return () => {
      cancelado = true
    }
  }, [authReady, user])

  useEffect(() => {
    let cancelado = false

    async function cargarAlumno() {
      const id = alumnoId?.trim()
      if (!id) {
        setCargandoAlumno(false)
        setAlumnoExiste(false)
        setErrorAlumno(null)
        return
      }

      if (!authReady || !user) {
        setCargandoAlumno(!authReady)
        setErrorAlumno(null)
        if (authReady && !user) setCargandoAlumno(false)
        return
      }

      setCargandoAlumno(true)
      setErrorAlumno(null)

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
          seguimiento_sacramental ( tipo_hito, completado, fecha_hito )
        `,
        )
        .eq('id', id)
        .maybeSingle()

      if (cancelado) return

      if (errConsulta) {
        setErrorAlumno(errConsulta.message)
        setAlumnoExiste(false)
        setCursoDelAlumno(null)
      } else if (!data) {
        setAlumnoExiste(false)
        setCursoDelAlumno(null)
      } else {
        const row = data as unknown as AlumnoCargaRow
        setAlumnoExiste(true)
        setNombre(row.nombre)
        setApellido(row.apellido)
        setDni(row.dni)
        setFechaNacimiento(
          row.fecha_nacimiento
            ? String(row.fecha_nacimiento).slice(0, 10)
            : '',
        )
        setAbandono(Boolean(row.abandono))
        setPadreNombre(row.padre_nombre ?? '')
        setPadreTelefono(row.padre_telefono ?? '')
        setPadreDni(row.padre_dni ?? '')
        setMadreNombre(row.madre_nombre ?? '')
        setMadreTelefono(row.madre_telefono ?? '')
        setMadreDni(row.madre_dni ?? '')
        setCursoId(row.curso_id)
        setCursoDelAlumno(cursoDesdeFila(row.cursos))
        setHitos(
          hitosDesdeFilasSeguimiento(row.seguimiento_sacramental ?? []),
        )
      }
      setCargandoAlumno(false)
    }

    void cargarAlumno()
    return () => {
      cancelado = true
    }
  }, [alumnoId, authReady, user])

  function setHito(tipo: TipoHitoSacramental, patch: Partial<HitoForm>) {
    setHitos((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], ...patch },
    }))
  }

  function validar(): boolean {
    const next: typeof erroresCampos = {}
    const n = nombre.trim()
    const a = apellido.trim()
    const doc = dni.trim()

    if (!n) next.nombre = 'El nombre es obligatorio.'
    if (!a) next.apellido = 'El apellido es obligatorio.'
    if (!doc) next.dni = 'El DNI es obligatorio.'
    const fn = fechaNacimiento.trim()
    if (fn && fn > maxFecha) {
      next.fecha_nacimiento = 'La fecha de nacimiento no puede ser futura.'
    }
    if (!cursoId.trim()) next.curso_id = 'Selecciona un curso.'

    const hitoSinFecha: string[] = []
    for (const t of TIPOS_HITO) {
      const h = hitos[t]
      if (h.marcado && !h.fecha.trim()) {
        hitoSinFecha.push(ETIQUETA_HITO[t])
      }
    }
    if (hitoSinFecha.length > 0) {
      next.hitos = `Indica la fecha para: ${hitoSinFecha.join(', ')}.`
    }

    setErroresCampos(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMensaje(null)

    const id = alumnoId?.trim()
    if (!user || !id) {
      setMensaje({
        tipo: 'err',
        texto: !user
          ? 'Debes iniciar sesión para editar un alumno.'
          : 'Falta el identificador del alumno.',
      })
      return
    }

    if (!validar()) return

    setEnviando(true)

    const { error: errAlumno } = await supabase
      .from('alumnos')
      .update({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim(),
        curso_id: cursoId.trim(),
        abandono,
        fecha_nacimiento: textoOpcionalDb(fechaNacimiento),
        padre_nombre: textoOpcionalDb(padreNombre),
        padre_telefono: textoOpcionalDb(padreTelefono),
        padre_dni: textoOpcionalDb(padreDni),
        madre_nombre: textoOpcionalDb(madreNombre),
        madre_telefono: textoOpcionalDb(madreTelefono),
        madre_dni: textoOpcionalDb(madreDni),
      })
      .eq('id', id)

    if (errAlumno) {
      setEnviando(false)
      setMensaje({
        tipo: 'err',
        texto: textoErrorEscrituraSupabase(errAlumno),
      })
      return
    }

    const deseadoPorTipo = Object.fromEntries(
      TIPOS_HITO.map((t) => {
        const h = hitos[t]
        const ok = h.marcado && h.fecha.trim()
        return [t, ok] as const
      }),
    ) as Record<TipoHitoSacramental, boolean>

    for (const t of TIPOS_HITO) {
      if (deseadoPorTipo[t]) {
        const { error: errUp } = await supabase
          .from('seguimiento_sacramental')
          .upsert(
            {
              alumno_id: id,
              tipo_hito: t,
              completado: true,
              fecha_hito: hitos[t].fecha.trim(),
            },
            { onConflict: 'alumno_id,tipo_hito' },
          )
        if (errUp) {
          setEnviando(false)
          setMensaje({
            tipo: 'err',
            texto: textoErrorEscrituraSupabase(errUp),
          })
          return
        }
      } else {
        const { error: errDel } = await supabase
          .from('seguimiento_sacramental')
          .delete()
          .eq('alumno_id', id)
          .eq('tipo_hito', t)
        if (errDel) {
          setEnviando(false)
          setMensaje({
            tipo: 'err',
            texto: textoErrorEscrituraSupabase(errDel),
          })
          return
        }
      }
    }

    setEnviando(false)
    setErroresCampos({})
    navigate(`/alumnos/${id}`)
  }

  if (!alumnoId?.trim()) {
    return <Navigate to="/alumnos" replace />
  }

  if (!authReady) {
    return (
      <p className="text-sm font-medium text-ink">Comprobando sesión…</p>
    )
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Editar alumno</h1>
        <p className="text-base font-medium leading-relaxed text-ink">
          Inicia sesión para modificar datos de alumnos.
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

  if (cargandoAlumno) {
    return (
      <p className="text-sm font-medium text-ink">
        Cargando datos del alumno…
      </p>
    )
  }

  if (errorAlumno) {
    return (
      <div className="space-y-4">
        <Link
          to="/alumnos"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
        >
          ← Volver al listado de alumnos
        </Link>
        <p className="text-sm font-medium text-red-800" role="alert">
          No se pudieron cargar los datos: {errorAlumno}
        </p>
      </div>
    )
  }

  if (!alumnoExiste) {
    return (
      <div className="space-y-4">
        <Link
          to="/alumnos"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
        >
          ← Volver al listado de alumnos
        </Link>
        <p className="text-base font-medium text-ink-muted">
          No se encontró el alumno o no tienes permiso para editar su ficha.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Editar alumno</h1>
          <p className="mt-1 text-base font-medium leading-relaxed text-ink">
            Modifica datos personales, hitos sacramentales y curso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            to={`/alumnos/${alumnoId}`}
            className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
          >
            ← Volver a la ficha
          </Link>
          <Link
            to="/alumnos"
            className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
          >
            Todos los alumnos
          </Link>
        </div>
      </div>

      {cargandoCursos ? (
        <p className="text-sm font-medium text-ink">Cargando cursos disponibles…</p>
      ) : errorCursos ? (
        <p className="text-sm font-medium text-red-800" role="alert">
          No se pudieron cargar los cursos: {errorCursos}
        </p>
      ) : cursosOpciones.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-secondary px-5 py-4 text-sm font-medium text-ink">
          No tienes cursos asignados. No puedes reasignar alumnos hasta que
          administración te asigne un curso.
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
        <section
          aria-labelledby="sec-personales-edit"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-personales-edit"
            className="text-lg font-semibold text-ink"
          >
            Datos personales
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label
                htmlFor="nm-edit"
                className="block text-sm font-medium text-ink"
              >
                Nombre <span className="text-red-700">*</span>
              </label>
              <input
                id="nm-edit"
                name="nombre"
                autoComplete="given-name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
              {erroresCampos.nombre ? (
                <p className="mt-1 text-sm font-medium text-red-800">
                  {erroresCampos.nombre}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-1">
              <label
                htmlFor="ap-edit"
                className="block text-sm font-medium text-ink"
              >
                Apellido{' '}
                <span className="text-red-700">*</span>
              </label>
              <input
                id="ap-edit"
                name="apellido"
                autoComplete="family-name"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
              {erroresCampos.apellido ? (
                <p className="mt-1 text-sm font-medium text-red-800">
                  {erroresCampos.apellido}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="doc-edit"
                className="block text-sm font-medium text-ink"
              >
                DNI <span className="text-red-700">*</span>
              </label>
              <input
                id="doc-edit"
                name="dni"
                autoComplete="off"
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className="mt-1 w-full max-w-md rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
              {erroresCampos.dni ? (
                <p className="mt-1 text-sm font-medium text-red-800">
                  {erroresCampos.dni}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-1">
              <label
                htmlFor="fn-edit"
                className="block text-sm font-medium text-ink"
              >
                Fecha de nacimiento
              </label>
              <input
                id="fn-edit"
                name="fecha_nacimiento"
                type="date"
                value={fechaNacimiento}
                max={maxFecha}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
              />
              {erroresCampos.fecha_nacimiento ? (
                <p className="mt-1 text-sm font-medium text-red-800">
                  {erroresCampos.fecha_nacimiento}
                </p>
              ) : null}
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <input
                id="abandono-edit"
                type="checkbox"
                checked={abandono}
                onChange={(e) => setAbandono(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 rounded border-ink/30 bg-background accent-primary focus:ring-2 focus:ring-primary/50"
              />
              <label
                htmlFor="abandono-edit"
                className="text-sm font-medium text-ink"
              >
                Abandonó la catequesis (marcar si dejó de asistir de forma
                definitiva)
              </label>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="sec-padres-edit"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-padres-edit"
            className="text-lg font-semibold text-ink"
          >
            Padres o tutores
          </h2>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Opcional. Misma confidencialidad que el resto de la ficha.
          </p>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Padre o tutor
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="padre-nombre-edit"
                    className="block text-sm font-medium text-ink"
                  >
                    Nombre
                  </label>
                  <input
                    id="padre-nombre-edit"
                    name="padre_nombre"
                    autoComplete="off"
                    value={padreNombre}
                    onChange={(e) => setPadreNombre(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="padre-tel-edit"
                    className="block text-sm font-medium text-ink"
                  >
                    Teléfono
                  </label>
                  <input
                    id="padre-tel-edit"
                    name="padre_telefono"
                    type="tel"
                    autoComplete="tel"
                    value={padreTelefono}
                    onChange={(e) => setPadreTelefono(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="padre-dni-edit"
                    className="block text-sm font-medium text-ink"
                  >
                    DNI
                  </label>
                  <input
                    id="padre-dni-edit"
                    name="padre_dni"
                    autoComplete="off"
                    value={padreDni}
                    onChange={(e) => setPadreDni(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Madre o tutor
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="madre-nombre-edit"
                    className="block text-sm font-medium text-ink"
                  >
                    Nombre
                  </label>
                  <input
                    id="madre-nombre-edit"
                    name="madre_nombre"
                    autoComplete="off"
                    value={madreNombre}
                    onChange={(e) => setMadreNombre(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="madre-tel-edit"
                    className="block text-sm font-medium text-ink"
                  >
                    Teléfono
                  </label>
                  <input
                    id="madre-tel-edit"
                    name="madre_telefono"
                    type="tel"
                    autoComplete="tel"
                    value={madreTelefono}
                    onChange={(e) => setMadreTelefono(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="madre-dni-edit"
                    className="block text-sm font-medium text-ink"
                  >
                    DNI
                  </label>
                  <input
                    id="madre-dni-edit"
                    name="madre_dni"
                    autoComplete="off"
                    value={madreDni}
                    onChange={(e) => setMadreDni(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="sec-sacramental-edit"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-sacramental-edit"
            className="text-lg font-semibold text-ink"
          >
            Estado sacramental
          </h2>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Marca lo que corresponda: cada ítem marcado se guarda en seguimiento
            sacramental como completado, con su fecha.
          </p>
          {erroresCampos.hitos ? (
            <p className="mt-3 text-sm font-medium text-red-800">
              {erroresCampos.hitos}
            </p>
          ) : null}
          <ul className="mt-4 divide-y divide-ink/10">
            {TIPOS_HITO.map((tipo) => {
              const h = hitos[tipo]
              const idChk = `hito-edit-${tipo}`
              const idFecha = `fecha-edit-${tipo}`
              return (
                <li key={tipo} className="py-4 first:pt-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="flex flex-1 items-start gap-3">
                      <input
                        id={idChk}
                        type="checkbox"
                        checked={h.marcado}
                        onChange={(e) => {
                          const on = e.target.checked
                          setHito(tipo, {
                            marcado: on,
                            fecha: on ? h.fecha : '',
                          })
                        }}
                        className="mt-1 h-5 w-5 shrink-0 rounded border-ink/30 bg-background accent-primary focus:ring-2 focus:ring-primary/50"
                      />
                      <label
                        htmlFor={idChk}
                        className="cursor-pointer text-base font-medium text-ink"
                      >
                        {ETIQUETA_HITO[tipo]}
                        {(TIPOS_ENTREGA_MATERIAL as readonly string[]).includes(
                          tipo,
                        ) ? (
                          <span className="ml-1 text-xs font-normal text-ink-muted">
                            (entrega)
                          </span>
                        ) : null}
                      </label>
                    </div>
                    {h.marcado ? (
                      <div className="w-full sm:max-w-[12rem]">
                        <label
                          htmlFor={idFecha}
                          className="block text-xs font-semibold uppercase tracking-wide text-ink-muted"
                        >
                          Fecha
                        </label>
                        <input
                          id={idFecha}
                          type="date"
                          name={`fecha_${tipo}`}
                          value={h.fecha}
                          max={maxFecha}
                          onChange={(e) =>
                            setHito(tipo, { fecha: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section
          aria-labelledby="sec-curso-edit"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-curso-edit"
            className="text-lg font-semibold text-ink"
          >
            Curso al que irá
          </h2>
          <div className="mt-4 max-w-xl">
            <label
              htmlFor="curso-edit"
              className="block text-sm font-medium text-ink"
            >
              Curso <span className="text-red-700">*</span>
            </label>
            <select
              id="curso-edit"
              name="curso_id"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              disabled={cursosOpciones.length === 0}
              className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2 disabled:opacity-60"
            >
              <option value="">— Elige un curso —</option>
              {cursosOpciones.map(({ asignacionId, curso }) => (
                <option key={asignacionId} value={curso.id}>
                  {curso.nombre} · {curso.nivel} ({curso.anio_academico})
                </option>
              ))}
            </select>
            {erroresCampos.curso_id ? (
              <p className="mt-1 text-sm font-medium text-red-800">
                {erroresCampos.curso_id}
              </p>
            ) : null}
          </div>
        </section>

        {mensaje ? (
          <p
            role="alert"
            className={
              mensaje.tipo === 'ok'
                ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950'
                : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900'
            }
          >
            {mensaje.texto}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={
              enviando ||
              cursosOpciones.length === 0 ||
              cargandoCursos ||
              !!errorCursos
            }
            className="inline-flex min-h-11 min-w-[11rem] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
