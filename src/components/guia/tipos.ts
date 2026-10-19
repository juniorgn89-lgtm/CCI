/** Texto do guia de um modal (ver src/lib/guiasModais.ts). */
export interface GuiaModal {
  /** Chave única: guarda no navegador o "não mostrar mais" deste modal. */
  id: string
  titulo: string
  /** Parágrafos curtos, em linguagem de dono de posto. */
  texto: string[]
}

/** Atributo que marca o balão: clique nele não conta como "fora do modal". */
export const GUIA_ATTR = 'data-guia-balao'
