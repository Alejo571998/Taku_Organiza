import { useMemo, useState } from 'react'
import { useTabs } from '@/hooks/useTabs'
import { useItems } from '@/hooks/useItems'
import { buildExpenseReport, formatARS } from '@/lib/expenses'
import { currentMonthKey, lastMonths, monthStart, monthEnd, formatMes } from '@/lib/dates'
import { useSelectedTab } from '@/hooks/useSelectedTab'

const RANGOS = [3, 6, 12]

export default function ExpensesView() {
  const [cantidad, setCantidad] = useState(6)

  const months = useMemo(() => lastMonths(currentMonthKey(), cantidad), [cantidad])
  const from = monthStart(months[0])
  const to = monthEnd(months[months.length - 1])

  const [tabFiltro] = useSelectedTab()
  const { data: todasLasTabs } = useTabs()
  const tabs = tabFiltro ? todasLasTabs?.filter((t) => t.id === tabFiltro) : todasLasTabs
  const { data: items, isLoading, error } = useItems(from, to)

  const report = useMemo(
    () => (tabs && items ? buildExpenseReport(tabs, items, months) : null),
    [tabs, items, months]
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold">Comparativa mensual</h1>
        <div className="ml-auto inline-flex bg-surface-alt rounded p-1">
          {RANGOS.map((n) => (
            <button
              key={n}
              onClick={() => setCantidad(n)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                cantidad === n ? 'bg-surface text-text-primary font-medium' : 'text-text-secondary'
              }`}
            >
              {n} meses
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-text-muted italic">Cargando...</p>}
      {error && (
        <p className="text-sm text-danger">No se pudieron cargar los gastos. {error.message}</p>
      )}

      {report && report.tabs.length === 0 && (
        <p className="text-sm text-text-secondary">
          Ninguna pestaña tiene un campo de monto todavía. Editá una pestaña, agregale un campo de
          tipo <strong>Número</strong> o <strong>Moneda</strong>, y elegilo en la opción
          <em> Comparativa mensual usa</em>.
        </p>
      )}

      {report && report.tabs.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-5">
            {report.tabs.map((t) => (
              <span key={t.id} className="flex items-center gap-1.5 text-sm">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: `var(--cat-${t.color})` }}
                />
                {t.name}
                <span className="text-text-muted">{formatARS(t.total)}</span>
              </span>
            ))}
            <span className="ml-auto text-sm">
              Total <strong>{formatARS(report.grandTotal)}</strong>
            </span>
          </div>

          <div className="flex flex-col gap-2 mb-8">
            {report.months.map((m, mi) => {
              const previo = mi > 0 ? report.months[mi - 1].total : null
              const delta = previo && previo > 0 ? (m.total - previo) / previo : null
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-text-secondary shrink-0">
                    {formatMes(m.month)}
                  </span>

                  {/* Las barras se escalan contra el mes más alto del rango:
                      es lo que hace que la comparación se lea de un vistazo. */}
                  <div className="flex-1 h-7 bg-surface-alt rounded overflow-hidden flex">
                    {report.tabs.map((t, ti) => {
                      const monto = m.porTab[ti]
                      if (monto <= 0 || report.maxMonthTotal === 0) return null
                      return (
                        <div
                          key={t.id}
                          title={`${t.name}: ${formatARS(monto)}`}
                          style={{
                            width: `${(monto / report.maxMonthTotal) * 100}%`,
                            background: `var(--cat-${t.color})`
                          }}
                        />
                      )
                    })}
                  </div>

                  <span className="w-28 text-sm text-right shrink-0">{formatARS(m.total)}</span>
                  <span
                    className={`w-16 text-xs text-right shrink-0 ${
                      delta === null
                        ? 'text-text-muted'
                        : delta > 0
                          ? 'text-danger'
                          : 'text-text-secondary'
                    }`}
                  >
                    {delta === null ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}%`}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="text-sm border-collapse min-w-full">
              <thead>
                <tr className="text-text-secondary">
                  <th className="text-left font-normal py-2 pr-4">Pestaña</th>
                  {report.months.map((m) => (
                    <th
                      key={m.month}
                      className="text-right font-normal py-2 px-3 whitespace-nowrap"
                    >
                      {formatMes(m.month)}
                    </th>
                  ))}
                  <th className="text-right font-normal py-2 pl-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.tabs.map((t, ti) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: `var(--cat-${t.color}-text)` }}
                        />
                        {t.name}
                      </span>
                    </td>
                    {report.months.map((m) => (
                      <td
                        key={m.month}
                        className={`text-right py-2 px-3 whitespace-nowrap ${
                          m.porTab[ti] === 0 ? 'text-text-muted' : ''
                        }`}
                      >
                        {m.porTab[ti] === 0 ? '—' : formatARS(m.porTab[ti])}
                      </td>
                    ))}
                    <td className="text-right py-2 pl-3 font-medium whitespace-nowrap">
                      {formatARS(t.total)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border font-medium">
                  <td className="py-2 pr-4">Total</td>
                  {report.months.map((m) => (
                    <td key={m.month} className="text-right py-2 px-3 whitespace-nowrap">
                      {formatARS(m.total)}
                    </td>
                  ))}
                  <td className="text-right py-2 pl-3 whitespace-nowrap">
                    {formatARS(report.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
