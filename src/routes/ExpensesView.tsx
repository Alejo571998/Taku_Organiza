import { useMemo, useState } from 'react'
import { useTabs } from '@/hooks/useTabs'
import { useItems } from '@/hooks/useItems'
import { buildExpenseReport, formatARS } from '@/lib/expenses'
import { currentMonthKey, lastMonths, monthStart, monthEnd, formatMes } from '@/lib/dates'
import { pastel, safeColor } from '@/lib/palette'
import TakuVacio from '@/components/taku/TakuVacio'

const RANGOS = [3, 6, 12]

export default function ExpensesView() {
  const [cantidad, setCantidad] = useState(6)

  const months = useMemo(() => lastMonths(currentMonthKey(), cantidad), [cantidad])
  const from = monthStart(months[0])
  const to = monthEnd(months[months.length - 1])

  const { data: tabs } = useTabs()
  const { data: items, isLoading, error } = useItems(from, to)

  const report = useMemo(
    () => (tabs && items ? buildExpenseReport(tabs, items, months) : null),
    [tabs, items, months]
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Comparativa mensual</h1>
        <div className="glass ml-auto inline-flex rounded-pill p-1">
          {RANGOS.map((n) => (
            <button
              key={n}
              onClick={() => setCantidad(n)}
              className={`rounded-pill px-3 py-1.5 text-sm transition-all ${
                cantidad === n
                  ? 'bg-white/10 font-semibold text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {n} meses
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm italic text-text-muted">Cargando…</p>}
      {error && (
        <p className="rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">
          No se pudieron cargar los gastos. {error.message}
        </p>
      )}

      {report && report.tabs.length === 0 && (
        <TakuVacio
          titulo="Todavía no hay montos que comparar"
          detalle={
            <>
              Editá una pestaña, agregale un campo de tipo{' '}
              <strong className="text-text-primary">Número</strong> o{' '}
              <strong className="text-text-primary">Moneda</strong>, y elegilo en la opción
              <em> Comparativa mensual usa</em>.
            </>
          }
        />
      )}

      {report && report.tabs.length > 0 && (
        <>
          <div className="glass mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card px-4 py-3">
            {report.tabs.map((t) => (
              <span key={t.id} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: pastel(safeColor(t.color), 1) }}
                />
                {t.name}
                <span className="text-text-muted">{formatARS(t.total)}</span>
              </span>
            ))}
            <span className="ml-auto text-sm">
              Total <strong className="text-accent-text">{formatARS(report.grandTotal)}</strong>
            </span>
          </div>

          <div className="glass mb-6 flex flex-col gap-2.5 rounded-card px-4 py-4">
            {report.months.map((m, mi) => {
              const previo = mi > 0 ? report.months[mi - 1].total : null
              const delta = previo && previo > 0 ? (m.total - previo) / previo : null
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-xs text-text-muted">
                    {formatMes(m.month)}
                  </span>

                  {/* Las barras se escalan contra el mes más alto del rango:
                      es lo que hace que la comparación se lea de un vistazo. */}
                  <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-black/30">
                    {report.tabs.map((t, ti) => {
                      const monto = m.porTab[ti]
                      if (monto <= 0 || report.maxMonthTotal === 0) return null
                      const c = safeColor(t.color)
                      return (
                        <div
                          key={t.id}
                          title={`${t.name}: ${formatARS(monto)}`}
                          style={{
                            width: `${(monto / report.maxMonthTotal) * 100}%`,
                            background: `linear-gradient(180deg, ${pastel(c, 0.9)}, ${pastel(c, 0.55)})`
                          }}
                        />
                      )
                    })}
                  </div>

                  <span className="w-24 shrink-0 text-right text-xs sm:w-28 sm:text-sm">
                    {formatARS(m.total)}
                  </span>
                  <span
                    className={`w-12 shrink-0 text-right text-xs ${
                      delta === null
                        ? 'text-text-muted'
                        : delta > 0
                          ? 'text-danger'
                          : 'text-accent-text'
                    }`}
                  >
                    {delta === null ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}%`}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="glass overflow-x-auto rounded-card px-4 py-3">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-text-muted">
                  <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide">
                    Pestaña
                  </th>
                  {report.months.map((m) => (
                    <th
                      key={m.month}
                      className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wide"
                    >
                      {formatMes(m.month)}
                    </th>
                  ))}
                  <th className="py-2 pl-3 text-right text-xs font-medium uppercase tracking-wide">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.tabs.map((t, ti) => (
                  <tr key={t.id} className="border-t border-white/[0.07]">
                    <td className="whitespace-nowrap py-2.5 pr-4">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: pastel(safeColor(t.color), 1) }}
                        />
                        {t.name}
                      </span>
                    </td>
                    {report.months.map((m) => (
                      <td
                        key={m.month}
                        className={`whitespace-nowrap px-3 py-2.5 text-right ${
                          m.porTab[ti] === 0 ? 'text-text-muted' : ''
                        }`}
                      >
                        {m.porTab[ti] === 0 ? '—' : formatARS(m.porTab[ti])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap py-2.5 pl-3 text-right font-medium">
                      {formatARS(t.total)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-white/15 font-semibold">
                  <td className="py-2.5 pr-4">Total</td>
                  {report.months.map((m) => (
                    <td key={m.month} className="whitespace-nowrap px-3 py-2.5 text-right">
                      {formatARS(m.total)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap py-2.5 pl-3 text-right text-accent-text">
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
