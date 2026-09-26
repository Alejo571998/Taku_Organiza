/**
 * Genera public/og.png, la imagen que muestran LinkedIn, WhatsApp y compañía
 * al compartir el link.
 *
 * 1200x630 porque es la medida que LinkedIn renderiza grande; por debajo de
 * 1200 de ancho la degrada a una miniatura al costado del título.
 *
 * Se arma como SVG y se rasteriza, en vez de dibujar píxeles a mano, porque
 * así el fondo sale del mismo sistema de diseño que la app (los mismos navy,
 * los mismos dos glows, los mismos doce pasteles) y se edita leyéndolo.
 *
 * La tipografía es la del sistema y no Plus Jakarta Sans: @fontsource la
 * publica solo en woff/woff2 y el rasterizador lee ttf/otf. Como la imagen es
 * una pieza suelta y no una pantalla de la app, la diferencia no se nota.
 *
 * Uso:  node scripts/generar-og.mjs
 * Requiere:  npm install --no-save @resvg/resvg-js
 */
import fs from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { PNG } from 'pngjs'

const ANCHO = 1200
const ALTO = 630
const SALIDA = 'public/og.png'

// Los doce pasteles, en el mismo orden que src/lib/palette.ts.
const PASTELES = [
  '#98ebc4',
  '#b2d6b2',
  '#8ee2e0',
  '#94cefa',
  '#96b2ff',
  '#c1b3ff',
  '#d8b0f5',
  '#ffadd0',
  '#ffa69e',
  '#ffc29b',
  '#fae096',
  '#f0e6cd'
]

const taku = fs.readFileSync('public/taku-384.png').toString('base64')

const puntos = PASTELES.map(
  (color, i) => `<circle cx="${92 + i * 34}" cy="470" r="11" fill="${color}" />`
).join('\n    ')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#080c1a" />
      <stop offset="1" stop-color="#050812" />
    </linearGradient>
    <radialGradient id="luzFria" cx="0.1" cy="0.05" r="0.8">
      <stop offset="0" stop-color="#819eff" stop-opacity="0.26" />
      <stop offset="1" stop-color="#819eff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="luzCalida" cx="0.9" cy="0.95" r="0.75">
      <stop offset="0" stop-color="#ffb778" stop-opacity="0.20" />
      <stop offset="1" stop-color="#ffb778" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#5ee29e" stop-opacity="0.22" />
      <stop offset="1" stop-color="#5ee29e" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)" />
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#luzFria)" />
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#luzCalida)" />

  <!-- Halo detrás de Taku: lo despega del fondo sin recortarlo. -->
  <ellipse cx="930" cy="330" rx="290" ry="290" fill="url(#halo)" />

  <g font-family="Segoe UI Semibold, Segoe UI, Arial, sans-serif">
    <text x="90" y="252" font-size="124" font-weight="700" fill="#ecf1fa" letter-spacing="-3">TAKU</text>
    <text x="94" y="312" font-size="40" font-weight="600" fill="#8cf0bd">Tu día, en orden.</text>
    <text x="94" y="382" font-size="27" fill="#a5b2c9">Tareas, notas y gastos del día,</text>
    <text x="94" y="420" font-size="27" fill="#a5b2c9">en pestañas que armás vos.</text>
  </g>

  <!-- La paleta: dice de un vistazo que cada tarea lleva su color. -->
  <g>
    ${puntos}
  </g>

  <image href="data:image/png;base64,${taku}" x="735" y="105" width="450" height="450" />
</svg>`

const render = new Resvg(svg, {
  fitTo: { mode: 'width', value: ANCHO },
  background: '#080c1a',
  font: { loadSystemFonts: true }
})
const conAlfa = render.render().asPng()

/**
 * Se reescribe sin canal alfa. La imagen es opaca de punta a punta —el fondo
 * cubre todo— así que el alfa es un cuarto del archivo guardando 255 repetido.
 *
 * Importa porque WhatsApp deja de mostrar la miniatura cuando la imagen se
 * pasa de unos 300 KB, y con alfa quedaba justo arriba.
 */
const png = PNG.sync.write(PNG.sync.read(conAlfa), {
  colorType: 2,
  deflateLevel: 9,
  deflateStrategy: 3
})
fs.writeFileSync(SALIDA, png)

console.log(
  `${SALIDA}  ${ANCHO}x${ALTO}  ${(png.length / 1024).toFixed(0)} KB ` +
    `(sin alfa; con alfa eran ${(conAlfa.length / 1024).toFixed(0)} KB)`
)
