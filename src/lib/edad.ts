/**
 * Edad en años cumplidos a partir de una fecha YYYY-MM-DD (zona horaria local).
 */
export function edadDesdeFechaNacimiento(
  fechaIso: string | null | undefined,
): number | null {
  if (!fechaIso?.trim()) return null
  const partes = fechaIso.trim().slice(0, 10).split('-')
  if (partes.length !== 3) return null
  const y = Number(partes[0])
  const m = Number(partes[1]) - 1
  const d = Number(partes[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null
  }
  const nac = new Date(y, m, d)
  if (
    nac.getFullYear() !== y ||
    nac.getMonth() !== m ||
    nac.getDate() !== d
  ) {
    return null
  }
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const diffMes = hoy.getMonth() - nac.getMonth()
  if (diffMes < 0 || (diffMes === 0 && hoy.getDate() < nac.getDate())) {
    edad--
  }
  return edad >= 0 ? edad : null
}
