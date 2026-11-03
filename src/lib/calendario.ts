/**
 * Pasar una tarea al calendario.
 *
 * Esto NO es sincronización: arma el link que abre Google Calendar con el
 * evento ya cargado y la persona confirma. Un toque por tarea.
 *
 * La sincronización de verdad —que lo que se crea acá aparezca solo allá—
 * necesita OAuth de Google, un proyecto en Google Cloud y un lugar en el
 * servidor donde guardar el token. Esto, en cambio, funciona hoy, sin
 * configurar nada y sin que TAKU tenga acceso permanente a su calendario,
 * que para una agenda personal no es poca cosa.
 */

/** Cuánto dura un evento con hora, si no se dice otra cosa. */
const DURACION_POR_DEFECTO_MIN = 60

const sinGuiones = (iso: string) => iso.replace(/-/g, '')

function sumarMinutos(fecha: string, hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const d = new Date(`${fecha}T00:00:00`)
  d.setHours(h, m + minutos, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

/** El día siguiente, para el fin de un evento de día entero (que es exclusivo). */
function diaSiguiente(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

export interface EventoParaCalendario {
  titulo: string
  fecha: string
  /** HH:MM o HH:MM:SS. Sin hora, va como evento de día entero. */
  hora?: string | null
  detalle?: string | null
}

/**
 * El cuerpo del evento. Va aparte porque también se arma para una tarea que
 * recién se guardó, cuando todavía no hay fila que leer.
 */
export function detalleDeEvento(
  nota?: string | null,
  nombreDePestana?: string | null
): string {
  return [nota, nombreDePestana ? `Pestaña: ${nombreDePestana}` : null, 'Creado en TAKU']
    .filter(Boolean)
    .join('\n')
}

export function urlGoogleCalendar(evento: EventoParaCalendario): string {
  const hora = evento.hora?.slice(0, 5)

  // Con hora se manda un rango de una hora; sin hora, un evento de día
  // entero, donde el fin es EXCLUSIVO: termina el día siguiente.
  const rango = hora
    ? `${sumarMinutos(evento.fecha, hora, 0)}/${sumarMinutos(evento.fecha, hora, DURACION_POR_DEFECTO_MIN)}`
    : `${sinGuiones(evento.fecha)}/${diaSiguiente(evento.fecha)}`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: evento.titulo,
    dates: rango
  })
  if (evento.detalle) params.set('details', evento.detalle)

  // La zona horaria se manda explícita: sin esto, Google interpreta la hora
  // en la zona de la cuenta, que no siempre es la del teléfono, y una
  // reunión de las 10 puede aparecer a las 14.
  if (hora) {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (zona) params.set('ctz', zona)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * El mismo evento como archivo .ics, que entienden Apple Calendar, Outlook y
 * cualquier otro. Google ya queda cubierto por el link de arriba, pero no
 * todo el mundo usa Google.
 */
export function archivoIcs(evento: EventoParaCalendario): string {
  const hora = evento.hora?.slice(0, 5)
  const inicio = hora ? sumarMinutos(evento.fecha, hora, 0) : sinGuiones(evento.fecha)
  const fin = hora
    ? sumarMinutos(evento.fecha, hora, DURACION_POR_DEFECTO_MIN)
    : diaSiguiente(evento.fecha)
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  // Las líneas del formato van separadas por CRLF; con \n solo, algunos
  // lectores rechazan el archivo entero.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TAKU//ES',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@taku`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    hora ? `DTSTART;TZID=${zona}:${inicio}` : `DTSTART;VALUE=DATE:${inicio}`,
    hora ? `DTEND;TZID=${zona}:${fin}` : `DTEND;VALUE=DATE:${fin}`,
    `SUMMARY:${escapar(evento.titulo)}`,
    evento.detalle ? `DESCRIPTION:${escapar(evento.detalle)}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .map(plegar)
    .join('\r\n')
}

/** En el formato, la coma y el punto y coma separan campos: van escapados. */
function escapar(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

/**
 * Parte las líneas largas como manda el formato: 75 octetos, y la
 * continuación arranca con un espacio. Una nota larga pasa ese límite sin
 * esfuerzo, y algunos lectores recortan la línea o rechazan el archivo.
 *
 * Se corta por caracter y se cuenta por byte: en UTF-8 una "é" ocupa dos, y
 * partirla al medio deja basura donde iba una letra.
 */
function plegar(linea: string): string {
  const medir = (t: string) => new TextEncoder().encode(t).length
  if (medir(linea) <= 75) return linea

  const partes: string[] = []
  let actual = ''
  let largo = 0
  for (const caracter of linea) {
    const n = medir(caracter)
    // La primera línea admite 75; las siguientes 74, porque el espacio de
    // continuación también cuenta.
    const tope = partes.length === 0 ? 75 : 74
    if (largo + n > tope) {
      partes.push(actual)
      actual = ''
      largo = 0
    }
    actual += caracter
    largo += n
  }
  partes.push(actual)
  return partes.join('\r\n ')
}

export function descargarIcs(evento: EventoParaCalendario) {
  const blob = new Blob([archivoIcs(evento)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${evento.titulo.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40) || 'tarea'}.ics`

  // Dos cuidados que parecen de más y no lo son:
  //
  // El ancla tiene que estar en el documento. Firefox ignora el click de un
  // nodo que nunca se agregó, así que ahí no pasaba nada: ni archivo ni error.
  //
  // Y la URL se libera DESPUÉS, no en la misma vuelta. Revocarla al toque
  // corta el blob antes de que la descarga lo lea, y el archivo baja vacío.
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 250)
}
