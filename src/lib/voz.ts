/**
 * La voz de Taku.
 *
 * Usa el sintetizador que ya trae el navegador. No hay servicio externo, no
 * hay clave de API, no cuesta nada y el texto no sale del dispositivo. Para
 * leer en voz alta "te quedan tres tareas" eso alcanza de sobra.
 *
 * Lo que esto NO es: Taku todavía no entiende lo que se le dice ni improvisa
 * respuestas. Lee lo que la app ya sabe. Conversar de verdad necesita un
 * modelo detrás, y eso es otra cosa (y cuesta plata).
 */

const PREFERIDAS = ['es-AR', 'es-419', 'es-MX', 'es-US', 'es-ES', 'es']

export function puedeHablar(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Las voces se cargan de forma asincrónica y la primera vez suelen venir
 * vacías: hay que esperar el evento. Sin esto, el primer "hablá" sale con la
 * voz por defecto del sistema, que puede ser en inglés leyendo español.
 */
function vozEnEspanol(): SpeechSynthesisVoice | null {
  const voces = window.speechSynthesis.getVoices()
  if (voces.length === 0) return null
  for (const etiqueta of PREFERIDAS) {
    const v = voces.find((x) => x.lang.toLowerCase().startsWith(etiqueta.toLowerCase()))
    if (v) return v
  }
  return null
}

let vocesListas = false
function prepararVoces(): Promise<void> {
  if (!puedeHablar() || vocesListas) return Promise.resolve()
  if (window.speechSynthesis.getVoices().length > 0) {
    vocesListas = true
    return Promise.resolve()
  }
  return new Promise((resolver) => {
    const alCargar = () => {
      vocesListas = true
      window.speechSynthesis.removeEventListener('voiceschanged', alCargar)
      resolver()
    }
    window.speechSynthesis.addEventListener('voiceschanged', alCargar)
    // Si el navegador nunca dispara el evento, no se queda esperando para
    // siempre: habla con lo que haya.
    setTimeout(alCargar, 1200)
  })
}

/**
 * Lee el texto en voz alta.
 *
 * Tiene que salir de un gesto de la persona (un toque): iOS y Chrome
 * bloquean el audio que arranca solo, y es la decisión correcta — una app
 * que empieza a hablar sin que la toquen es una app que se desinstala.
 */
export async function hablar(texto: string): Promise<void> {
  if (!puedeHablar() || !texto.trim()) return
  await prepararVoces()

  // Cortar lo anterior antes de empezar: si no, los mensajes se encolan y
  // Taku sigue hablando de algo que ya no está en pantalla.
  window.speechSynthesis.cancel()

  const frase = new SpeechSynthesisUtterance(texto)
  const voz = vozEnEspanol()
  if (voz) frase.voice = voz
  frase.lang = voz?.lang ?? 'es-AR'
  // Un poco más lento que el default, que para el español suena atropellado.
  frase.rate = 0.98
  frase.pitch = 1.05

  window.speechSynthesis.speak(frase)
}

export function callarVoz() {
  if (puedeHablar()) window.speechSynthesis.cancel()
}

export function estaHablando(): boolean {
  return puedeHablar() && window.speechSynthesis.speaking
}

/**
 * Destraba el audio, de forma SINCRÓNICA.
 *
 * iOS y Safari solo dejan hablar dentro del gesto que lo pidió, y el permiso
 * se pierde apenas hay un await en el medio. El resumen tarda: hay que ir a
 * buscar las tareas, la plata y los hábitos. Para cuando vuelven los datos, el
 * gesto ya venció y el navegador calla a Taku sin avisar.
 *
 * Así que en el mismo instante del toque se emite algo mínimo —que destraba el
 * audio— y el texto de verdad sale después, cuando llegan los datos.
 */
export function despertarVoz() {
  if (!puedeHablar()) return
  const chispa = new SpeechSynthesisUtterance(' ')
  chispa.volume = 0
  window.speechSynthesis.speak(chispa)
}
