import { useSearchParams } from 'react-router-dom'
import { todayISO } from '@/lib/dates'

/**
 * La fecha elegida vive en la URL (?d=YYYY-MM-DD) y no en estado local, para
 * que sobreviva a un refresh y se mantenga al saltar entre mes/semana/día.
 */
export function useSelectedDate(): [string, (iso: string) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('d')
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayISO()

  function setDate(iso: string) {
    const next = new URLSearchParams(params)
    next.set('d', iso)
    setParams(next, { replace: true })
  }

  return [date, setDate]
}
