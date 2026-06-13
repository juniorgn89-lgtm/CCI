// ============================================================================
// apurar-cron — Edge Function que roda a apuração SOZINHA (via cron).
// Port server-side do botão "Apurar" (/admin/apuracao). Usa service role →
// DELETE + UPSERT(onConflict=PK) no cache. Reapurar mês inteiro continua sendo
// o botão manual em /admin/apuracao.
//
// Dois modos (pelo corpo `{"scope": "..."}`):
//  - scope ausente / "closed" (cron DIÁRIO): reapura os últimos 3 dias FECHADOS
//    (janela até ontem) de cada rede ativa. Leve p/ o limite da Edge Function.
//  - scope "today" (cron FREQUENTE, ex.: 30 min): reapura SÓ o dia de hoje
//    (live/volátil), pra manter o cache do dia corrente fresco.
//
// Deploy:  supabase functions deploy apurar-cron --no-verify-jwt
// Secrets: CRON_SECRET (obrigatório). SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//          são injetados automaticamente pelo runtime.
// Agendamento: ver docs/supabase-apuracao-cron.sql (pg_cron + pg_net).
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildCostMapFromLmc, buildProdutoInfo, computeApuracaoRows, computeFuelProdutoRows,
  aggregateVendaCache, abastecimentoToCacheRow, caixaToCacheRow, formaPagamentoToCacheRow,
  type Caixa, type VendaFormaPagamento, type VendaItem,
} from './compute.ts'
import {
  fetchAbastecimentosChunked, fetchLmc, fetchVendaResumo, fetchCaixasEmpresa, fetchFormasEmpresa,
  fetchVendaItensEmpresa, fetchAutorizadosEmpresa, fetchProdutos, fetchGrupos, fetchEmpresas,
} from './quality.ts'

const pad = (n: number) => String(n).padStart(2, '0')

/** "Hoje" em America/Sao_Paulo (yyyy-MM-dd) — alinha com o fuso do front. */
const tzToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const addDays = (dateStr: string, n: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// Lookback do LMC pra montar o custo (preço mais recente). 45 dias cobrem o
// custo vigente sem o peso de baixar meses de LMC numa Edge Function.
const lmcLookbackStart = (startStr: string): string => addDays(startStr, -45)

interface Rede { id: string; nome: string; chave: string; api_base_url: string; apuracao_auto?: boolean }
interface Target { start: string; end: string }

/**
 * Janela INCREMENTAL: os últimos N dias FECHADOS (até ontem). Mantém o cache
 * fresco sem reapurar o mês inteiro a cada noite (o que estourava o limite de
 * recursos). N=3 dá auto-cura caso uma execução falhe. Cruza virada de mês sem
 * problema (o range pode pegar fim do mês anterior).
 */
const TRAILING_DAYS = 3
const targetsForToday = (today: string): Target[] => {
  const end = addDays(today, -1) // ontem (último dia fechado)
  const start = addDays(end, -(TRAILING_DAYS - 1))
  return [{ start, end }]
}

type Supa = ReturnType<typeof createClient>

// PK de cada tabela de cache (do schema em docs/*.sql) — usada no onConflict do
// upsert E pra deduplicar o lote (evita "ON CONFLICT cannot affect row twice").
const PK: Record<string, string[]> = {
  apuracao_diaria: ['rede_id', 'empresa_codigo', 'data'],
  apuracao_fuel_diaria: ['rede_id', 'empresa_codigo', 'data', 'produto_codigo'],
  apuracao_abastecimentos: ['rede_id', 'empresa_codigo', 'abastecimento_codigo'],
  apuracao_caixas: ['rede_id', 'empresa_codigo', 'caixa_codigo', 'turno_codigo', 'data_movimento'],
  apuracao_formas_pagamento: ['rede_id', 'empresa_codigo', 'venda_codigo', 'venda_prazo_codigo'],
  apuracao_vendas: ['rede_id', 'empresa_codigo', 'data', 'produto_codigo'],
  apuracao_vendas_funcionario: ['rede_id', 'empresa_codigo', 'data', 'funcionario_codigo', 'setor'],
}

const upsertChunked = async (supa: Supa, table: string, rows: unknown[]) => {
  const cols = PK[table]
  // Dedupe por PK (mantém o último) — paginação da Quality pode repetir linhas.
  const byKey = new Map<string, Record<string, unknown>>()
  for (const r of rows as Record<string, unknown>[]) {
    byKey.set(cols.map((c) => String(r[c])).join('|'), r)
  }
  const deduped = [...byKey.values()]
  for (let i = 0; i < deduped.length; i += 500) {
    const { error } = await supa.from(table).upsert(deduped.slice(i, i + 500), { onConflict: cols.join(',') })
    if (error) throw new Error(`upsert ${table}: ${error.message}`)
  }
}

const deletePeriodo = async (supa: Supa, table: string, dateCol: string, redeId: string, start: string, end: string) => {
  const { error } = await supa.from(table).delete().eq('rede_id', redeId).gte(dateCol, start).lte(dateCol, end)
  if (error) throw new Error(`delete ${table}: ${error.message}`)
}

const apurarMes = async (supa: Supa, rede: Rede, empresaCodes: number[], t: Target): Promise<number> => {
  const ctx = { baseURL: rede.api_base_url, chave: rede.chave }
  const lmcStart = lmcLookbackStart(t.start)

  // Per-empresa sequencial (igual ao front) pra não estourar rate limit.
  const seq = async <T>(fn: (ec: number) => Promise<T[]>): Promise<T[]> => {
    const all: T[] = []
    for (const ec of empresaCodes) all.push(...await fn(ec))
    return all
  }

  const [abast, lmc, resumo, caixas, formasPgto, vendaItens, produtos, grupos] = await Promise.all([
    fetchAbastecimentosChunked(ctx, t.start, t.end),
    fetchLmc(ctx, empresaCodes, lmcStart, t.end),
    fetchVendaResumo(ctx, t.start, t.end),
    seq<Caixa>((ec) => fetchCaixasEmpresa(ctx, ec, t.start, t.end)),
    seq<VendaFormaPagamento>((ec) => fetchFormasEmpresa(ctx, ec, t.start, t.end)),
    seq<VendaItem>((ec) => fetchVendaItensEmpresa(ctx, ec, t.start, t.end)),
    fetchProdutos(ctx),
    fetchGrupos(ctx),
  ])
  // vendaCodigo autorizados (situacao='A') por empresa, unidos.
  const autorizados = new Set<number>()
  for (const ec of empresaCodes) {
    const s = await fetchAutorizadosEmpresa(ctx, ec, t.start, t.end)
    for (const c of s) autorizados.add(c)
  }

  const rows = computeApuracaoRows({
    redeId: rede.id, empresaCodigos: empresaCodes, dataInicial: t.start, dataFinal: t.end,
    abastecimentos: abast, lmc, vendaResumo: resumo, produtos,
  })
  const fuelRows = computeFuelProdutoRows({
    redeId: rede.id, dataInicial: t.start, dataFinal: t.end,
    abastecimentos: abast, lmc, produtos, vendaItens, autorizados,
  })
  const costMap = buildCostMapFromLmc(lmc, produtos)
  // Exclui aferição (teste de bomba) — não é venda; alinha com o webPosto.
  const abastRows = abast.filter((a) => !a.afericao).map((a) => abastecimentoToCacheRow(a, rede.id, costMap))
  const caixaRows = caixas.map((c) => caixaToCacheRow(c, rede.id)).filter((r) => !!r.data_movimento)
  const formaRows = formasPgto.map((f) => formaPagamentoToCacheRow(f, rede.id))
  const produtoInfo = buildProdutoInfo(produtos, grupos)
  const { vendaRows, funcRows } = aggregateVendaCache(vendaItens, rede.id, produtoInfo, autorizados)

  // Service role → DELETE do período funciona; sem necessidade de tombstone.
  await Promise.all([
    deletePeriodo(supa, 'apuracao_diaria', 'data', rede.id, t.start, t.end),
    deletePeriodo(supa, 'apuracao_fuel_diaria', 'data', rede.id, t.start, t.end),
    deletePeriodo(supa, 'apuracao_abastecimentos', 'data_fiscal', rede.id, t.start, t.end),
    deletePeriodo(supa, 'apuracao_caixas', 'data_movimento', rede.id, t.start, t.end),
    deletePeriodo(supa, 'apuracao_formas_pagamento', 'data_movimento', rede.id, t.start, t.end),
    deletePeriodo(supa, 'apuracao_vendas', 'data', rede.id, t.start, t.end),
    deletePeriodo(supa, 'apuracao_vendas_funcionario', 'data', rede.id, t.start, t.end),
  ])
  await Promise.all([
    upsertChunked(supa, 'apuracao_diaria', rows),
    upsertChunked(supa, 'apuracao_fuel_diaria', fuelRows),
    upsertChunked(supa, 'apuracao_abastecimentos', abastRows),
    upsertChunked(supa, 'apuracao_caixas', caixaRows),
    upsertChunked(supa, 'apuracao_formas_pagamento', formaRows),
    upsertChunked(supa, 'apuracao_vendas', vendaRows),
    upsertChunked(supa, 'apuracao_vendas_funcionario', funcRows),
  ])
  return rows.length
}

Deno.serve(async (req) => {
  // Guard: só roda com o segredo certo (evita invocação pública).
  const secret = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
  }

  // scope=today → apura SÓ o dia de hoje (live, volátil) — pra um cron frequente.
  // scope=closed (default) → últimos 3 dias FECHADOS (cron diário).
  const body = await req.json().catch(() => ({})) as { scope?: string }
  const scope = body?.scope === 'today' ? 'today' : 'closed'

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const today = tzToday()
  const targets: Target[] = scope === 'today'
    ? [{ start: today, end: today }]
    : targetsForToday(today)

  const { data: redes, error: redesErr } = await supa
    .from('redes').select('id, nome, chave, api_base_url, ativo, apuracao_auto').eq('ativo', true)
  if (redesErr) {
    return new Response(JSON.stringify({ error: redesErr.message }), { status: 500, headers: { 'content-type': 'application/json' } })
  }

  const summary: Record<string, unknown>[] = []
  for (const rede of (redes ?? []) as Rede[]) {
    // Apuração automática desligada pra esta rede (toggle no admin) — pula.
    if (rede.apuracao_auto === false) { summary.push({ rede: rede.nome, skipped: 'apuração automática desligada' }); continue }
    try {
      const empresas = await fetchEmpresas({ baseURL: rede.api_base_url, chave: rede.chave })
      const empresaCodes = empresas.map((e) => e.codigo).filter((c) => c > 0)
      if (empresaCodes.length === 0) { summary.push({ rede: rede.nome, skipped: 'sem empresas' }); continue }
      let totalRows = 0
      for (const t of targets) totalRows += await apurarMes(supa, rede, empresaCodes, t)
      summary.push({ rede: rede.nome, empresas: empresaCodes.length, janela: targets.map((t) => `${t.start}..${t.end}`), rows: totalRows, ok: true })
    } catch (e) {
      summary.push({ rede: rede.nome, ok: false, error: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ scope, today, targets, summary }, null, 2), { headers: { 'content-type': 'application/json' } })
})
