/**
 * Fechas en local, nunca UTC.
 *
 * new Date('2026-09-06') se parsea como medianoche UTC, que en Argentina
 * (UTC-3) cae el 5 a las 21:00 y se muestra como el día anterior. Lo mismo
 * al revés con toISOString(). Estos helpers evitan esa clase de bug.
 */

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

const FORMATO_LARGO = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
})

export function formatLargo(iso: string): string {
  return FORMATO_LARGO.format(fromISODate(iso))
}

export function esHoy(iso: string): boolean {
  return iso === todayISO()
}

// ---------- meses ----------
// Un "monthKey" es 'YYYY-MM'. Se opera sobre el string y no sobre Date para
// no reintroducir el problema de zona horaria que arreglan los helpers de arriba.

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function currentMonthKey(): string {
  return monthKey(todayISO())
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthStart(key: string): string {
  return `${key}-01`
}

export function monthEnd(key: string): string {
  const [y, m] = key.split('-').map(Number)
  // Día 0 del mes siguiente = último día de este mes, sin tablas de días.
  const dias = new Date(y, m, 0).getDate()
  return `${key}-${String(dias).padStart(2, '0')}`
}

/** Los últimos `count` meses, del más viejo al más nuevo, terminando en `end`. */
export function lastMonths(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(end, i - count + 1))
}

const FORMATO_MES = new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' })

export function formatMes(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return FORMATO_MES.format(new Date(y, m - 1, 1)).replace('.', '')
}

// ---------- semanas y grilla mensual ----------

/** Lunes de la semana que contiene a `iso` (convención local, no domingo). */
export function startOfWeek(iso: string): string {
  const d = fromISODate(iso)
  const dow = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

export function weekDays(iso: string): string[] {
  const lunes = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
}

/**
 * Días de la grilla del mes, arrancando el lunes de la primera semana y
 * completando la última. Trae días de los meses vecinos a propósito, para
 * que la grilla no quede dentada.
 */
export function monthGrid(key: string): string[] {
  const fin = monthEnd(key)
  const cells: string[] = []
  let cur = startOfWeek(monthStart(key))
  // Comparar ISO como string alcanza: 'YYYY-MM-DD' ordena igual que la fecha.
  while (cur <= fin || cells.length % 7 !== 0) {
    cells.push(cur)
    cur = addDays(cur, 1)
  }
  return cells
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const FORMATO_CORTO = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

export function formatCorto(iso: string): string {
  return FORMATO_CORTO.format(fromISODate(iso)).replace('.', '')
}

export function diaDelMes(iso: string): number {
  return Number(iso.slice(8, 10))
}

const FORMATO_MES_LARGO = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })

export function formatMesLargo(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return FORMATO_MES_LARGO.format(new Date(y, m - 1, 1))
}
