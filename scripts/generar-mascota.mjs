/**
 * Genera los PNG de Taku a partir del arte original.
 *
 * Recorta el margen sobrante, centra en un lienzo cuadrado y saca los tamaños
 * finales a public/.
 *
 * Si el original NO trae canal alfa (como el primer taku-mascota.png, que era
 * RGB con fondo negro opaco), le borra el fondo con un flood fill desde los
 * bordes. Con Taku-definitivo.png, que ya viene con alfa, ese paso se saltea.
 *
 * El favicon NO se genera acá: se usa el que provee el proyecto.
 *
 * Uso:  node scripts/generar-mascota.mjs
 * Requiere pngjs:  npm install --no-save pngjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const ORIGEN = 'assets/img/Taku-definitivo.png'
const SALIDAS = [
  ['public/taku.png', 256],
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512]
]

/**
 * Umbral de "esto es fondo". El histograma del original muestra un valle
 * limpio: el fondo vive en 0-15 y los negros del dibujo (campera, pantalla
 * del celular, contornos) arrancan en 24. Con un umbral de 40 el relleno se
 * filtraba dentro del celular y le comía la pantalla.
 */
const UMBRAL = 18

const bytes = fs.readFileSync(ORIGEN)
// colorType 4 y 6 traen canal alfa. pngjs normaliza todo a RGBA al leer, asi
// que hay que mirar el byte 25 del IHDR para saber como venia el original.
const traeAlfa = bytes[25] === 4 || bytes[25] === 6
const src = PNG.sync.read(bytes)
const { width: w, height: h, data: d } = src

// --- 1. Recortar el fondo, solo si hace falta ----------------------------
// Con un original que ya trae alfa (Taku-definitivo.png) esto se saltea
// entero: recortar por color seria destructivo y de gusto.
if (!traeAlfa) {
// --- Flood fill desde los bordes ----------------------------------------
// Se borra solo el negro CONECTADO al borde. Los negros interiores están
// encerrados por el contorno verde del personaje, así que no se tocan.
const visto = new Uint8Array(w * h)
const pila = new Int32Array(w * h)
let sp = 0
const esFondo = (p) => Math.max(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) < UMBRAL
const meter = (p) => {
  if (!visto[p] && esFondo(p)) {
    visto[p] = 1
    pila[sp++] = p
  }
}

for (let x = 0; x < w; x++) {
  meter(x)
  meter((h - 1) * w + x)
}
for (let y = 0; y < h; y++) {
  meter(y * w)
  meter(y * w + w - 1)
}
while (sp > 0) {
  const p = pila[--sp]
  const x = p % w
  const y = (p / w) | 0
  if (x > 0) meter(p - 1)
  if (x < w - 1) meter(p + 1)
  if (y > 0) meter(p - w)
  if (y < h - 1) meter(p + w)
}
for (let p = 0; p < w * h; p++) if (visto[p]) d[p * 4 + 3] = 0

// --- 2. Desflecar el borde ----------------------------------------------
// Los píxeles opacos que tocan el fondo y quedaron oscuros son el antialias
// del contorno original contra el negro; se les baja el alfa proporcional.
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const p = y * w + x
    if (visto[p]) continue
    if (!(visto[p - 1] || visto[p + 1] || visto[p - w] || visto[p + w])) continue
    const m = Math.max(d[p * 4], d[p * 4 + 1], d[p * 4 + 2])
    if (m < UMBRAL * 2) d[p * 4 + 3] = Math.round((255 * m) / (UMBRAL * 2))
  }
}

} // fin del recorte de fondo

// --- 3. Recortar el margen y centrar en un lienzo cuadrado --------------
let minX = w
let minY = h
let maxX = -1
let maxY = -1
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 8) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
const bw = maxX - minX + 1
const bh = maxY - minY + 1
const lado = Math.max(bw, bh)
const offX = ((lado - bw) / 2) | 0
const offY = ((lado - bh) / 2) | 0

const cuadrado = new PNG({ width: lado, height: lado })
cuadrado.data.fill(0)
for (let y = 0; y < bh; y++) {
  for (let x = 0; x < bw; x++) {
    const o = ((minY + y) * w + (minX + x)) * 4
    const n = ((offY + y) * lado + (offX + x)) * 4
    cuadrado.data.set(d.subarray(o, o + 4), n)
  }
}

// --- 4. Reducir con caja, sobre alfa premultiplicado --------------------
// Sin premultiplicar, los píxeles transparentes (que son negros) se promedian
// con los opacos y dejan un halo oscuro en todo el contorno.
function reducir(origen, ladoOrigen, destino) {
  const out = new PNG({ width: destino, height: destino })
  const escala = ladoOrigen / destino
  for (let y = 0; y < destino; y++) {
    const y0 = (y * escala) | 0
    const y1 = Math.max(y0 + 1, ((y + 1) * escala) | 0)
    for (let x = 0; x < destino; x++) {
      const x0 = (x * escala) | 0
      const x1 = Math.max(x0 + 1, ((x + 1) * escala) | 0)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * ladoOrigen + sx) * 4
          const al = origen[i + 3] / 255
          r += origen[i] * al
          g += origen[i + 1] * al
          b += origen[i + 2] * al
          a += origen[i + 3]
          n++
        }
      }
      const alfa = a / n
      const j = (y * destino + x) * 4
      // Desmultiplicar para volver a color recto
      const k = alfa > 0 ? (n * 255) / (a || 1) : 0
      out.data[j] = Math.min(255, Math.round((r / n) * k))
      out.data[j + 1] = Math.min(255, Math.round((g / n) * k))
      out.data[j + 2] = Math.min(255, Math.round((b / n) * k))
      out.data[j + 3] = Math.round(alfa)
    }
  }
  return out
}

for (const [salida, tam] of SALIDAS) {
  fs.mkdirSync(path.dirname(salida), { recursive: true })
  const png = reducir(cuadrado.data, lado, tam)
  const buf = PNG.sync.write(png, { deflateLevel: 9 })
  fs.writeFileSync(salida, buf)
  console.log(`${salida.padEnd(28)} ${tam}x${tam}  ${(buf.length / 1024).toFixed(0)} KB`)
}

const comoVino = traeAlfa ? 'ya traía alfa, sin recorte de fondo' : 'sin alfa, fondo recortado'
console.log(`\norigen ${comoVino}; personaje ${bw}x${bh} centrado en ${lado}x${lado}`)
