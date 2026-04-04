import { type FormEvent, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

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
    return `${textoBase} Si eres administrador, ejecuta en Supabase el script sql/patch_admin_cursos_insert.sql.`
  }
  return textoBase
}

export function NuevoCursoPage() {
  const { user, authReady } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [nivel, setNivel] = useState('')
  const [anioAcademico, setAnioAcademico] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'err'
    texto: string
  } | null>(null)
  const [erroresCampos, setErroresCampos] = useState<{
    nombre?: string
    nivel?: string
    anio_academico?: string
  }>({})

  function validar(): boolean {
    const next: typeof erroresCampos = {}
    if (!nombre.trim()) next.nombre = 'El nombre del curso es obligatorio.'
    if (!nivel.trim()) next.nivel = 'El nivel es obligatorio.'
    if (!anioAcademico.trim())
      next.anio_academico = 'Indica el curso académico (ej. 2025-2026).'
    setErroresCampos(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMensaje(null)
    if (!validar()) return

    setEnviando(true)
    const { data, error } = await supabase
      .from('cursos')
      .insert({
        nombre: nombre.trim(),
        nivel: nivel.trim(),
        anio_academico: anioAcademico.trim(),
      })
      .select('id')
      .maybeSingle()

    setEnviando(false)

    if (error) {
      setMensaje({ tipo: 'err', texto: textoErrorEscrituraSupabase(error) })
      return
    }
    const id = data?.id
    if (id) {
      navigate(`/cursos/${id}/alumnos`, { replace: true })
    } else {
      setMensaje({
        tipo: 'ok',
        texto: 'Curso creado. Puedes verlo en la lista de cursos.',
      })
      setNombre('')
      setNivel('')
      setAnioAcademico('')
    }
  }

  if (!authReady || !user) {
    return (
      <p className="text-sm font-medium text-ink">Comprobando sesión…</p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nuevo curso</h1>
        <p className="mt-1 text-base font-medium leading-relaxed text-ink">
          Registra un curso con nombre, nivel y año académico.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-ink/[0.1] bg-secondary p-5 shadow-s md:p-6"
      >
        {mensaje ? (
          <p
            className={
              mensaje.tipo === 'ok'
                ? 'mb-4 text-sm font-medium text-ink'
                : 'mb-4 text-sm font-medium text-red-800'
            }
            role={mensaje.tipo === 'err' ? 'alert' : undefined}
          >
            {mensaje.texto}
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="curso-nombre" className="block text-sm font-medium text-ink">
              Nombre del curso <span className="text-red-700">*</span>
            </label>
            <input
              id="curso-nombre"
              name="nombre"
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Primera comunión — grupo A"
              className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            {erroresCampos.nombre ? (
              <p className="mt-1 text-sm font-medium text-red-800">
                {erroresCampos.nombre}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="curso-nivel" className="block text-sm font-medium text-ink">
              Nivel <span className="text-red-700">*</span>
            </label>
            <input
              id="curso-nivel"
              name="nivel"
              autoComplete="off"
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              placeholder="Ej. Iniciación, Primera comunión…"
              className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            {erroresCampos.nivel ? (
              <p className="mt-1 text-sm font-medium text-red-800">
                {erroresCampos.nivel}
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="curso-anio"
              className="block text-sm font-medium text-ink"
            >
              Curso académico <span className="text-red-700">*</span>
            </label>
            <input
              id="curso-anio"
              name="anio_academico"
              autoComplete="off"
              value={anioAcademico}
              onChange={(e) => setAnioAcademico(e.target.value)}
              placeholder="Ej. 2025-2026"
              className="mt-1 w-full rounded-xl border border-ink/20 bg-background px-3 py-2.5 text-base text-ink outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            {erroresCampos.anio_academico ? (
              <p className="mt-1 text-sm font-medium text-red-800">
                {erroresCampos.anio_academico}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 min-w-[11rem] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-ink shadow-s transition hover:brightness-[0.97] active:brightness-[0.94] disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Crear curso'}
          </button>
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/20 bg-background px-5 text-sm font-semibold text-ink transition hover:bg-secondary"
          >
            Volver a cursos
          </Link>
        </div>
      </form>
    </div>
  )
}
