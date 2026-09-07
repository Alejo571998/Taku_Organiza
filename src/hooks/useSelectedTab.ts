import { useSearchParams } from 'react-router-dom'

/**
 * Pestaña activa en la barra inferior, guardada en la URL (?tab=<id>).
 * `null` = todas.
 *
 * Va en la URL y no en estado local por lo mismo que la fecha: sobrevive al
 * refresh y se mantiene al saltar entre mes, semana, día y gastos.
 */
export function useSelectedTab(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const tabId = params.get('tab')

  function setTabId(id: string | null) {
    const next = new URLSearchParams(params)
    if (id) next.set('tab', id)
    else next.delete('tab')
    setParams(next, { replace: true })
  }

  return [tabId, setTabId]
}
