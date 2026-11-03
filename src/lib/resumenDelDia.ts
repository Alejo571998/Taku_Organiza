import { estadoDePago } from '@/lib/balance'
import type { FinMovement, Habit, Item } from '@/types/database.types'
import type { TabWithFields } from '@/lib/queries/tabs'

/**
 * El resumen hablado del día.
 *
 * Está escrito para ser ESCUCHADO, no leído, y eso cambia todo: nada de
 * símbolos ni listas ni abreviaturas, frases cortas, y los números redondeados
 * ("ciento ocho mil" y no "108.337,24", que en voz alta es una tortura).
 *
 * Y es corto a propósito. Un resumen que enumera quince tareas no es un
 * resumen: es la lista otra vez, y para eso ya está la pantalla.
 */

/** Cuántas tareas se nombran antes de pasar a "y tres más". */
const MAX_NOMBRADAS = 3

function lista(nombres: string[]): string {
  if (nombres.length === 0) return ''
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/** Redondea para que se pueda escuchar: 108337,24 se dice "108 mil". */
function montoHablado(n: number): string {
  if (n >= 1_000_000) {
    const millones = n / 1_000_000
    return `${millones.toFixed(millones < 10 ? 1 : 0).replace('.', ',')} millones de pesos`
  }
  if (n >= 1000) return `${Math.round(n / 1000)} mil pesos`
  return `${Math.round(n)} pesos`
}

function horaHablada(hora: string): string {
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  return m === 0 ? `a las ${h}` : `a las ${h} y ${m}`
}

export interface DatosDelResumen {
  tareas: Item[]
  pestanas: TabWithFields[]
  movimientos: FinMovement[]
  habitos: Habit[]
  /** Claves "habitId|fecha" de lo ya cumplido. */
  cumplidos: Set<string>
  hoy: string
}

export interface Resumen {
  /** Para leer en voz alta. */
  hablado: string
  /** Para mostrar en el globo. Mismo contenido, un poco más compacto. */
  escrito: string
  /** Si no hay nada pendiente, para que Taku festeje en vez de informar. */
  todoListo: boolean
}

export function armarResumen(datos: DatosDelResumen): Resumen {
  const { tareas, pestanas, movimientos, habitos, cumplidos, hoy } = datos
  const frases: string[] = []

  // --- Tareas ---
  const pendientes = tareas.filter((t) => !t.completed)
  const conHora = pendientes
    .filter((t) => t.time)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

  if (pendientes.length === 0) {
    frases.push(
      tareas.length > 0
        ? 'Ya terminaste todas las tareas de hoy.'
        : 'Hoy no tenés tareas anotadas.'
    )
  } else {
    frases.push(`Te ${pendientes.length === 1 ? 'queda' : 'quedan'} ${plural(pendientes.length, 'tarea', 'tareas')}.`)

    // Lo que tiene hora se nombra primero y con la hora: es lo único del día
    // que no se puede correr para más tarde.
    if (conHora.length > 0) {
      const dichas = conHora
        .slice(0, MAX_NOMBRADAS)
        .map((t) => `${t.title} ${horaHablada(t.time as string)}`)
      frases.push(`Con horario: ${lista(dichas)}.`)
    } else {
      const porPestana = new Map<string, number>()
      for (const t of pendientes) {
        const p = pestanas.find((x) => x.id === t.tab_id)
        const nombre = p?.name ?? 'sin pestaña'
        porPestana.set(nombre, (porPestana.get(nombre) ?? 0) + 1)
      }
      if (porPestana.size > 1) {
        const partes = [...porPestana.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_NOMBRADAS)
          .map(([nombre, n]) => `${n} de ${nombre}`)
        frases.push(`${lista(partes)}.`)
      }
    }
  }

  // --- Plata que vence ---
  const vencenHoy = movimientos.filter(
    (m) => m.kind === 'gasto' && m.due_date === hoy && estadoDePago(m) !== 'pagado'
  )
  const vencidos = movimientos.filter(
    (m) => m.kind === 'gasto' && m.due_date && m.due_date < hoy && estadoDePago(m) !== 'pagado'
  )

  if (vencenHoy.length > 0) {
    const total = vencenHoy.reduce((a, m) => a + (m.amount - m.paid_amount), 0)
    frases.push(
      vencenHoy.length === 1
        ? `Hoy vence ${vencenHoy[0].description}, ${montoHablado(total)}.`
        : `Hoy ${plural(vencenHoy.length, 'cuenta vence', 'cuentas vencen')}, ${montoHablado(total)} en total.`
    )
  }
  if (vencidos.length > 0) {
    const total = vencidos.reduce((a, m) => a + (m.amount - m.paid_amount), 0)
    frases.push(`Y tenés ${plural(vencidos.length, 'cuenta vencida', 'cuentas vencidas')} por ${montoHablado(total)}.`)
  }

  // --- Hábitos ---
  const diaDeLaSemana = new Date(`${hoy}T00:00:00`).getDay()
  const deHoy = habitos.filter(
    (h) => h.active && (h.weekdays.length === 0 || h.weekdays.includes(diaDeLaSemana))
  )
  const faltan = deHoy.filter((h) => !cumplidos.has(`${h.id}|${hoy}`))

  if (deHoy.length > 0) {
    if (faltan.length === 0) {
      frases.push('Los hábitos de hoy ya están todos.')
    } else if (faltan.length <= MAX_NOMBRADAS) {
      frases.push(`Te falta ${lista(faltan.map((h) => h.name.toLowerCase()))}.`)
    } else {
      frases.push(`Te faltan ${plural(faltan.length, 'hábito', 'hábitos')}.`)
    }
  }

  const todoListo =
    pendientes.length === 0 && vencenHoy.length === 0 && vencidos.length === 0 && faltan.length === 0

  if (todoListo) {
    return {
      hablado: 'Está todo al día. No te queda nada pendiente para hoy.',
      escrito: 'Todo al día. No te queda nada pendiente.',
      todoListo: true
    }
  }

  return {
    hablado: frases.join(' '),
    escrito: frases.join(' '),
    todoListo: false
  }
}
