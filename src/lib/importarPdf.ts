import type { MovementKind } from '@/types/database.types'

/**
 * Lectura de resúmenes en PDF.
 *
 * TODO PASA EN EL NAVEGADOR. El PDF no se sube a ningún lado: ni a Supabase
 * ni a un servicio de terceros. Es el resumen bancario de alguien, con sus
 * consumos y su saldo; mandarlo a procesar afuera sería pedirle que confíe en
 * un servidor para algo que se puede hacer en su propia máquina.
 *
 * NO ADIVINA NI GUARDA SOLO. Cada resumen tiene su formato y no hay parser
 * que acierte todos, así que esto detecta candidatos y la persona revisa,
 * corrige y confirma antes de que se guarde una sola fila. Plata mal cargada
 * en silencio es peor que no tener la función.
 */

export interface LineaDetectada {
  /** Identificador local, para la tabla de revisión. */
  id: string
  /** La línea cruda del PDF. Se muestra para poder verificar lo detectado. */
  cruda: string
  fecha: string | null
  descripcion: string
  monto: number | null
  kind: MovementKind
  installment: number | null
  installments: number | null
  /** Arranca en false si parece un total o un saldo, no un movimiento. */
  incluir: boolean
  /** Por qué se desmarcó, para que no parezca un capricho. */
  motivo?: string
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12
}

/**
 * Líneas que un resumen trae pero NO son movimientos: sumarlas contaría dos
 * veces lo mismo. No se descartan, se muestran desmarcadas: cada banco las
 * nombra distinto y quien mira el papel sabe mejor que esta lista.
 */
const NO_SON_MOVIMIENTOS = [
  'saldo anterior', 'saldo al', 'saldo actual', 'saldo final', 'total',
  'subtotal', 'limite de compra', 'límite de compra', 'limite', 'página',
  'pagina', 'cbu', 'cuit', 'vencimiento actual', 'pago minimo', 'pago mínimo',
  'estado de cuenta', 'resumen de cuenta'
]

/**
 * El pago del resumen anterior. Aparece en todos los resúmenes de tarjeta y
 * NO es un consumo ni un ingreso: es la plata con la que se saldó el mes
 * pasado, que ya está contada como gasto en otro lado. Importarla sumaría
 * dos veces lo mismo.
 *
 * Va aparte de los totales porque merece su propia explicación: desmarcarla
 * sin decir por qué parecería un error del programa.
 */
const PAGOS_DEL_RESUMEN = ['su pago', 'pago recibido', 'pagos del periodo', 'pagos del período']

/** Palabras que delatan plata que ENTRA, no que sale. */
const SUENA_A_INGRESO = [
  'su pago', 'pago recibido', 'acreditacion', 'acreditación', 'abono',
  'deposito', 'depósito', 'haber', 'credito recibido', 'transferencia recibida',
  'devolucion', 'devolución', 'reintegro', 'ajuste a favor'
]

/**
 * Montos como se escriben acá: 1.234,56 con punto de miles y coma decimal.
 * También acepta 1234.56, que es como lo escribe una calculadora, y los
 * negativos con el signo adelante, atrás o entre paréntesis.
 */
const MONTO = /\(?-?\s*\$?\s*-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?-?\)?|\(?-?\$?\s*\d+(?:\.\d{1,2})?-?\)?/g

function parsearMontoDeTexto(bruto: string): number | null {
  const negativo = /^\(|\)$|-\s*$|^\s*-/.test(bruto.trim())
  const limpio = bruto.replace(/[()$\s-]/g, '')
  if (!limpio) return null

  // Con coma, la coma es el decimal y los puntos son miles. Sin coma, un
  // punto con exactamente dos decimales es decimal; si no, es de miles.
  let normalizado: string
  if (limpio.includes(',')) {
    normalizado = limpio.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{1,2}$/.test(limpio)) {
    normalizado = limpio
  } else {
    normalizado = limpio.replace(/\./g, '')
  }

  const n = Number(normalizado)
  if (!Number.isFinite(n) || n === 0) return null
  return negativo ? -Math.abs(n) : n
}

/** Todos los montos de una línea, con su posición, de izquierda a derecha. */
function montosDeLinea(linea: string): { valor: number; texto: string; fin: number }[] {
  const salida: { valor: number; texto: string; fin: number }[] = []
  for (const m of linea.matchAll(MONTO)) {
    const texto = m[0]
    // Un número suelto de uno o dos dígitos casi nunca es plata: es un día,
    // un número de cuota o una columna. Pedir decimales o cuatro dígitos
    // saca casi todo ese ruido.
    if (!/[,.]\d{1,2}\b/.test(texto) && !/\d{4,}/.test(texto.replace(/[.\s]/g, ''))) continue
    const valor = parsearMontoDeTexto(texto)
    if (valor === null) continue
    salida.push({ valor, texto, fin: (m.index ?? 0) + texto.length })
  }
  return salida
}

function dosDigitos(n: number) {
  return String(n).padStart(2, '0')
}

/** Busca la fecha al principio de la línea, que es donde la ponen todos. */
function fechaDeLinea(linea: string, anio: number): { iso: string; largo: number } | null {
  const numerica = linea.match(/^\s*(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/)
  if (numerica) {
    const d = Number(numerica[1])
    const m = Number(numerica[2])
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      let a = numerica[3] ? Number(numerica[3]) : anio
      if (a < 100) a += 2000
      return { iso: `${a}-${dosDigitos(m)}-${dosDigitos(d)}`, largo: numerica[0].length }
    }
  }

  const conMes = linea.match(/^\s*(\d{1,2})[\s-]*([A-Za-zÁÉÍÓÚáéíóú]{3})[\s-]*(\d{2,4})?/)
  if (conMes) {
    const d = Number(conMes[1])
    const m = MESES[conMes[2].toLowerCase()]
    if (m && d >= 1 && d <= 31) {
      let a = conMes[3] ? Number(conMes[3]) : anio
      if (a < 100) a += 2000
      return { iso: `${a}-${dosDigitos(m)}-${dosDigitos(d)}`, largo: conMes[0].length }
    }
  }

  return null
}

/** "C.03/12", "CUOTA 3 DE 12". Se exige la palabra: 03/12 solo es una fecha. */
function cuotaDeTexto(texto: string): { n: number; de: number } | null {
  const m = texto.match(/\b(?:cuota|cuot|c\.?)\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i)
  if (!m) return null
  const n = Number(m[1])
  const de = Number(m[2])
  if (n >= 1 && de >= 1 && n <= de && de <= 60) return { n, de }
  return null
}

export interface OpcionesParseo {
  anio: number
  /**
   * Qué número de la línea es el importe.
   *
   * En los resúmenes de tarjeta el importe es el último. En los extractos
   * bancarios el último suele ser el SALDO que va corriendo, y el importe es
   * el anterior. No hay forma de saberlo mirando una línea sola, así que se
   * elige una vez y se ve el resultado en la tabla.
   */
  columna: 'ultimo' | 'anteultimo'
}

export function parsearLineas(lineas: string[], opciones: OpcionesParseo): LineaDetectada[] {
  const salida: LineaDetectada[] = []

  lineas.forEach((cruda, i) => {
    const linea = cruda.replace(/\s+/g, ' ').trim()
    if (linea.length < 6) return

    const fecha = fechaDeLinea(linea, opciones.anio)
    const montos = montosDeLinea(linea)
    // Sin fecha o sin monto no es un movimiento: es un encabezado, una
    // leyenda o el pie de página.
    if (!fecha || montos.length === 0) return

    const elegido =
      opciones.columna === 'anteultimo' && montos.length >= 2
        ? montos[montos.length - 2]
        : montos[montos.length - 1]

    // La descripción es lo que queda sacando la fecha del principio y los
    // números del final.
    const descripcion = linea
      .slice(fecha.largo, Math.min(...montos.map((m) => m.fin - m.texto.length)))
      .replace(/[\s|.\-]+$/, '')
      .trim()

    const enMinusculas = linea.toLowerCase()
    const esTotal = NO_SON_MOVIMIENTOS.find((p) => enMinusculas.includes(p))
    const esPago = PAGOS_DEL_RESUMEN.find((p) => enMinusculas.includes(p))
    const motivo = esTotal
      ? `Parece un total o un saldo ("${esTotal}")`
      : esPago
        ? 'Es el pago del resumen anterior, no un consumo'
        : undefined
    const entra =
      elegido.valor < 0 || SUENA_A_INGRESO.some((p) => enMinusculas.includes(p))
    const cuota = cuotaDeTexto(linea)

    salida.push({
      id: `l${i}`,
      cruda: linea,
      fecha: fecha.iso,
      descripcion: descripcion || linea.slice(fecha.largo).trim() || 'Sin descripción',
      monto: Math.abs(elegido.valor),
      kind: entra ? 'ingreso' : 'gasto',
      installment: cuota?.n ?? null,
      installments: cuota?.de ?? null,
      incluir: !motivo,
      motivo
    })
  })

  return salida
}

export interface TextoDePdf {
  lineas: string[]
  paginas: number
}

/**
 * Saca el texto del PDF, en el navegador.
 *
 * pdf.js se carga con import dinámico y no arriba del archivo: pesa más que
 * toda la app junta, y quien nunca importa un resumen no tiene por qué
 * bajarlo.
 *
 * Los ítems de texto vienen sueltos con sus coordenadas, no en renglones, así
 * que se agrupan por la altura (y) y se ordenan por la horizontal (x). Sin
 * eso, la fecha y el importe de una misma fila llegan como piezas separadas y
 * no hay línea que parsear.
 */
export async function extraerTextoDePdf(archivo: File): Promise<TextoDePdf> {
  const pdfjs = await import('pdfjs-dist/build/pdf.min.mjs')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const datos = new Uint8Array(await archivo.arrayBuffer())
  // La tarea de carga es la que se destruye, no el documento: es la que tiene
  // agarrado el worker. Y el total de páginas se lee ANTES de soltarla.
  const tarea = pdfjs.getDocument({ data: datos })
  const doc = await tarea.promise
  const paginas = doc.numPages

  const lineas: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p)
    const contenido = await pagina.getTextContent()

    const porAltura = new Map<number, { x: number; texto: string }[]>()
    for (const item of contenido.items as { str: string; transform: number[] }[]) {
      if (!item.str?.trim()) continue
      // Se redondea la altura: dos piezas de la misma fila difieren en
      // decimales y si no, cada una sería su propio renglón.
      const y = Math.round(item.transform[5])
      const fila = porAltura.get(y) ?? []
      fila.push({ x: item.transform[4], texto: item.str })
      porAltura.set(y, fila)
    }

    for (const y of [...porAltura.keys()].sort((a, b) => b - a)) {
      const fila = porAltura.get(y)!.sort((a, b) => a.x - b.x)
      lineas.push(fila.map((f) => f.texto).join(' '))
    }
  }

  await tarea.destroy()
  return { lineas, paginas }
}
