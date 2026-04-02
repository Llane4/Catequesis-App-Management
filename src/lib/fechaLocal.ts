/** Fecha local del dispositivo en YYYY-MM-DD (coherente con tipo DATE en Supabase). */
export function fechaLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Título para listas de asistencia: "Hoy, 1 de abril", "Ayer, …", o "Lunes, …". */
export function tituloFechaListaAsistencia(fechaISO: string): string {
  const ref = new Date(fechaISO + 'T12:00:00')
  const hoy = new Date()
  const esMismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const esHoy = esMismoDia(ref, hoy)
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)
  const esAyer = esMismoDia(ref, ayer)

  const parteFecha = ref.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  })

  if (esHoy) return `Hoy, ${parteFecha}`
  if (esAyer) return `Ayer, ${parteFecha}`

  const diaSemana = ref.toLocaleDateString('es', { weekday: 'long' })
  const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
  return `${diaCapitalizado}, ${parteFecha}`
}
