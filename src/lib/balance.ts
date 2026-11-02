import { monthKey, monthStart, monthEnd, diaDelMes } from '@/lib/dates'
import { safeColor } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import type { FinCategory, FinMovement } from '@/types/database.types'

/**
 * Las cuentas del módulo de finanzas, todas acá y sin React adentro: son la
 * parte que tiene que estar bien sí o sí, y separadas se pueden leer de una
 * sentada y probar con datos armados a mano.
 *
 * Todo trabaja en centavos por dentro. Sumar pesos con decimales en coma
 * flotante acumula error —0,1 + 0,2 da 0,30000000000000004— y un balance que
 * cierra con tres centavos de diferencia hace dudar de todo lo demás.
 */

const aCentavos = (n: number) => Math.round(n * 100)
const aPesos = (c: number) => c / 100

export interface PorCategoria {
  id: string | null
  nombre: string
  color: PaletteKey
  total: number
  /** Porcentaje sobre el total de gastos del período, 0 a 100. */
  porcentaje: number
}

export interface PorDia {
  date: string
  dia: number
  gastos: number
  ingresos: number
}

export interface ResumenMes {
  mes: string
  /** Ingresos efectivamente registrados en el mes. */
  ingresos: number
  /** Todo lo que el mes cuesta, esté pago o no. */
  gastos: number
  /** De esos gastos, lo que ya salió. */
  pagado: number
  /** Lo que todavía falta pagar. */
  pendiente: number
  /** Ingresos reales menos gastos del mes. */
  balance: number
  /** Gasto promedio por día transcurrido del mes. */
  promedioDiario: number
  /** Gastos vencidos y sin saldar a la fecha dada. */
  vencido: number
  porDia: PorDia[]
  porCategoria: PorCategoria[]
}

function nombreYColor(
  categoryId: string | null,
  categorias: FinCategory[]
): { nombre: string; color: PaletteKey } {
  const c = categorias.find((x) => x.id === categoryId)
  // Un movimiento sin categoría se sigue contando: se perdería plata del total
  // por un detalle de organización.
  if (!c) return { nombre: 'Sin categoría', color: 'sky' }
  return { nombre: c.name, color: safeColor(c.color) }
}

/**
 * @param hoy fecha de referencia para "vencido" y para el promedio diario.
 *            Se pasa en vez de leer el reloj acá adentro para que la función
 *            sea pura y se pueda probar.
 */
export function resumenMes(
  mes: string,
  movimientos: FinMovement[],
  categorias: FinCategory[],
  hoy: string
): ResumenMes {
  const delMes = movimientos.filter((m) => monthKey(m.date) === mes)

  let ingresos = 0
  let gastos = 0
  let pagado = 0
  let vencido = 0

  const porDia = new Map<string, { gastos: number; ingresos: number }>()
  const porCat = new Map<string | null, number>()

  for (const m of delMes) {
    const monto = aCentavos(m.amount)
    const pago = aCentavos(m.paid_amount)
    const dia = porDia.get(m.date) ?? { gastos: 0, ingresos: 0 }

    if (m.kind === 'ingreso') {
      ingresos += monto
      dia.ingresos += monto
    } else {
      gastos += monto
      pagado += Math.min(pago, monto)
      dia.gastos += monto
      porCat.set(m.category_id, (porCat.get(m.category_id) ?? 0) + monto)
      // Vencido es deuda real: ya pasó la fecha y todavía falta plata.
      if (m.due_date && m.due_date < hoy && pago < monto) vencido += monto - pago
    }

    porDia.set(m.date, dia)
  }

  const desde = monthStart(mes)
  const hasta = monthEnd(mes)
  // Si el mes ya terminó se promedia sobre el mes entero; si está en curso,
  // sobre los días transcurridos. Dividir un mes a medio andar por 30 daría
  // un promedio falsamente bajo todos los días 5.
  const diasContados =
    hoy > hasta ? diaDelMes(hasta) : hoy < desde ? diaDelMes(hasta) : diaDelMes(hoy)

  const totalGastos = gastos
  const categoriasOrdenadas: PorCategoria[] = [...porCat.entries()]
    .map(([id, total]) => ({
      id,
      ...nombreYColor(id, categorias),
      total: aPesos(total),
      porcentaje: totalGastos === 0 ? 0 : (total / totalGastos) * 100
    }))
    .sort((a, b) => b.total - a.total)

  const dias: PorDia[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      dia: diaDelMes(date),
      gastos: aPesos(v.gastos),
      ingresos: aPesos(v.ingresos)
    }))

  return {
    mes,
    ingresos: aPesos(ingresos),
    gastos: aPesos(gastos),
    pagado: aPesos(pagado),
    pendiente: aPesos(gastos - pagado),
    balance: aPesos(ingresos - gastos),
    promedioDiario: aPesos(Math.round(gastos / Math.max(1, diasContados))),
    vencido: aPesos(vencido),
    porDia: dias,
    porCategoria: categoriasOrdenadas
  }
}

export interface MesDelAnio {
  mes: string
  gastos: number
  ingresos: number
  balance: number
}

export interface ResumenAnual {
  anio: number
  meses: MesDelAnio[]
  gastos: number
  ingresos: number
  balance: number
  /** Promedio mensual sobre los meses que tienen algún movimiento. */
  promedioMensual: number
}

export function resumenAnual(anio: number, movimientos: FinMovement[]): ResumenAnual {
  const meses: MesDelAnio[] = Array.from({ length: 12 }, (_, i) => ({
    mes: `${anio}-${String(i + 1).padStart(2, '0')}`,
    gastos: 0,
    ingresos: 0,
    balance: 0
  }))

  const centavos = meses.map(() => ({ gastos: 0, ingresos: 0 }))

  for (const m of movimientos) {
    if (!m.date.startsWith(String(anio))) continue
    const i = Number(m.date.slice(5, 7)) - 1
    if (i < 0 || i > 11) continue
    if (m.kind === 'ingreso') centavos[i].ingresos += aCentavos(m.amount)
    else centavos[i].gastos += aCentavos(m.amount)
  }

  let gastos = 0
  let ingresos = 0
  let conMovimientos = 0

  centavos.forEach((c, i) => {
    meses[i].gastos = aPesos(c.gastos)
    meses[i].ingresos = aPesos(c.ingresos)
    meses[i].balance = aPesos(c.ingresos - c.gastos)
    gastos += c.gastos
    ingresos += c.ingresos
    if (c.gastos > 0 || c.ingresos > 0) conMovimientos++
  })

  return {
    anio,
    meses,
    gastos: aPesos(gastos),
    ingresos: aPesos(ingresos),
    balance: aPesos(ingresos - gastos),
    promedioMensual: aPesos(Math.round(gastos / Math.max(1, conMovimientos)))
  }
}

/** Estado de pago de un movimiento, para pintarlo. */
export type EstadoPago = 'pagado' | 'parcial' | 'pendiente'

export function estadoDePago(m: FinMovement): EstadoPago {
  if (m.paid_amount <= 0) return 'pendiente'
  if (aCentavos(m.paid_amount) >= aCentavos(m.amount)) return 'pagado'
  return 'parcial'
}
