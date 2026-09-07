import type { Item } from '@/types/database.types'
import type { TabWithFields } from '@/lib/queries/tabs'
import type { CategoryColor } from '@/types/database.types'
import { monthKey } from '@/lib/dates'

export interface ExpenseTab {
  id: string
  name: string
  color: CategoryColor
  total: number
}

export interface MonthBreakdown {
  month: string
  total: number
  /** Monto por pestaña, en el mismo orden que report.tabs. */
  porTab: number[]
}

export interface ExpenseReport {
  tabs: ExpenseTab[]
  months: MonthBreakdown[]
  maxMonthTotal: number
  grandTotal: number
}

/**
 * Solo participan las pestañas que eligieron un campo de monto
 * (amount_field_id). Una pestaña de tareas no es un gasto.
 */
export function buildExpenseReport(
  tabs: TabWithFields[],
  items: Item[],
  months: string[]
): ExpenseReport {
  const expenseTabs = tabs.filter((t) => t.amount_field_id !== null)
  const indexByTab = new Map(expenseTabs.map((t, i) => [t.id, i]))

  const acc = new Map<string, number[]>(
    months.map((m) => [m, new Array(expenseTabs.length).fill(0)])
  )

  for (const item of items) {
    const idx = indexByTab.get(item.tab_id)
    if (idx === undefined) continue

    const fila = acc.get(monthKey(item.date))
    if (!fila) continue

    const tab = expenseTabs[idx]
    const raw = item.custom_data[tab.amount_field_id as string]
    // Los montos viejos pueden haber quedado guardados como string, así que
    // se coerciona y se descarta lo que no sea un número usable.
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n)) continue

    fila[idx] += n
  }

  const breakdown: MonthBreakdown[] = months.map((m) => {
    const porTab = acc.get(m) as number[]
    return { month: m, porTab, total: porTab.reduce((a, b) => a + b, 0) }
  })

  const totalPorTab = expenseTabs.map((_, i) =>
    breakdown.reduce((sum, b) => sum + b.porTab[i], 0)
  )

  return {
    tabs: expenseTabs.map((t, i) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      total: totalPorTab[i]
    })),
    months: breakdown,
    maxMonthTotal: Math.max(0, ...breakdown.map((b) => b.total)),
    grandTotal: totalPorTab.reduce((a, b) => a + b, 0)
  }
}

const FORMATO_ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatARS(n: number): string {
  return FORMATO_ARS.format(n)
}
