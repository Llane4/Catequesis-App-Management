import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

type CursoFila = {
  id: string
  nombre: string
  nivel: string
  anio_academico: string
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

function fechaMaxHoy(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Mensaje claro cuando PostgREST devuelve 403 / violación RLS. */
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

function textoOpcionalDb(s: string): string | null {
  const t = s.trim()
  return t.length > 0 ? t : null
}

export function NuevoAlumno() {
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
  const [cargandoCursos, setCargandoCursos] = useState(true)
  const [errorCursos, setErrorCursos] = useState<string | null>(null)

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

      const { data, error: errConsulta } = await supabase
        .from('curso_profesor')
        .select('id, cursos(id, nombre, nivel, anio_academico)')
        .order('id', { ascending: true })

      if (cancelado) return

      if (errConsulta) {
        setErrorCursos(errConsulta.message)
        setCursos([])
      } else {
        const filas = (data ?? []) as unknown as CursoProfesorFila[]
        const lista = filas
          .map((f) => {
            const curso = cursoDesdeFila(f.cursos)
            return curso ? { asignacionId: f.id, curso } : null
          })
          .filter((x): x is { asignacionId: string; curso: CursoFila } =>
            Boolean(x),
          )
          .sort((a, b) =>
            (a.curso.nombre + a.curso.nivel).localeCompare(
              b.curso.nombre + b.curso.nivel,
              'es',
              { sensitivity: 'base' },
            ),
          )
        setCursos(lista)
      }
      setCargandoCursos(false)
    }

    void cargarCursos()
    return () => {
      cancelado = true
    }
  }, [authReady, user])

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

    if (!user) {
      setMensaje({
        tipo: 'err',
        texto: 'Debes iniciar sesión para registrar un alumno.',
      })
      return
    }

    if (!validar()) return

    setEnviando(true)

    const { data: alumnoInsertado, error: errAlumno } = await supabase
      .from('alumnos')
      .insert({
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
      .select('id')
      .single()

    if (errAlumno || !alumnoInsertado?.id) {
      setEnviando(false)
      setMensaje({
        tipo: 'err',
        texto: errAlumno
          ? textoErrorEscrituraSupabase(errAlumno)
          : 'No se pudo crear el alumno. Comprueba el DNI (¿ya existe?).',
      })
      return
    }

    const alumnoId = alumnoInsertado.id

    const filasSeguimiento = TIPOS_HITO.filter((t) => {
      const h = hitos[t]
      return h.marcado && h.fecha.trim()
    }).map((t) => ({
      alumno_id: alumnoId,
      tipo_hito: t,
      completado: true,
      fecha_hito: hitos[t].fecha.trim(),
    }))

    if (filasSeguimiento.length > 0) {
      const { error: errSeg } = await supabase
        .from('seguimiento_sacramental')
        .insert(filasSeguimiento)
      if (errSeg) {
        await supabase.from('alumnos').delete().eq('id', alumnoId)
        setEnviando(false)
        setMensaje({
          tipo: 'err',
          texto: textoErrorEscrituraSupabase(errSeg),
        })
        return
      }
    }

    setEnviando(false)
    setNombre('')
    setApellido('')
    setDni('')
    setFechaNacimiento('')
    setAbandono(false)
    setPadreNombre('')
    setPadreTelefono('')
    setPadreDni('')
    setMadreNombre('')
    setMadreTelefono('')
    setMadreDni('')
    setCursoId('')
    setHitos(estadoInicialHitos())
    setErroresCampos({})
    setMensaje({
      tipo: 'ok',
      texto: 'Alumno registrado correctamente.',
    })
  }

  if (!authReady) {
    return (
      <p className="text-sm font-medium text-ink">Comprobando sesión…</p>
    )
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink">Nuevo alumno</h1>
        <p className="text-base font-medium leading-relaxed text-ink">
          Inicia sesión para dar de alta alumnos.
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Nuevo alumno</h1>
          <p className="mt-1 text-base font-medium leading-relaxed text-ink">
            Alta de alumno y registro de hitos en seguimiento sacramental.
          </p>
        </div>
        <Link
          to="/alumnos"
          className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-ink underline decoration-primary/70 underline-offset-4 hover:decoration-primary"
        >
          ← Volver a alumnos
        </Link>
      </div>

      {cargandoCursos ? (
        <p className="text-sm font-medium text-ink">Cargando cursos disponibles…</p>
      ) : errorCursos ? (
        <p className="text-sm font-medium text-red-800" role="alert">
          No se pudieron cargar los cursos: {errorCursos}
        </p>
      ) : cursos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-secondary px-5 py-4 text-sm font-medium text-ink">
          No tienes cursos asignados. No puedes dar de alta alumnos hasta que
          administración te asigne un curso.
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
        {/* Datos personales */}
        <section
          aria-labelledby="sec-personales"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-personales"
            className="text-lg font-semibold text-ink"
          >
            Datos personales
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label
                htmlFor="nm"
                className="block text-sm font-medium text-ink"
              >
                Nombre <span className="text-red-700">*</span>
              </label>
              <input
                id="nm"
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
                htmlFor="ap"
                className="block text-sm font-medium text-ink"
              >
                Apellido{' '}
                <span className="text-red-700">*</span>
              </label>
              <input
                id="ap"
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
                htmlFor="doc"
                className="block text-sm font-medium text-ink"
              >
                DNI <span className="text-red-700">*</span>
              </label>
              <input
                id="doc"
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
                htmlFor="fn"
                className="block text-sm font-medium text-ink"
              >
                Fecha de nacimiento
              </label>
              <input
                id="fn"
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
                id="abandono-nuevo"
                type="checkbox"
                checked={abandono}
                onChange={(e) => setAbandono(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 rounded border-ink/30 bg-background accent-primary focus:ring-2 focus:ring-primary/50"
              />
              <label
                htmlFor="abandono-nuevo"
                className="text-sm font-medium text-ink"
              >
                Abandonó la catequesis (marcar si dejó de asistir de forma
                definitiva)
              </label>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="sec-padres"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-padres"
            className="text-lg font-semibold text-ink"
          >
            Padres o tutores
          </h2>
          <p className="mt-1 text-sm font-medium text-ink-muted">
            Opcional. Los datos se guardan con la misma confidencialidad que la
            ficha del alumno.
          </p>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Padre o tutor
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="padre-nombre"
                    className="block text-sm font-medium text-ink"
                  >
                    Nombre
                  </label>
                  <input
                    id="padre-nombre"
                    name="padre_nombre"
                    autoComplete="off"
                    value={padreNombre}
                    onChange={(e) => setPadreNombre(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="padre-tel"
                    className="block text-sm font-medium text-ink"
                  >
                    Teléfono
                  </label>
                  <input
                    id="padre-tel"
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
                    htmlFor="padre-dni"
                    className="block text-sm font-medium text-ink"
                  >
                    DNI
                  </label>
                  <input
                    id="padre-dni"
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
                    htmlFor="madre-nombre"
                    className="block text-sm font-medium text-ink"
                  >
                    Nombre
                  </label>
                  <input
                    id="madre-nombre"
                    name="madre_nombre"
                    autoComplete="off"
                    value={madreNombre}
                    onChange={(e) => setMadreNombre(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="madre-tel"
                    className="block text-sm font-medium text-ink"
                  >
                    Teléfono
                  </label>
                  <input
                    id="madre-tel"
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
                    htmlFor="madre-dni"
                    className="block text-sm font-medium text-ink"
                  >
                    DNI
                  </label>
                  <input
                    id="madre-dni"
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

        {/* Estado sacramental */}
        <section
          aria-labelledby="sec-sacramental"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-sacramental"
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
              const idChk = `hito-${tipo}`
              const idFecha = `fecha-${tipo}`
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

        {/* Curso */}
        <section
          aria-labelledby="sec-curso"
          className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s"
        >
          <h2
            id="sec-curso"
            className="text-lg font-semibold text-ink"
          >
            Curso al que irá
          </h2>
          <div className="mt-4 max-w-xl">
            <label
              htmlFor="curso"
              className="block text-sm font-medium text-ink"
            >
              Curso <span className="text-red-700">*</span>
            </label>
            <select
              id="curso"
              name="curso_id"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              disabled={cursos.length === 0}
              className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2 disabled:opacity-60"
            >
              <option value="">— Elige un curso —</option>
              {cursos.map(({ asignacionId, curso }) => (
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
              enviando || cursos.length === 0 || cargandoCursos || !!errorCursos
            }
            className="inline-flex min-h-11 min-w-[11rem] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? 'Guardando…' : 'Registrar alumno'}
          </button>
        </div>
      </form>
    </div>
  )
}
