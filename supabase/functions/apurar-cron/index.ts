// ============================================================================
// apurar-cron — Edge Function que roda a apuração SOZINHA (cron diário).
// Port server-side do botão "Apurar" (/admin/apuracao). Para cada rede ATIVA,
// reapura o mês corrente (dias já fechados) e, na virada do mês (dias 1-3),
// também o mês anterior. Usa service role → DELETE+INSERT direto no cache.
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

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Último dia "fechado" do mês (mês passado = último dia; mês corrente = ontem). */
const closedEndForMonth = (y: number, m: number, today: string): string | null => {
  const [ty, tm, td] = today.split('-').map(Number)
  if (y > ty || (y === ty && m > tm)) return null
  const last = lastDayOfMonth(y, m)
  if (y < ty || (y === ty && m < tm)) return `${y}-${pad(m)}-${pad(last)}`
  if (td <= 1) return null
  return `${ty}-${pad(tm)}-${pad(td - 1)}`
}

const threeMonthsBefore = (startStr: string): string => {
  const [y, m] = startStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 - 3, 1)).toISOString().slice(0, 10)
}

interface Rede { id: string; nome: string; chave: string; api_base_url: string }
interface Target { year: number; month: number; start: string; end: string }

const targetsForToday = (today: string): Target[] => {
  const [ty, tm, td] = today.split('-').map(Number)
  const out: Target[] = []
  const curEnd = closedEndForMonth(ty, tm, today)
  if (curEnd) out.push({ year: ty, month: tm, start: `${ty}-${pad(tm)}-01`, end: curEnd })
  // Virada de mês: sela o mês anterior nos primeiros dias.
  if (td <= 3) {
    const py = tm === 1 ? ty - 1 : ty
    const pm = tm === 1 ? 12 : tm - 1
    const pend = closedEndForMonth(py, pm, today)
    if (pend) out.push({ year: py, month: pm, start: `${py}-${pad(pm)}-01`, end: pend })
  }
  return out
}

type Supa = ReturnType<typeof createClient>

const insertChunked = async (supa: Supa, table: string, rows: unknown[]) => {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supa.from(table).insert(rows.slice(i, i + 500))
    if (error) throw new Error(`insert ${table}: ${error.message}`)
  }
}

const deletePeriodo = async (supa: Supa, table: string, dateCol: string, redeId: string, start: string, end: string) => {
  const { error } = await supa.from(table).delete().eq('rede_id', redeId).gte(dateCol, start).lte(dateCol, end)
  if (error) throw new Error(`delete ${table}: ${error.message}`)
}

const apurarMes = async (supa: Supa, rede: Rede, empresaCodes: number[], t: Target): Promise<number> => {
  const ctx = { baseURL: rede.api_base_url, chave: rede.chave }
  const lmcStart = threeMonthsBefore(t.start)

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
  const abastRows = abast.map((a) => abastecimentoToCacheRow(a, rede.id, costMap))
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
    insertChunked(supa, 'apuracao_diaria', rows),
    insertChunked(supa, 'apuracao_fuel_diaria', fuelRows),
    insertChunked(supa, 'apuracao_abastecimentos', abastRows),
    insertChunked(supa, 'apuracao_caixas', caixaRows),
    insertChunked(supa, 'apuracao_formas_pagamento', formaRows),
    insertChunked(supa, 'apuracao_vendas', vendaRows),
    insertChunked(supa, 'apuracao_vendas_funcionario', funcRows),
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

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const today = tzToday()
  const targets = targetsForToday(today)

  const { data: redes, error: redesErr } = await supa
    .from('redes').select('id, nome, chave, api_base_url, ativo').eq('ativo', true)
  if (redesErr) {
    return new Response(JSON.stringify({ error: redesErr.message }), { status: 500, headers: { 'content-type': 'application/json' } })
  }

  const summary: Record<string, unknown>[] = []
  for (const rede of (redes ?? []) as Rede[]) {
    try {
      const empresas = await fetchEmpresas({ baseURL: rede.api_base_url, chave: rede.chave })
      const empresaCodes = empresas.map((e) => e.codigo).filter((c) => c > 0)
      if (empresaCodes.length === 0) { summary.push({ rede: rede.nome, skipped: 'sem empresas' }); continue }
      let totalRows = 0
      for (const t of targets) totalRows += await apurarMes(supa, rede, empresaCodes, t)
      summary.push({ rede: rede.nome, empresas: empresaCodes.length, meses: targets.map((t) => `${t.year}-${pad(t.month)}`), rows: totalRows, ok: true })
    } catch (e) {
      summary.push({ rede: rede.nome, ok: false, error: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ today, targets, summary }, null, 2), { headers: { 'content-type': 'application/json' } })
})
