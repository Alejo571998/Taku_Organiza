/**
 * Chequeo de contraseñas filtradas contra Pwned Passwords (HaveIBeenPwned).
 *
 * Es lo mismo que hace la opción "Prevent use of leaked passwords" de
 * Supabase, que es de plan Pro. La API de HaveIBeenPwned es pública y
 * gratuita; lo que cobra Supabase es llamarla por vos.
 *
 * LA CONTRASEÑA NO SALE DEL NAVEGADOR. El protocolo es de k-anonimato:
 *
 *   1. Se calcula el SHA-1 de la contraseña acá.
 *   2. Se mandan los PRIMEROS 5 caracteres de ese hash, nada más.
 *   3. La API devuelve todos los sufijos que empiezan con ese prefijo
 *      (varios cientos), sin saber cuál es el nuestro.
 *   4. La comparación final pasa en esta función.
 *
 * El servidor de HaveIBeenPwned no puede reconstruir la contraseña ni saber
 * cuál de los cientos de hashes que devolvió era el que buscábamos.
 *
 * SHA-1 acá no es una decisión de seguridad ni se usa para autenticar: es el
 * formato en el que esa API publica sus datos. Las contraseñas las sigue
 * guardando Supabase con bcrypt.
 */

/** Si la API no contesta en este tiempo, se sigue sin chequear. */
const TIEMPO_LIMITE_MS = 3500

async function sha1Hex(texto: string): Promise<string | null> {
  // crypto.subtle solo existe en contexto seguro (https o localhost). Si no
  // está, no se puede chequear y se deja pasar.
  if (!globalThis.crypto?.subtle) return null
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * Cuántas veces apareció la contraseña en filtraciones públicas. 0 es limpia.
 *
 * FALLA ABIERTA a propósito: si la API está caída, tarda de más o el
 * navegador no tiene crypto.subtle, devuelve 0 y el registro sigue. Que un
 * tercero caído deje a alguien sin poder crear su cuenta es peor que perderse
 * un chequeo; esto es una capa extra, no la única defensa.
 */
export async function vecesFiltrada(contrasena: string): Promise<number> {
  try {
    const hash = await sha1Hex(contrasena)
    if (!hash) return 0

    const prefijo = hash.slice(0, 5)
    const sufijo = hash.slice(5)

    const corte = new AbortController()
    const reloj = window.setTimeout(() => corte.abort(), TIEMPO_LIMITE_MS)
    let respuesta: Response
    try {
      respuesta = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, {
        signal: corte.signal
      })
    } finally {
      window.clearTimeout(reloj)
    }
    if (!respuesta.ok) return 0

    // Cada línea es "SUFIJO:cantidad".
    for (const linea of (await respuesta.text()).split('\n')) {
      const corteDosPuntos = linea.indexOf(':')
      if (corteDosPuntos < 0) continue
      if (linea.slice(0, corteDosPuntos).trim() !== sufijo) continue
      return Number(linea.slice(corteDosPuntos + 1).trim()) || 0
    }
    return 0
  } catch {
    return 0
  }
}

/** El aviso que ve la persona. Dice el número porque el número convence. */
export function mensajeFiltrada(veces: number): string {
  const cuantas = veces.toLocaleString('es-AR')
  return veces === 1
    ? 'Esa contraseña apareció 1 vez en filtraciones públicas. Elegí otra.'
    : `Esa contraseña apareció ${cuantas} veces en filtraciones públicas. Elegí otra: probar las de esas listas es lo primero que hace cualquier ataque.`
}
