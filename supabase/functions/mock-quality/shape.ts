// @ts-nocheck — Deno. Helpers de resposta no formato da Quality.

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

export const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } })

/** Lê um número de query param (undefined quando ausente/vazio). */
export const num = (sp: URLSearchParams, key: string): number | undefined => {
  const v = sp.get(key)
  return v != null && v !== '' ? Number(v) : undefined
}

/**
 * Paginação cursor-based idêntica à Quality: `{ ultimoCodigo, resultados }`.
 * `items` deve estar ordenado ASC por código. Retorna a fatia após `ultimoCodigo`
 * (exclusivo) com no máximo `limite` itens; o `fetchAllPages` do front para
 * sozinho quando vem menos que o limite.
 */
export const paginate = <T>(
  items: T[],
  getCodigo: (t: T) => number,
  ultimoCodigo: number | undefined,
  limite: number,
): { ultimoCodigo: number; resultados: T[] } => {
  const lim = limite > 0 ? limite : 1000
  const start = ultimoCodigo ? items.findIndex((i) => getCodigo(i) > ultimoCodigo) : 0
  const slice = start < 0 ? [] : items.slice(start, start + lim)
  const last = slice.length ? getCodigo(slice[slice.length - 1]) : (ultimoCodigo ?? 0)
  return { ultimoCodigo: last, resultados: slice }
}
