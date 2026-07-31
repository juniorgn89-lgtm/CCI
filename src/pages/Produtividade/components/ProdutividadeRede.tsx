import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wrench, Droplet, Gauge, Receipt, Fuel, Trophy, AlertTriangle, Lightbulb, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { useFilterStore } from '@/store/filters'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import useFrentistaProdutividade, { type FrentistaProdData, type FuncProdRow } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'
import useRedeProdutividadeCache from '@/pages/Produtividade/hooks/useRedeProdutividadeCache'
import AnaliseSemanalLineCard from '@/pages/Comercial/Vendas/AnaliseSemanalLineCard'
import type { Empresa } from '@/api/types/empresa'

const fmtR = (v: number) => formatCurrency(v)
const fmtRi = (v: number) => formatCurrencyInt(v)
const fmtL = (v: number) => formatLiters(v)
const fmtN = (v: number) => formatNumber(v)
const fmtMix = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?'
const semCadastro = (nome: string) => !nome || nome === '—' || /^Funcion[aá]rio\s+\d+$/i.test(nome)
const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0)

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rangeLabel = (ini: string, fim: string): string => {
  if (!ini || !fim) return ''
  const [ya, ma, da] = ini.split('-').map(Number)
  const [yb, mb, db] = fim.split('-').map(Number)
  const p = (n: number) => String(n).padStart(2, '0')
  if (ya === yb && ma === mb) return `${p(da)}–${p(db)} ${MES[ma - 1]} ${yb}`
  return `${p(da)} ${MES[ma - 1]} – ${p(db)} ${MES[mb - 1]} ${yb}`
}

/* Cada posto carrega seus dados pela MESMA fonte da Visão Geral e reporta pra cima
   (fan-out — não dá pra chamar o hook num loop). */
const PostoLoader = ({ posto, onData }: { posto: Empresa; onData: (cod: number, d: FrentistaProdData) => void }) => {
  // lean: o Resumo só usa os KPIs/rows — pula custo, evolução 12m e mês anterior.
  const data = useFrentistaProdutividade(posto.codigo, { lean: true })
  useEffect(() => { onData(posto.codigo, data) }, [posto.codigo, data, onData])
  return null
}

/* ─── Agregação por posto ─── */
interface PostoAgg {
  codigo: number; nome: string
  automotivos: number; aditivada: number; gasolina: number; cupons: number
  mix: number; ticket: number; abast: number; combustivel: number; equipe: number
  rows: FuncProdRow[]
}

type Tone = 'green' | 'amber' | 'red' | 'gray' | 'none'
const MIX_TOL = 0.3   // p.p.
const TKT_TOL = 0.04  // 4%

const PILL: Record<Exclude<Tone, 'none'>, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}
const numTone = (t: Tone) => t === 'green' ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
  : t === 'amber' ? 'text-amber-600 dark:text-amber-400 font-semibold'
    : t === 'red' ? 'text-red-600 dark:text-red-400 font-semibold'
      : 'text-gray-700 dark:text-gray-300'

/* ─── KPI hero + cards (mesmos tons tintados da Visão Geral) ─── */
const KPI_TINT: Record<'green' | 'purple' | 'blue', string> = {
  green: 'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
  purple: 'from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900',
  blue: 'from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
}
const KPI_CHIP: Record<'green' | 'purple' | 'blue', string> = {
  green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  purple: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
}
const KpiCard = ({ label, value, Icon, tone, sub, hero, hint }: { label: string; value: string; Icon: typeof Wrench; tone: 'green' | 'purple' | 'blue'; sub?: ReactNode; hero?: boolean; hint?: string }) => (
  <div className={cn('flex flex-col rounded-2xl border border-gray-200 bg-gradient-to-br p-5 shadow-sm dark:border-gray-800', KPI_TINT[tone])}>
    <div className="flex items-start justify-between gap-2">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}{hint && <InfoHint text={hint} />}</p>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', KPI_CHIP[tone])}><Icon className="h-4 w-4" /></div>
    </div>
    <p className={cn('mt-2 font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100', hero ? 'text-[36px]' : 'text-[26px]')}>{value}</p>
    {sub && <div className="mt-2 text-[11.5px] tabular-nums text-gray-400 dark:text-gray-500">{sub}</div>}
  </div>
)

const Th = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th className={cn('whitespace-nowrap px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500', right ? 'text-right' : 'text-left')}>{children}</th>
)

const RedeView = ({ postos, byPosto, onOpenFuncionario }: { postos: Empresa[]; byPosto: Map<number, FrentistaProdData>; onOpenFuncionario?: (cod: number, postoCod: number) => void }) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const periodo = rangeLabel(dataInicial, dataFinal)

  const postoRows = useMemo<PostoAgg[]>(() => postos.map((p) => {
    const d = byPosto.get(p.codigo)
    const rows = d?.rows ?? []
    return {
      codigo: p.codigo, nome: p.fantasia,
      automotivos: d?.kpis.automotivo ?? 0,
      aditivada: d?.kpis.aditivadaLitros ?? 0,
      gasolina: sum(rows.map((r) => r.gasolinaLitros)),
      cupons: sum(rows.map((r) => r.cupons)),
      mix: d?.kpis.mixPct ?? 0,
      ticket: d?.kpis.ticketMedio ?? 0,
      abast: d?.kpis.abastecimentos ?? 0,
      combustivel: sum(rows.map((r) => r.litros)),
      equipe: rows.length,
      rows,
    }
  }).sort((a, b) => b.automotivos - a.automotivos), [postos, byPosto])

  const rede = useMemo(() => {
    const automotivos = sum(postoRows.map((r) => r.automotivos))
    const aditivada = sum(postoRows.map((r) => r.aditivada))
    const gasolina = sum(postoRows.map((r) => r.gasolina))
    const cupons = sum(postoRows.map((r) => r.cupons))
    return {
      automotivos, aditivada,
      abast: sum(postoRows.map((r) => r.abast)),
      equipe: sum(postoRows.map((r) => r.equipe)),
      mix: gasolina > 0 ? (aditivada / gasolina) * 100 : 0,
      ticket: cupons > 0 ? automotivos / cupons : 0,
      nPostos: postoRows.length,
    }
  }, [postoRows])

  const maxAdit = Math.max(1, ...postoRows.map((r) => r.aditivada))
  const topAuto = postoRows[0]?.codigo ?? -1

  const statusPosto = (r: PostoAgg) => {
    const belowMix = r.mix < rede.mix - MIX_TOL
    const aboveMix = r.mix > rede.mix + MIX_TOL
    const belowTkt = r.ticket < rede.ticket * (1 - TKT_TOL)
    const aboveTkt = r.ticket > rede.ticket * (1 + TKT_TOL)
    const nBelow = (belowMix ? 1 : 0) + (belowTkt ? 1 : 0)
    const mixTone: Tone = aboveMix ? 'green' : belowMix ? 'amber' : 'none'
    const tktTone: Tone = aboveTkt ? 'green' : belowTkt ? 'amber' : 'none'
    let label: string, tone: Exclude<Tone, 'none'>
    if (r.codigo === topAuto && !belowMix && !belowTkt) { label = 'Destaque'; tone = 'green' }
    else if (nBelow >= 2) { label = 'Atenção'; tone = 'red' }
    else if (belowMix) { label = 'Mix baixo'; tone = 'amber' }
    else if (belowTkt) { label = 'Ticket baixo'; tone = 'amber' }
    else if (aboveMix && aboveTkt) { label = 'Acima da média'; tone = 'green' }
    else { label = 'Na média'; tone = 'gray' }
    return { label, tone, mixTone, tktTone }
  }

  // Top 5 da rede (por automotivos) + funcionários que precisam de atenção.
  const top5 = useMemo(() => postoRows
    .flatMap((pr) => pr.rows.filter((r) => r.automotivo > 0 && !semCadastro(r.nome)).map((r) => ({ r, posto: pr.nome, postoCod: pr.codigo })))
    .sort((a, b) => b.r.automotivo - a.r.automotivo).slice(0, 5), [postoRows])

  const atencao = useMemo(() => {
    const out: { r: FuncProdRow; posto: string; postoCod: number; causa: 'mix' | 'ticket' }[] = []
    for (const pr of postoRows) {
      for (const r of pr.rows) {
        if (semCadastro(r.nome)) continue
        const mixB = pr.mix > 0 && r.mixPct < pr.mix
        const tktB = pr.ticket > 0 && r.ticket < pr.ticket
        if (!mixB && !tktB) continue
        const mg = pr.mix > 0 ? (r.mixPct - pr.mix) / pr.mix : 0
        const tg = pr.ticket > 0 ? (r.ticket - pr.ticket) / pr.ticket : 0
        const causa: 'mix' | 'ticket' = mixB && tktB ? (tg < mg ? 'ticket' : 'mix') : tktB ? 'ticket' : 'mix'
        out.push({ r, posto: pr.nome, postoCod: pr.codigo, causa })
      }
    }
    return out.sort((a, b) => (a.causa === 'mix' ? a.r.mixPct : a.r.ticket) - (b.causa === 'mix' ? b.r.mixPct : b.r.ticket))
  }, [postoRows])

  // Insight determinístico.
  const insight = useMemo(() => {
    if (postoRows.length < 2) return null
    const melhorMix = postoRows.reduce((a, b) => (b.mix > a.mix ? b : a))
    const piorMix = postoRows.reduce((a, b) => (b.mix < a.mix ? b : a))
    const melhorTkt = postoRows.reduce((a, b) => (b.ticket > a.ticket ? b : a))
    const ganho = Math.max(0, ((rede.mix - piorMix.mix) / 100) * piorMix.gasolina)
    const lider = melhorMix.codigo === melhorTkt.codigo ? melhorMix : null
    return { diff: melhorMix.mix - piorMix.mix, piorMix, ganho, lider }
  }, [postoRows, rede.mix])

  // Faturamento diário da rede (automotivos) — do cache, rede-wide.
  const codes = postoRows.map((r) => r.codigo)
  const { data: cacheRows = [] } = useQuery({
    queryKey: ['rede-auto-diario', codes.join(','), dataInicial, dataFinal],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos: codes, dataInicial, dataFinal }),
    enabled: codes.length > 0 && !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
  })
  const diario = useMemo(() => {
    const m = new Map<string, { fat: number; itens: number }>()
    for (const r of cacheRows) {
      if (r.setor !== 'automotivos') continue
      const dia = (r.data ?? '').slice(0, 10)
      if (!dia) continue
      const c = m.get(dia) ?? { fat: 0, itens: 0 }
      c.fat += r.faturamento; c.itens += r.quantidade
      m.set(dia, c)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, v]) => ({ data, litros: v.itens, faturamento: v.fat }))
  }, [cacheRows])

  const maxMixBar = Math.max(rede.mix, ...postoRows.map((r) => r.mix)) * 1.08 || 1
  const mixBars = [...postoRows].sort((a, b) => b.mix - a.mix)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <KpiCard hero label="Faturamento automotivos · rede" value={fmtR(rede.automotivos)} Icon={Wrench} tone="green" sub={`${rede.nPostos} ${rede.nPostos === 1 ? 'posto' : 'postos'} · ${fmtN(rede.equipe)} funcionários`} hint="Faturamento de produtos automotivos de loja (óleo, aditivo, filtro) vendidos na rede toda no período." />
        <KpiCard label="Litros de aditivada" value={fmtL(rede.aditivada)} Icon={Droplet} tone="purple" hint="Litros de gasolina aditivada vendidos — a gasolina de maior margem." />
        <KpiCard label="Mix de aditivada · rede" value={fmtMix(rede.mix)} Icon={Gauge} tone="purple" hint="Fatia da gasolina vendida que foi aditivada (aditivada ÷ total de gasolina). Mais alto = a equipe empurra mais o produto de maior margem." />
        <KpiCard label="Abastecimentos · rede" value={fmtN(rede.abast)} Icon={Fuel} tone="blue" hint="Número de abastecimentos (atendimentos) na rede toda no período." />
        <KpiCard label="Ticket médio · rede" value={fmtR(rede.ticket)} Icon={Receipt} tone="green" hint="Valor médio por cupom de automotivos (faturamento ÷ nº de cupons)." />
      </div>

      {/* Leitura do analista */}
      {insight && (
        <div className="flex gap-2.5 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50/80 to-white px-4 py-3 dark:border-gray-800 dark:from-gray-800/30 dark:to-transparent">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1e3a5f]/10 text-[#1e3a5f] dark:bg-blue-500/15 dark:text-blue-300"><Lightbulb className="h-3 w-3" /></span>
          <p className="text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
            A rede fechou o período em <strong className="text-gray-900 dark:text-gray-100">{fmtMix(rede.mix)}</strong> de mix de aditivada, mas a diferença entre o melhor e o pior posto é de <strong className="text-gray-900 dark:text-gray-100">{insight.diff.toFixed(1).replace('.', ',')} pontos</strong> — <strong>{insight.piorMix.nome}</strong> ({fmtMix(insight.piorMix.mix)}) puxa a média pra baixo.{' '}
            {insight.ganho > 0 && <>Se chegasse à média da rede, seriam <strong className="text-emerald-600 dark:text-emerald-400">+{fmtN(Math.round(insight.ganho))} L de aditivada</strong> no período <span className="text-gray-400">(estimativa)</span>.{' '}</>}
            {insight.lider && <>Do outro lado, <strong>{insight.lider.nome}</strong> lidera em mix e ticket ao mesmo tempo — vale entender o que a equipe de lá faz diferente.</>}
          </p>
        </div>
      )}

      {/* Desempenho por posto */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Desempenho por posto</h3>
          <span className="text-[11px] text-gray-400">ordenado por faturamento de automotivos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px]">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr><Th>Posto <InfoHint text="Cada linha é um posto da rede. Litros de combustível abaixo do nome." /></Th><Th right>Automotivos <InfoHint text="Faturamento de produtos automotivos de loja (óleo, aditivo, filtro) vendidos pela equipe no período." /></Th><Th right>Aditivada <InfoHint text="Litros de gasolina aditivada vendidos — a gasolina de maior margem." /></Th><Th right>Mix <InfoHint text="Fatia da gasolina vendida que foi aditivada (aditivada ÷ total de gasolina). Mais alto = a equipe empurra mais o produto de maior margem." /></Th><Th right>Abast. <InfoHint text="Número de abastecimentos (atendimentos) no período." /></Th><Th right>Ticket <InfoHint text="Valor médio por cupom de automotivos (faturamento ÷ nº de cupons)." /></Th><Th right>Equipe <InfoHint text="Número de funcionários com venda no período naquele posto." /></Th><Th right>Status <InfoHint text="Compara o posto com a média da rede: Destaque, Acima da média, Mix baixo, Ticket baixo, Atenção ou Na média." /></Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {postoRows.map((r) => {
                const s = statusPosto(r)
                return (
                  <tr key={r.codigo} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                    <td className="px-3 py-2.5">
                      <div className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-200">{r.nome}</div>
                      <div className="text-[10.5px] tabular-nums text-gray-400">{fmtN(Math.round(r.combustivel / 1000))}K L de combustível</div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-gray-800 dark:text-gray-200">{fmtRi(r.automotivos)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-violet-400 dark:bg-violet-500/70" style={{ width: `${Math.max(4, (r.aditivada / maxAdit) * 100)}%` }} /></div>
                        <span className="text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtL(r.aditivada)}</span>
                      </div>
                    </td>
                    <td className={cn('px-3 py-2.5 text-right text-[12.5px] tabular-nums', numTone(s.mixTone))}>{fmtMix(r.mix)}</td>
                    <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-600 dark:text-gray-300">{fmtN(r.abast)}</td>
                    <td className={cn('px-3 py-2.5 text-right text-[12.5px] tabular-nums', numTone(s.tktTone))}>{fmtR(r.ticket)}</td>
                    <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-600 dark:text-gray-300">{r.equipe}</td>
                    <td className="px-3 py-2.5 text-right"><span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold', PILL[s.tone])}>{s.label}</span></td>
                  </tr>
                )
              })}
              {/* Linha REDE */}
              <tr className="border-t border-gray-200 bg-gray-50/70 font-semibold dark:border-gray-700 dark:bg-white/[0.03]">
                <td className="px-3 py-2.5 text-[12.5px] text-gray-800 dark:text-gray-200">REDE</td>
                <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-800 dark:text-gray-200">{fmtRi(rede.automotivos)}</td>
                <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtL(rede.aditivada)}</td>
                <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtMix(rede.mix)}</td>
                <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtN(rede.abast)}</td>
                <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtR(rede.ticket)}</td>
                <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtN(rede.equipe)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 + Precisam de atenção */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Top 5 da rede</h3>
            <InfoHint text="Os 5 funcionários com maior faturamento de automotivos na rede toda no período." />
            <span className="text-[11px] text-gray-400">por faturamento de automotivos</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {top5.length === 0 ? <p className="px-4 py-6 text-center text-[12px] text-gray-400">Sem dados no período.</p> : top5.map(({ r, posto, postoCod }, i) => (
              <div key={r.funcionarioCodigo} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: i === 0 ? '#FCB619' : '#152238', color: i === 0 ? '#7a4f00' : '#fff' }}>{iniciais(r.nome)}</span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpenFuncionario?.(r.funcionarioCodigo, postoCod)} disabled={!onOpenFuncionario} title="Ver detalhe do funcionário" className="block max-w-full truncate text-left text-[12.5px] font-semibold text-gray-800 enabled:hover:underline disabled:cursor-default dark:text-gray-200">{r.nome}</button>
                  <p className="truncate text-[10.5px] text-gray-400">{posto} · mix {fmtMix(r.mixPct)} · ticket {fmtR(r.ticket)}</p>
                </div>
                <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', i === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200')}>{fmtRi(r.automotivo)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Precisam de atenção</h3>
            <InfoHint text="Funcionários abaixo da média do PRÓPRIO posto em mix ou ticket — onde treinar ou apoiar." />
            {atencao.length > 0 && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{atencao.length} na rede</span>}
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {atencao.length === 0 ? <p className="px-4 py-6 text-center text-[12px] text-gray-400">Ninguém abaixo da média do posto. 👏</p> : atencao.slice(0, 5).map(({ r, posto, postoCod, causa }) => (
              <div key={`${posto}-${r.funcionarioCodigo}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#152238] text-[10px] font-bold text-white">{iniciais(r.nome)}</span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpenFuncionario?.(r.funcionarioCodigo, postoCod)} disabled={!onOpenFuncionario} title="Ver detalhe do funcionário" className="block max-w-full truncate text-left text-[12.5px] font-semibold text-gray-800 enabled:hover:underline disabled:cursor-default dark:text-gray-200">{r.nome}</button>
                  <p className="truncate text-[10.5px] text-gray-400">{posto} · {fmtN(r.abastecimentos)} abastecimentos</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-bold tabular-nums text-amber-600 dark:text-amber-400">{causa === 'mix' ? fmtMix(r.mixPct) : fmtR(r.ticket)}</p>
                  <p className="text-[9.5px] font-medium text-amber-600/80 dark:text-amber-400/70">{causa === 'mix' ? 'mix baixo' : 'ticket baixo'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Faturamento diário + Mix por posto */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        {diario.length >= 2 ? (
          <AnaliseSemanalLineCard data={diario} title="Faturamento diário · rede" noun="faturamento" unit="itens" plotFaturamento accent="#059669" scope="da rede" height={240} cardBg="bg-white dark:bg-gradient-to-b dark:from-gray-900 dark:to-black" />
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Faturamento diário · rede</h3>
            <p className="py-12 text-center text-[12px] text-gray-400">Sem histórico diário apurado no período.</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <h3 className="mb-3 text-[13px] font-semibold text-gray-800 dark:text-gray-200">Mix de aditivada por posto</h3>
          <div className="space-y-2.5">
            {mixBars.map((r) => {
              const s = statusPosto(r)
              const fill = s.tone === 'red' ? 'bg-red-500' : s.tone === 'amber' ? 'bg-amber-400 dark:bg-amber-500' : s.mixTone === 'green' || s.tone === 'green' ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'
              return (
                <div key={r.codigo}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="truncate text-gray-600 dark:text-gray-300">{r.nome}</span>
                    <span className={cn('tabular-nums font-semibold', numTone(s.mixTone))}>{fmtMix(r.mix)}</span>
                  </div>
                  <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={cn('h-full rounded-full', fill)} style={{ width: `${Math.max(3, (r.mix / maxMixBar) * 100)}%` }} />
                    <div className="absolute top-0 h-full w-[2px] bg-gray-500/70 dark:bg-gray-300/60" style={{ left: `${(rede.mix / maxMixBar) * 100}%` }} title={`média da rede ${fmtMix(rede.mix)}`} />
                  </div>
                </div>
              )
            })}
            <p className="pt-1 text-[10px] text-gray-400">— média da rede · {fmtMix(rede.mix)}</p>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <p className="px-1 text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">
        Os deltas comparam cada posto com a média ponderada da rede no período. "Precisam de atenção" = funcionários abaixo da média do próprio posto em mix ou ticket.{periodo && ` Período: ${periodo}.`}
      </p>
    </div>
  )
}

/* Carregamento com progresso real do fan-out — mostra posto a posto o que já
   chegou (a Visão Geral é por posto; aqui carregamos todos ao vivo). */
const RedeLoading = ({ postos, byPosto }: { postos: Empresa[]; byPosto: Map<number, FrentistaProdData> }) => {
  const isDone = (cod: number) => { const d = byPosto.get(cod); return !!d && !d.isLoading }
  const done = postos.filter((p) => isDone(p.codigo)).length
  const pct = postos.length ? Math.round((done / postos.length) * 100) : 0
  return (
    <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-12 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
        <Loader2 className="h-5 w-5 animate-spin text-[#2563eb]" />
        <span className="text-sm font-semibold">Carregando resumo da rede…</span>
      </div>
      <p className="mt-1 text-[12px] tabular-nums text-gray-400">{done} de {postos.length} postos · {pct}%</p>

      <div className="mt-4 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded-full bg-[#2563eb] transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>

      <div className="mt-5 w-full max-w-md space-y-1.5">
        {postos.map((p) => {
          const ok = isDone(p.codigo)
          return (
            <div key={p.codigo} className="flex items-center gap-2 text-[12.5px]">
              {ok
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
              <span className={cn('min-w-0 flex-1 truncate', ok ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400')}>{p.fantasia}</span>
              <span className={cn('shrink-0 text-[11px] tabular-nums', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')}>{ok ? 'pronto' : 'carregando…'}</span>
            </div>
          )
        })}
      </div>

      <p className="mt-5 max-w-md text-center text-[11px] text-gray-400">
        Cada posto é carregado ao vivo, com a mesma fonte da Visão Geral — pode levar alguns segundos.
      </p>
    </div>
  )
}

const RedeCacheLoading = () => (
  <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-16 text-sm text-gray-500 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black dark:text-gray-300">
    <Loader2 className="h-5 w-5 animate-spin text-[#2563eb]" /> Carregando resumo da rede…
  </div>
)

const ProdutividadeRede = ({ postos, onOpenFuncionario }: { postos: Empresa[]; onOpenFuncionario?: (cod: number, postoCod: number) => void }) => {
  const codes = useMemo(() => postos.map((p) => p.codigo), [postos])
  // Fonte primária: cache rede-wide (uma leitura, dias apurados). Sem fan-out.
  const cache = useRedeProdutividadeCache(codes)

  // Fan-out ao vivo — só FALLBACK quando não há nada apurado no período.
  const [fanout, setFanout] = useState<Map<number, FrentistaProdData>>(() => new Map())
  const onData = useCallback((cod: number, d: FrentistaProdData) => {
    setFanout((prev) => { const n = new Map(prev); n.set(cod, d); return n })
  }, [])

  if (cache.isLoading) return <RedeCacheLoading />
  if (cache.hasCache) return <RedeView postos={postos} byPosto={cache.byPosto} onOpenFuncionario={onOpenFuncionario} />

  // Cache vazio (período não apurado) → cai no fan-out ao vivo.
  const ready = postos.length > 0 && postos.every((p) => { const d = fanout.get(p.codigo); return d && !d.isLoading })
  return (
    <>
      {postos.map((p) => <PostoLoader key={p.codigo} posto={p} onData={onData} />)}
      {ready ? <RedeView postos={postos} byPosto={fanout} onOpenFuncionario={onOpenFuncionario} /> : <RedeLoading postos={postos} byPosto={fanout} />}
    </>
  )
}

export default ProdutividadeRede
