import { supabase } from '../lib/supabase'

export type CursoFilaForm = {
  id: string
  nombre: string
  nivel: string
  anio_academico: string
}

export type CursoOpcionForm = { asignacionId: string; curso: CursoFilaForm }

type CursoProfesorFila = {
  id: string
  cursos: CursoFilaForm | CursoFilaForm[] | null
}

function cursoDesdeFila(
  c: CursoFilaForm | CursoFilaForm[] | null,
): CursoFilaForm | null {
  if (!c) return null
  return Array.isArray(c) ? (c[0] ?? null) : c
}

/** Cursos disponibles en formularios: todos si es admin, si no solo asignados. */
export async function fetchCursosParaSelector(esAdmin: boolean): Promise<{
  cursos: CursoOpcionForm[]
  messageError: string | null
}> {
  if (esAdmin) {
    const { data, error: err } = await supabase
      .from('cursos')
      .select('id, nombre, nivel, anio_academico')
      .order('nombre', { ascending: true })

    if (err) return { cursos: [], messageError: err.message }

    const cursos = (data ?? []).map((row) => ({
      asignacionId: row.id,
      curso: row as CursoFilaForm,
    }))
    return { cursos, messageError: null }
  }

  const { data, error: err } = await supabase
    .from('curso_profesor')
    .select('id, cursos(id, nombre, nivel, anio_academico)')
    .order('id', { ascending: true })

  if (err) return { cursos: [], messageError: err.message }

  const filas = (data ?? []) as unknown as CursoProfesorFila[]
  const cursos = filas
    .map((f) => {
      const curso = cursoDesdeFila(f.cursos)
      return curso ? { asignacionId: f.id, curso } : null
    })
    .filter((x): x is CursoOpcionForm => Boolean(x))
    .sort((a, b) =>
      (a.curso.nombre + a.curso.nivel).localeCompare(
        b.curso.nombre + b.curso.nivel,
        'es',
        { sensitivity: 'base' },
      ),
    )

  return { cursos, messageError: null }
}
