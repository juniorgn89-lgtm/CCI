/**
 * Pilha dos modais com guia abertos agora. Modal aberto por cima de outro
 * (ex.: tanques → novo pedido) entra no topo; só o do topo mostra o balão,
 * pra nunca ter dois personagens falando ao mesmo tempo. Ao fechar o de cima,
 * o de baixo volta a mostrar o dele (se ainda não foi dispensado).
 */
let pilha: string[] = []
const ouvintes = new Set<() => void>()
const avisar = () => { for (const o of ouvintes) o() }

export const entrarNaPilha = (id: string) => { pilha = [...pilha.filter((x) => x !== id), id]; avisar() }
export const sairDaPilha = (id: string) => { pilha = pilha.filter((x) => x !== id); avisar() }
export const assinarPilha = (fn: () => void) => { ouvintes.add(fn); return () => { ouvintes.delete(fn) } }
export const topoDaPilha = () => pilha[pilha.length - 1] ?? null
