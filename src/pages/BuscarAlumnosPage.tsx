import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MIN_CHARS = 2
const MAX_RESULTS = 50
const DEBOUNCE_MS = 350

/** Evita que % y _ actúen como comodines ILIKE no deseados. */
function escapeIlikeWildcards(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

type CursoMini = {
  nombre: string
  nivel: string
  anio_academico: string
}

type AlumnoBusquedaRow = {
  id: string
  nombre: string
  apellido: string
  dni: string
  cursos: CursoMini | CursoMini[] | null
}

function cursoLabel(c: AlumnoBusquedaRow['cursos']): string | null {
  if (!c) return null
  const uno = Array.isArray(c) ? c[0] : c
  if (!uno) return null
  return `${uno.nombre} (${uno.nivel} · ${uno.anio_academico})`
}

export function BuscarAlumnosPage() {
  const labelId = useId()
  const [texto, setTexto] = useState('')
  const [debounced, setDebounced] = useState('')
  const [resultados, setResultados] = useState<AlumnoBusquedaRow[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(texto.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [texto])

  useEffect(() => {
    let cancelado = false

    async function buscar() {
      if (debounced.length < MIN_CHARS) {
        setResultados([])
        setError(null)
        setCargando(false)
        return
      }

      setCargando(true)
      setError(null)

      const core = debounced.replace(/"/g, '').replace(/,/g, ' ')
      const pattern = `%${escapeIlikeWildcards(core)}%`
      const quoted = `"${pattern.replace(/"/g, '')}"`

      const filtroOr = [
        `nombre.ilike.${quoted}`,
        `apellido.ilike.${quoted}`,
        `dni.ilike.${quoted}`,
      ].join(',')

      const { data, error: errConsulta } = await supabase
        .from('alumnos')
        .select(
          `id, nombre, apellido, dni, cursos ( nombre, nivel, anio_academico )`,
        )
        .or(filtroOr)
        .order('apellido', { ascending: true })
        .order('nombre', { ascending: true })
        .limit(MAX_RESULTS)

      if (cancelado) return

      if (errConsulta) {
        setError(errConsulta.message)
        setResultados([])
      } else {
        setResultados((data ?? []) as AlumnoBusquedaRow[])
      }
      setCargando(false)
    }

    void buscar()
    return () => {
      cancelado = true
    }
  }, [debounced])

  const demasiadoCorto = texto.trim().length > 0 && debounced.length < MIN_CHARS

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">
        Buscar alumnos
      </h1>
      <p className="text-sm font-medium text-ink">
        Busca por nombre, apellidos o DNI. Se mostrarán hasta {MAX_RESULTS}{' '}
        coincidencias.
      </p>

      <div className="max-w-xl">
        <label
          htmlFor={labelId}
          className="mb-1 block text-sm font-medium text-ink"
        >
          Término de búsqueda
        </label>
        <input
          id={labelId}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Ej.: García, 47382…"
          className="w-full rounded-xl border border-ink/20 bg-background px-4 py-3 text-base text-ink shadow-s outline-none ring-primary/25 placeholder:text-ink-muted/80 focus:border-primary focus:ring-4 focus:ring-primary/25"
        />
      </div>

      {demasiadoCorto ? (
        <p className="text-sm font-medium text-ink-muted">
          Escribe al menos {MIN_CHARS} caracteres para buscar.
        </p>
      ) : null}

      {cargando ? (
        <p className="text-sm font-medium text-ink-muted">Buscando…</p>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-red-800" role="alert">
          No se pudo completar la búsqueda: {error}
        </p>
      ) : null}

      {!cargando &&
      !error &&
      debounced.length >= MIN_CHARS &&
      resultados.length === 0 ? (
        <p className="text-sm font-medium text-ink-muted">
          No hay alumnos que coincidan con «{debounced}».
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-ink/[0.1] bg-secondary shadow-s">
          <table className="min-w-full divide-y divide-ink/10 text-left text-sm">
            <thead className="bg-background/70">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">
                  Nombre
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">
                  Apellidos
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-ink">
                  DNI
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-semibold text-ink sm:table-cell"
                >
                  Curso
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
              {resultados.map((a) => (
                <tr key={a.id} className="hover:bg-background/50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                    {a.nombre}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {a.apellido}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums font-medium text-ink">
                    {a.dni}
                  </td>
                  <td className="hidden max-w-[12rem] truncate px-4 py-3 font-medium text-ink-muted sm:table-cell">
                    {cursoLabel(a.cursos) ?? '—'}
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
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
