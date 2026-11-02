export { formatARS } from '@/lib/expenses'

/**
 * Lee un monto escrito a mano.
 *
 * Un input type="number" se ve prolijo y es una trampa: en el celular cambia
 * el teclado según el navegador, rechaza la coma en algunos y la exige en
 * otros, y "1.234,56" —como se escribe acá— queda inválido. Así que el campo
 * es de texto y la interpretación pasa por acá.
 *
 * La regla, que cubre las dos formas de escribir:
 *
 *   hay coma  → la coma es el decimal y los puntos son miles.
 *               "1.234,56" → 1234.56
 *   no hay    → el punto es el decimal, como lo escribe una calculadora.
 *               "1234.56" → 1234.56     "1234" → 1234
 *
 * Devuelve null si no se entiende, para que quien llama avise en vez de
 * guardar un cero silencioso.
 */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, '').replace(/\$/g, '')
  if (!limpio) return null

  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio

  if (!/^-?\d*\.?\d*$/.test(normalizado)) return null

  const n = Number(normalizado)
  if (!Number.isFinite(n) || n < 0) return null

  // Dos decimales: la columna de la base es numeric(14,2) y guardar más
  // significa que lo que se ve y lo que se guarda dejan de coincidir.
  return Math.round(n * 100) / 100
}

/** Lo que se muestra dentro de un campo editable: sin símbolo, con coma. */
export function montoParaEditar(n: number): string {
  if (!n) return ''
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Versión corta para ejes y tarjetas: 1,2 M / 340 k / 1.250 */
export function formatCompacto(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (abs >= 10_000) return `${Math.round(n / 1000).toLocaleString('es-AR')} k`
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}
