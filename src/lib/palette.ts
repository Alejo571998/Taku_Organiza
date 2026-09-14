/**
 * Paleta pastel de TAKU. Única fuente de verdad.
 *
 * En la base se guarda la CLAVE ('mint'), nunca el hex: así se puede
 * recalibrar cualquier tono sin migrar datos. Los valores viven en
 * index.css como tripletas RGB (`--pastel-mint: 152 232 199`), que es lo
 * que permite aplicarles opacidad desde Tailwind y desde style inline.
 */
export const PALETTE = [
  { key: 'mint', label: 'Menta' },
  { key: 'sage', label: 'Salvia' },
  { key: 'aqua', label: 'Agua' },
  { key: 'sky', label: 'Cielo' },
  { key: 'blue', label: 'Azul' },
  { key: 'lavender', label: 'Lavanda' },
  { key: 'lilac', label: 'Lila' },
  { key: 'pink', label: 'Rosa' },
  { key: 'coral', label: 'Coral' },
  { key: 'peach', label: 'Durazno' },
  { key: 'butter', label: 'Manteca' },
  { key: 'cream', label: 'Crema' }
] as const

export type PaletteKey = (typeof PALETTE)[number]['key']

export const PALETTE_KEYS = PALETTE.map((c) => c.key) as readonly PaletteKey[]

export const DEFAULT_COLOR: PaletteKey = 'sky'

/** Convierte cualquier valor guardado en una clave válida. */
export function safeColor(value: string | null | undefined): PaletteKey {
  return PALETTE_KEYS.includes(value as PaletteKey) ? (value as PaletteKey) : DEFAULT_COLOR
}

/**
 * Color efectivo de un ítem: el propio si lo eligió, si no el de su
 * pestaña. Que un ítem sin color herede el de la pestaña es lo que hace
 * que los ítems viejos sigan viéndose coherentes sin tocarles un dato.
 */
export function itemColor(
  itemColorKey: string | null | undefined,
  tabColorKey: string | null | undefined
): PaletteKey {
  return itemColorKey ? safeColor(itemColorKey) : safeColor(tabColorKey)
}

/** `rgb(var(--pastel-x) / alpha)`, para usar en `style`. */
export function pastel(key: PaletteKey, alpha = 1): string {
  return `rgb(var(--pastel-${key}) / ${alpha})`
}
