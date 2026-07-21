// ============================================================================
// Quality API — camada de fetch em Deno (port de src/api/endpoints/* + helpers).
// GET-only, CHAVE como query param, paginação cursor (ultimoCodigo + limite).
// ============================================================================
import type {
  Abastecimento, LMC, Produto, Grupo, VendaItem, VendaFormaPagamento, VendaResumo, Caixa,
} from './compute.ts'

interface Paginated<T> { resultados: T[]; ultimoCodigo: number }

/** Monta a URL juntando baseURL + path sem barra dupla, com CHAVE + params. */
const buildUrl = (
  baseURL: string, chave: string, path: string,
  params: Record<string, string | number | boolean | number[] | undefined>,
): string => {
  const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const p = path.startsWith('/') ? path : `/${path}`
  const sp = new URLSearchParams()
  sp.set('CHAVE', chave)
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    if (Array.isArray(v)) {
      // axios serializa arrays como `chave[]=a&chave[]=b`
      for (const item of v) sp.append(`${k}[]`, String(item))
    } else {
      sp.set(k, String(v))
    }
  }
  return `${base}${p}?${sp.toString()}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Retry com backoff pra rate-limit/erros transitórios. Sem isto, uma rodada do
// cron que batia 429 (ou 500 blip) FALHAVA e não gravava — congelando o dia num
// snapshot parcial (ex.: "today" para de atualizar de tarde e o dia fica meio).
//   - 429 (rate-limit): recuperável → até MAX_429 tentativas, backoff exponencial
//     (respeita Retry-After) — é o principal culpado do congelamento.
//   - 5xx: tenta 1× (pode ser blip). O 500 de /ABASTECIMENTO·/LMC é PERSISTENTE
//     (bug de datetime da Quality) — não adianta martelar; cai no degrade
//     não-fatal do chamador (ABAST já tem catch; LMC vira [] no index.ts).
const getJson = async <T>(url: string): Promise<T> => {
  const MAX_429 = 6 // era 4 — sob throttle pesado da CHAVE, 4 esgotava e o dia ficava parcial
  let attempt = 0
  for (;;) {
    const res = await fetch(url)
    if (res.ok) return res.json() as Promise<T>
    const status = res.status
    const retryable = status === 429 ? attempt < MAX_429 : (status >= 500 && attempt < 1)
    if (retryable) {
      const ra = Number(res.headers.get('retry-after'))
      const waitMs = Number.isFinite(ra) && ra > 0
        ? Math.min(ra * 1000, 45_000)
        : Math.min(1000 * 2 ** attempt, 20_000) + Math.floor(Math.random() * 500)
      await res.body?.cancel().catch(() => {}) // libera o corpo antes de re-tentar
      await sleep(waitMs)
      attempt++
      continue
    }
    const body = await res.text().catch(() => '')
    throw new Error(`Quality ${status} em ${url.split('?')[0]}: ${body.slice(0, 200)}`)
  }
}

interface RedeCtx { baseURL: string; chave: string }

/** Paginação cursor: para quando resultados.length < limite ou bate maxPages. */
const fetchAllPages = async <T extends { codigo?: number }>(
  fetchPage: (ultimoCodigo: number | undefined, limite: number) => Promise<Paginated<T>>,
  limite = 1000, maxPages = 10,
): Promise<T[]> => {
  let ultimoCodigo: number | undefined
  const all: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const r = await fetchPage(ultimoCodigo, limite)
    const rows = r.resultados ?? []
    all.push(...rows)
    if (rows.length < limite) break
    ultimoCodigo = r.ultimoCodigo
  }
  return all
}

// ── /ABASTECIMENTO em chunks de 7 dias (4 paralelos), sem empresaCodigo ──
const addDaysStr = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export const fetchAbastecimentosChunked = async (
  ctx: RedeCtx, dataInicial: string, dataFinal: string,
): Promise<Abastecimento[]> => {
  // PARALLEL=2 (era 4): o apurarMes já dispara 8 grupos de fetch em paralelo
  // (Promise.all), então 4 chunks de abast por cima estouravam o rate-limit da
  // CHAVE (429 em série, principalmente no backfill de vários dias). 2 mantém
  // velocidade decente e alivia a rajada — reliability > velocidade num cron.
  const CHUNK = 7, PARALLEL = 2
  const chunks: { from: string; to: string }[] = []
  let from = dataInicial
  while (from <= dataFinal) {
    const to = addDaysStr(from, CHUNK - 1)
    chunks.push({ from, to: to < dataFinal ? to : dataFinal })
    from = addDaysStr(from, CHUNK)
  }
  const out: Abastecimento[] = []
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const batch = chunks.slice(i, i + PARALLEL)
    const results = await Promise.all(batch.map(async (c) => {
      const run = () => fetchAllPages<Abastecimento>(
        (ultimoCodigo, limite) => getJson<Paginated<Abastecimento>>(
          buildUrl(ctx.baseURL, ctx.chave, '/ABASTECIMENTO', { dataInicial: c.from, dataFinal: c.to, ultimoCodigo, limite }),
        ), 1000, 50,
      )
      try { return await run() }
      catch { await new Promise((r) => setTimeout(r, 2000)); try { return await run() } catch { return [] } }
    }))
    for (const r of results) out.push(...r)
  }
  return out
}

export const fetchLmc = (ctx: RedeCtx, empresaCodigos: number[], dataInicial: string, dataFinal: string) =>
  fetchAllPages<LMC & { codigo?: number }>(
    (ultimoCodigo, limite) => getJson<Paginated<LMC & { codigo?: number }>>(
      buildUrl(ctx.baseURL, ctx.chave, '/LMC', { empresaCodigo: empresaCodigos, dataInicial, dataFinal, ultimoCodigo, limite }),
    ), 1000, 50,
  )

export const fetchVendaResumo = (ctx: RedeCtx, dataInicial: string, dataFinal: string) =>
  getJson<VendaResumo[]>(buildUrl(ctx.baseURL, ctx.chave, '/VENDA_RESUMO', { dataInicial, dataFinal }))

export const fetchCaixasEmpresa = (ctx: RedeCtx, empresaCodigo: number, dataInicial: string, dataFinal: string) =>
  fetchAllPages<Caixa & { codigo?: number }>(
    (ultimoCodigo, limite) => getJson<Paginated<Caixa & { codigo?: number }>>(
      buildUrl(ctx.baseURL, ctx.chave, '/CAIXA', { empresaCodigo, dataInicial, dataFinal, ultimoCodigo, limite }),
    ), 1000, 20,
  )

export const fetchFormasEmpresa = (ctx: RedeCtx, empresaCodigo: number, dataInicial: string, dataFinal: string) =>
  fetchAllPages<VendaFormaPagamento & { codigo?: number }>(
    (ultimoCodigo, limite) => getJson<Paginated<VendaFormaPagamento & { codigo?: number }>>(
      buildUrl(ctx.baseURL, ctx.chave, '/VENDA_FORMA_PAGAMENTO', { empresaCodigo, dataInicial, dataFinal, ultimoCodigo, limite }),
    ), 1000, 20,
  )

export const fetchVendaItensEmpresa = (ctx: RedeCtx, empresaCodigo: number, dataInicial: string, dataFinal: string) =>
  fetchAllPages<VendaItem & { codigo?: number }>(
    (ultimoCodigo, limite) => getJson<Paginated<VendaItem & { codigo?: number }>>(
      buildUrl(ctx.baseURL, ctx.chave, '/VENDA_ITEM', { empresaCodigo, usaProdutoLmc: false, dataInicial, dataFinal, ultimoCodigo, limite }),
    ), 1000, 200,
  )

/** /VENDA situacao='A' → Set de vendaCodigo autorizados (exclui canceladas). */
export const fetchAutorizadosEmpresa = async (ctx: RedeCtx, empresaCodigo: number, dataInicial: string, dataFinal: string): Promise<Set<number>> => {
  const vendas = await fetchAllPages<{ codigo?: number; vendaCodigo: number }>(
    (ultimoCodigo, limite) => getJson<Paginated<{ codigo?: number; vendaCodigo: number }>>(
      buildUrl(ctx.baseURL, ctx.chave, '/VENDA', { empresaCodigo, dataInicial, dataFinal, situacao: 'A', ultimoCodigo, limite }),
    ), 1000, 2000,
  )
  const set = new Set<number>()
  for (const v of vendas) if (v.vendaCodigo != null) set.add(v.vendaCodigo)
  return set
}

export const fetchProdutos = (ctx: RedeCtx) =>
  fetchAllPages<Produto & { codigo?: number }>(
    (ultimoCodigo, limite) => getJson<Paginated<Produto & { codigo?: number }>>(
      buildUrl(ctx.baseURL, ctx.chave, '/PRODUTO', { ultimoCodigo, limite }),
    ), 1000, 20,
  )

export const fetchGrupos = (ctx: RedeCtx) =>
  fetchAllPages<Grupo & { codigo?: number }>(
    (ultimoCodigo, limite) => getJson<Paginated<Grupo & { codigo?: number }>>(
      buildUrl(ctx.baseURL, ctx.chave, '/GRUPO', { ultimoCodigo, limite }),
    ), 1000, 20,
  )

/** /EMPRESAS (plural) — uma página, limite 200. Retorna [{ codigo }]. */
export const fetchEmpresas = async (ctx: RedeCtx): Promise<{ codigo: number }[]> => {
  const r = await getJson<Paginated<{ codigo: number; empresaCodigo: number }>>(
    buildUrl(ctx.baseURL, ctx.chave, '/EMPRESAS', { limite: 200 }),
  )
  return (r.resultados ?? []).map((e) => ({ codigo: e.codigo ?? e.empresaCodigo }))
}
