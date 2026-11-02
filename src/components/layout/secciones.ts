/**
 * Las secciones de la app, en un solo lugar.
 *
 * Las usan la barra lateral de escritorio y las píldoras del celular: son dos
 * formas de la misma lista. Si viviera duplicada, agregar una sección querría
 * decir acordarse de los dos lados, y tarde o temprano una se olvida.
 *
 * El orden es el del día de alguien: primero lo que pasa hoy, después el
 * planificador, después la plata y los hábitos.
 */
export interface Seccion {
  path: string
  label: string
  /** Se dibuja con la tipografía, sin cargar una librería de íconos. */
  icono: string
  /** Corto, para la barra de píldoras del celular. */
  corto?: string
}

export const SECCIONES: Seccion[] = [
  { path: '/', label: 'Resumen', icono: '◳' },
  { path: '/dia', label: 'Día', icono: '☀' },
  { path: '/semana', label: 'Semana', icono: '▦' },
  { path: '/mes', label: 'Mes', icono: '▤' },
  { path: '/finanzas', label: 'Finanzas', icono: '$' },
  { path: '/habitos', label: 'Hábitos', icono: '✓' },
  { path: '/gastos', label: 'Comparativa', icono: '∿', corto: 'Compar.' }
]
