/**
 * Lo poco que usamos de pdf.js.
 *
 * Se importa el build .mjs directo (y no el paquete, que sí trae tipos)
 * porque es el minificado y es el que conviene que termine en el bundle. Ese
 * archivo no declara tipos, así que se declara acá la superficie que
 * realmente tocamos: si mañana se usa algo más, no compila hasta agregarlo,
 * que es exactamente lo que se quiere de un `any` acotado.
 */
declare module 'pdfjs-dist/build/pdf.min.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string }

  export interface TextItem {
    str: string
    /** [a, b, c, d, x, y] — la posición está en los índices 4 y 5. */
    transform: number[]
  }

  export interface TextContent {
    items: TextItem[]
  }

  export interface PDFPage {
    getTextContent(): Promise<TextContent>
  }

  export interface PDFDocument {
    numPages: number
    getPage(n: number): Promise<PDFPage>
  }

  /** La tarea de carga es la dueña del worker: es la que se destruye. */
  export interface TareaDeCarga {
    promise: Promise<PDFDocument>
    destroy(): Promise<void>
  }

  export function getDocument(args: { data: Uint8Array }): TareaDeCarga
}
