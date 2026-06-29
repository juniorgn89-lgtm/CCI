// @ts-nocheck — Deno (Supabase Edge Runtime).
// ============================================================================
// mock-quality — API fictícia que IMITA os endpoints da Quality, pra a rede de
// demonstração "Aurora". O front não muda: a rede demo aponta o `api_base_url`
// pra esta Function. Dados determinísticos (ver generator.ts/dia.ts) →
// reconciliam entre telas e os filtros de período funcionam ao vivo.
//
// Rede demo (Admin·Redes): chave "DEMO-AURORA" (rótulo) ·
//   api_base_url = https://<PROJECT_REF>.supabase.co/functions/v1/mock-quality
// Deploy: supabase functions deploy mock-quality --no-verify-jwt
//
// FASE 0: catálogos. FASE 1: combustível (abastecimento/venda/forma/bico/bomba/lmc).
// ============================================================================
import {
  POSTOS, PRODUTOS, FRENTISTAS, ADMINISTRADORAS, CLIENTES, BICOS, BOMBAS, POSTO_CODES,
} from './catalogs.ts'
import { gerarDiaFuel, lmcDoPosto } from './dia.ts'
import { cors, json, num, paginate } from './shape.ts'

const tzToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const addDays = (dateISO: string, n: number): string => {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const eachDate = (di: string, df: string): string[] => {
  const out: string[] = []
  let cur = di
  for (let guard = 0; cur <= df && guard < 400; guard++) { out.push(cur); cur = addDays(cur, 1) }
  return out
}

const scopePostos = (empresaCodigo?: number): number[] =>
  empresaCodigo && POSTO_CODES.includes(empresaCodigo) ? [empresaCodigo] : POSTO_CODES

// Cache por (endpoint, janela, escopo) — a paginação do front faz N requests
// pra mesma janela; gerar uma vez por janela evita regenerar a cada página.
const cache = new Map<string, any[]>()
const collectFuel = (field: string, di: string, df: string, postos: number[]): any[] => {
  const key = `${field}|${di}|${df}|${postos.join(',')}`
  const hit = cache.get(key)
  if (hit) return hit
  const out: any[] = []
  for (const d of eachDate(di, df)) for (const p of postos) out.push(...gerarDiaFuel(p, d)[field])
  out.sort((a, b) => a.codigo - b.codigo)
  if (cache.size > 8) cache.clear()
  cache.set(key, out)
  return out
}

Deno.serve((req: Request): Response => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const endpoint = (url.pathname.split('/').filter(Boolean).pop() ?? '').toUpperCase()
  const sp = url.searchParams
  const limite = num(sp, 'limite') ?? 1000
  const ultimo = num(sp, 'ultimoCodigo')
  const empresaCodigo = num(sp, 'empresaCodigo')
  const df = sp.get('dataFinal') || tzToday()
  const di = sp.get('dataInicial') || df

  switch (endpoint) {
    /* ── Catálogos (Fase 0) ── */
    case 'EMPRESAS':
      return json(paginate(POSTOS, (e) => e.empresaCodigo, ultimo, limite))
    case 'PRODUTO':
      return json(paginate(PRODUTOS, (p) => p.produtoCodigo, ultimo, limite))
    case 'FUNCIONARIO': {
      const list = empresaCodigo ? FRENTISTAS.filter((f) => f.empresaCodigo === empresaCodigo) : FRENTISTAS
      return json(paginate(list, (f) => f.funcionarioCodigo, ultimo, limite))
    }
    case 'ADMINISTRADORA':
      return json(paginate(ADMINISTRADORAS, (a) => a.administradoraCodigo, ultimo, limite))
    case 'CLIENTE':
      return json(paginate(CLIENTES, (c) => c.codigo, ultimo, limite))

    /* ── Infra de pista (Fase 1) ── */
    case 'BICO': {
      const list = empresaCodigo ? BICOS.filter((b) => b.empresaCodigo === empresaCodigo) : BICOS
      return json(paginate(list, (b) => b.bicoCodigo, ultimo, limite))
    }
    case 'BOMBA': {
      const list = empresaCodigo ? BOMBAS.filter((b) => b.empresaCodigo === empresaCodigo) : BOMBAS
      return json(paginate(list, (b) => b.bombaCodigo, ultimo, limite))
    }

    /* ── Transacional combustível (Fase 1) ── */
    // /ABASTECIMENTO vaza a rede toda (como a Quality) — o front filtra no cliente.
    case 'ABASTECIMENTO':
      return json(paginate(collectFuel('abastecimentos', di, df, POSTO_CODES), (a) => a.codigo, ultimo, limite))
    case 'VENDA_ITEM':
      return json(paginate(collectFuel('vendaItens', di, df, scopePostos(empresaCodigo)), (v) => v.codigo, ultimo, limite))
    case 'VENDA':
      return json(paginate(collectFuel('vendas', di, df, scopePostos(empresaCodigo)), (v) => v.codigo, ultimo, limite))
    case 'VENDA_FORMA_PAGAMENTO':
      return json(paginate(collectFuel('formas', di, df, scopePostos(empresaCodigo)), (f) => f.codigo, ultimo, limite))
    case 'LMC': {
      const rows = scopePostos(empresaCodigo).flatMap((p) => lmcDoPosto(p, df))
      return json(paginate(rows, (l) => l.empresaCodigo * 100 + l.produtoLmcCodigo, ultimo, limite))
    }

    // Demais endpoints (caixa, cartão, títulos, estoque…) entram nas Fases 2+.
    default:
      return json({ ultimoCodigo: ultimo ?? 0, resultados: [] })
  }
})
