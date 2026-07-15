import { useMemo, useState } from 'react'
import { Tag, Sparkles, Lock, AlertTriangle, ShieldCheck, Lightbulb, ChevronRight, TrendingDown, TrendingUp, Loader2, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import useGestaoPrecos, { type GestaoPrecoRow } from '@/pages/Dashboard/hooks/useGestaoPrecos'
import useBaratao from '@/pages/Dashboard/hooks/useBaratao'
import GestaoPrecosTabelas from '@/pages/Dashboard/components/GestaoPrecosTabelas'
import GestaoPrecosCliente from '@/pages/Dashboard/components/GestaoPrecosCliente'
import { BASE_DESVIO_LABEL, severidadeCedido, type SeveridadeCedido } from '@/lib/gestaoPrecos'
import { formatCurrencyInt, formatLiters } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const r3 = (v: number) => `${v < 0 ? '−' : ''}R$ ${Math.abs(v).toFixed(3).replace('.', ',')}`
const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const SEV_ROW: Record<SeveridadeCedido, string> = {
  alto: 'bg-red-50/60 dark:bg-red-950/15',
  medio: 'bg-amber-50/50 dark:bg-amber-950/[0.12]',
  baixo: '',
}

type SubId = 'produto' | 'empresa' | 'cliente' | 'tabelas'
const SUB_TABS: { id: SubId; label: string; lock?: boolean }[] = [
  { id: 'produto', label: 'Por produto' },
  { id: 'empresa', label: 'Por empresa' },
  { id: 'cliente', label: 'Por cliente' },
  { id: 'tabelas', label: 'Tabelas cadastradas' },
]

/* ── Aba de desvio (serve "Por produto" e "Por empresa") ── */
const AbaDesvio = ({ rows, cedidoGlobal, entidade, baratao, barataoCruz }: {
  rows: GestaoPrecoRow[]; cedidoGlobal: number; entidade: 'produto' | 'posto'
  baratao: Map<number, number>; barataoCruz: Map<string, number>
}) => {
  const ent = entidade === 'produto' ? { col: 'Produto', plural: 'Produtos' } : { col: 'Empresa', plural: 'Postos' }
  const outroLabel = entidade === 'produto' ? 'Posto' : 'Produto'
  const [aberto, setAberto] = useState<GestaoPrecoRow | null>(null)
  const agg = useMemo(() => {
    let vol = 0, tabW = 0, pratW = 0, cedido = 0, acresDesc = 0
    for (const r of rows) {
      vol += r.volume; tabW += r.precoTabelaMedio * r.volume; pratW += r.precoPraticadoMedio * r.volume
      cedido += r.lbCedido; acresDesc += r.acresDesc
    }
    const tabela = vol > 0 ? tabW / vol : 0
    const praticado = vol > 0 ? pratW / vol : 0
    const vsTabelaPct = tabela > 0 ? (praticado / tabela - 1) * 100 : 0
    const top = rows[0] ?? null
    const conc = top && cedidoGlobal > 0 ? (top.lbCedido / cedidoGlobal) * 100 : 0
    // Impacto total no LB = fiscal (acrés−desc, já sinalizado) − cedido na bomba.
    const total = acresDesc - cedido
    return { tabela, praticado, desvio: tabela - praticado, vsTabelaPct, top, conc, vol, cedido, acresDesc, total }
  }, [rows, cedidoGlobal])

  // Total fiscal da coluna Acrés./Desc. (acréscimos − descontos) — bate com o WebPosto.
  const acresDescGeral = agg.acresDesc
  const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${formatCurrencyInt(Math.abs(v))}`
  const barTotal = useMemo(() => rows.reduce((s, r) => s + (baratao.get(r.key) ?? 0), 0), [rows, baratao])
  // Composição da margem cedida: fiscal (|acrés−desc|) vs bomba (cedido).
  const fiscalMag = Math.abs(agg.acresDesc)
  const compDenom = fiscalMag + agg.cedido
  const fiscalPct = compDenom > 0 ? (fiscalMag / compDenom) * 100 : 0
  const bombaPct = 100 - fiscalPct

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Nenhum abastecimento com preço de tabela no período/escopo.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Herói único: quanto a rede cedeu + de onde (cupom × bomba), Baratão aninhado */}
      <div className="rounded-2xl bg-[#1e3a5f] px-5 py-5 text-white" style={{ boxShadow: '0 8px 22px -12px rgba(30,58,95,.6)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9db8d6]">Margem cedida</p>
            <p className="mt-0.5 text-[12px] text-[#9db8d6]/80">quanto a rede deixou de ganhar no período — preço abaixo do cadastro + descontos no cupom</p>
          </div>
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-white/10">
            {agg.total <= 0 ? <TrendingDown className="h-4 w-4 text-red-300" /> : <TrendingUp className="h-4 w-4 text-emerald-300" />}
          </span>
        </div>
        <div className={cn('mt-2 text-[34px] font-extrabold leading-none tabular-nums', agg.total <= 0 ? 'text-[#ffd7d7]' : 'text-emerald-200')}>
          {agg.total > 0 ? '+' : ''}{formatCurrencyInt(Math.abs(agg.total))}
        </div>
        {/* Barra de composição */}
        <div className="mt-3.5 flex h-[9px] overflow-hidden rounded-[5px] bg-white/[0.12]">
          <div style={{ width: `${fiscalPct}%`, background: '#f87171' }} />
          <div style={{ width: `${bombaPct}%`, background: '#fbbf24' }} />
        </div>
        {/* 2 drivers (Cupom / Bomba) — a soma dá o total acima */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl bg-white/[0.06] px-3.5 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#c8d7e8]"><span className="h-2 w-2 rounded-full bg-[#f87171]" />No cupom</span>
              <InfoHint className="text-white/50 hover:text-white" text="Acréscimos − descontos lançados nas vendas (base fiscal). Bate com o relatório de Vendas por Período do WebPosto. Inclui os descontos de app (99/Baratão) que passam pelo cupom." />
            </div>
            <p className={cn('mt-1 text-[19px] font-bold tabular-nums', acresDescGeral < 0 ? 'text-red-200' : acresDescGeral > 0 ? 'text-emerald-200' : 'text-white/70')}>{signed(acresDescGeral)}</p>
            <p className="text-[10.5px] text-[#9db8d6]">descontos − acréscimos · {Math.round(fiscalPct)}% do total</p>
            {barTotal > 0 && <p className="mt-1 text-[10.5px] text-[#c8d7e8]">↳ dentro do cupom · Baratão −{formatCurrencyInt(barTotal)}</p>}
          </div>
          <div className="rounded-xl bg-white/[0.06] px-3.5 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#c8d7e8]"><span className="h-2 w-2 rounded-full bg-[#fbbf24]" />Na bomba</span>
              <InfoHint className="text-white/50 hover:text-white" text="Preço batido na bomba abaixo do preço de cadastro: Σ (cadastro − praticado) × litros (base física). Métrica interna do Visor, sem equivalente no relatório fiscal do WebPosto." />
            </div>
            <p className="mt-1 text-[19px] font-bold tabular-nums text-amber-200">{agg.cedido > 0 ? `−${formatCurrencyInt(agg.cedido)}` : formatCurrencyInt(0)}</p>
            <p className="text-[10.5px] text-[#9db8d6]">preço abaixo do cadastro · {Math.round(bombaPct)}% do total</p>
          </div>
        </div>
      </div>

      {/* Leitura do especialista (answer-first): sobe pro topo, antes da tabela */}
      {agg.top && cedidoGlobal > 0 && (
        <div className="rounded-2xl border border-[#e6ebf1] bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Lightbulb className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-[#0f172a] dark:text-gray-100">Leitura do especialista</p>
              <p className="text-[11.5px] text-[#94a3b8]">Diagnóstico do analista de combustível sobre o desvio de preço</p>
            </div>
            <span className="shrink-0 rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1 text-[10.5px] font-bold text-[#b91c1c] dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">{agg.top.label} · concentração</span>
          </div>
          <p className="mt-3.5 text-[14px] leading-[1.65] text-[#334155] dark:text-gray-300">
            <strong className="font-bold text-[#0f172a] dark:text-gray-100">{agg.top.label}</strong> concentra <strong className="font-bold text-[#0f172a] dark:text-gray-100">{pct1(agg.conc)} do desconto concedido</strong> ({formatCurrencyInt(agg.top.lbCedido)}) — desvio médio de <strong className="font-bold text-[#0f172a] dark:text-gray-100">{r3(agg.top.desvioMedio)}/L</strong> abaixo da tabela. No total a rede cedeu <strong className="font-bold text-[#0f172a] dark:text-gray-100">{formatCurrencyInt(cedidoGlobal)}</strong> por ajuste de bomba abaixo do cadastro.
          </p>
          <div className="mt-3 flex gap-2.5 rounded-xl border border-[#dbeafe] bg-[#f0f7ff] px-3.5 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#2563eb]">Recomendação</p>
              <p className="mt-1 text-[13.5px] text-[#334155] dark:text-gray-300">Padronizar um teto de desconto de bomba pela referência do produto mais disciplinado e revisar os ajustes de {agg.top.label}. <span className="text-[#94a3b8]">A IA diagnostica; a decisão e a execução são do gestor.</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Tabela enxuta: preço praticado × tabela + margem cedida (detalhe no clique) */}
      <div className="rounded-2xl border border-[#e6ebf1] bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#f1f5f9] px-4 py-3 dark:border-gray-800">
          <h3 className="text-[13.5px] font-bold text-[#0f172a] dark:text-gray-100">Preço praticado × tabela</h3>
          <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[10.5px] font-medium text-[#94a3b8] dark:bg-gray-800 dark:text-gray-400">clique numa linha pra ver de onde cedeu (cupom · bomba · Baratão)</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="px-3 py-2 font-semibold">{ent.col}</th>
              <th className="px-2 py-2 text-right font-semibold">Tabela</th>
              <th className="px-2 py-2 text-right font-semibold">Praticado</th>
              <th className="px-2 py-2 text-right font-semibold">Desvio R$/L</th>
              <th className="px-2 py-2 text-right font-semibold">Volume</th>
              <th className="px-3 py-2 text-right font-semibold">
                <span className="inline-flex items-center gap-1">Margem cedida<InfoHint text="Impacto total no lucro bruto do produto = descontos/acréscimos no cupom (fiscal) + preço abaixo do cadastro na bomba (físico). Negativo = cedeu; positivo = acrescentou. Clique pra ver a composição." /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {rows.map((r) => {
              const sev = severidadeCedido(r.pctCedido)
              const cedeu = r.desvioMedio > 0.0005
              const cedidaRow = r.acresDesc - r.lbCedido
              return (
                <tr key={r.key} onClick={() => setAberto(r)} title={`Ver de onde ${r.label} cedeu`}
                  className={cn('cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40', SEV_ROW[sev])}>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                    <span className="inline-flex items-center gap-1">{r.label}<ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" /></span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(r.precoTabelaMedio)}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{r3(r.precoPraticadoMedio)}</td>
                  <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', cedeu ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(r.desvioMedio)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatLiters(r.volume)}</td>
                  <td className={cn('px-3 py-2 text-right font-bold tabular-nums', cedidaRow < 0 ? 'text-red-600 dark:text-red-400' : cedidaRow > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')}>
                    {Math.abs(cedidaRow) < 0.5 ? '—' : signed(cedidaRow)}
                  </td>
                </tr>
              )
            })}
            {/* Totalizador */}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
              <td className="px-3 py-2">Total</td>
              <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(agg.tabela)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r3(agg.praticado)}</td>
              <td className={cn('px-2 py-2 text-right tabular-nums', agg.desvio > 0.0005 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(agg.desvio)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatLiters(agg.vol)}</td>
              <td className={cn('px-3 py-2 text-right tabular-nums', agg.total < 0 ? 'text-red-600 dark:text-red-400' : agg.total > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')}>{signed(agg.total)}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal "de onde cedeu" — composição + quebra pela outra dimensão (com preços) */}
      <Dialog open={!!aberto} onOpenChange={(o) => { if (!o) setAberto(null) }}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-2xl p-0">
          {aberto && (() => {
            const maxDet = Math.max(...aberto.detalhe.map((d) => d.lbCedido), 1)
            const totalCedida = (aberto.acresDesc ?? 0) - aberto.lbCedido
            // Baratão cruzado (produto×posto). A ordem da chave depende de qual
            // dimensão está aberta: produto → linhas são postos; posto → produtos.
            const barKey = (dKey: number) => (entidade === 'produto' ? `${aberto.key}|${dKey}` : `${dKey}|${aberto.key}`)
            const bTotalProd = baratao.get(aberto.key) ?? 0
            const temBaratao = bTotalProd > 0
            return (
            <>
              <div className="border-b border-gray-100 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-5 py-4 text-white dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="text-[15px] font-bold">De onde cedeu — {aberto.label}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-[12px] text-white/60">
                      Impacto total no LB: <span className={cn('font-bold', totalCedida < 0 ? 'text-red-200' : 'text-emerald-200')}>{totalCedida < 0 ? '−' : '+'}{formatCurrencyInt(Math.abs(totalCedida))}</span>
                    </DialogDescription>
                  </div>
                </div>
                {/* Composição em chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" />No cupom
                    <b className="tabular-nums text-white">{aberto.acresDesc < 0 ? '−' : aberto.acresDesc > 0 ? '+' : ''}{formatCurrencyInt(Math.abs(aberto.acresDesc))}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />Na bomba
                    <b className="tabular-nums text-white">−{formatCurrencyInt(aberto.lbCedido)}</b>
                  </span>
                  {(baratao.get(aberto.key) ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />Baratão
                      <b className="tabular-nums text-white">−{formatCurrencyInt(baratao.get(aberto.key) as number)}</b>
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-[11px] text-white/50">Ajuste na bomba quebrado por {outroLabel.toLowerCase()} — preço de tabela × praticado:</p>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
                    <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
                      <th className="px-4 py-2 font-semibold">{outroLabel}</th>
                      <th className="px-2 py-2 text-right font-semibold">Tabela</th>
                      <th className="px-2 py-2 text-right font-semibold">Praticado</th>
                      <th className="px-2 py-2 text-right font-semibold">Desvio R$/L</th>
                      <th className="px-2 py-2 text-right font-semibold">Volume</th>
                      <th className="px-2 py-2 text-right font-semibold">LB cedido</th>
                      {temBaratao && (
                        <th className="border-l border-gray-100 px-4 py-2 text-right font-semibold dark:border-gray-800">
                          <span className="inline-flex items-center gap-1 text-[#2563eb] dark:text-blue-400">Baratão<InfoHint text="Desconto do programa Baratão neste produto/posto (base fiscal · cupom). Já está DENTRO de 'No cupom' — mostrado à parte só pra diagnóstico. Não some com o LB cedido (bases diferentes: fiscal × físico)." /></span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {aberto.detalhe.map((d) => {
                      const cedeu = d.desvioMedio > 0.0005
                      return (
                      <tr key={d.key} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          {d.label}
                          <span className="mt-1 block h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <span className="block h-full rounded-full bg-red-400/80 dark:bg-red-500/70" style={{ width: `${(d.lbCedido / maxDet) * 100}%` }} />
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(d.precoTabelaMedio)}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{r3(d.precoPraticadoMedio)}</td>
                        <td className={cn('px-2 py-2 text-right tabular-nums', cedeu ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(d.desvioMedio)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatLiters(d.volume)}</td>
                        <td className={cn('px-2 py-2 text-right font-bold tabular-nums', d.lbCedido > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{d.lbCedido > 0 ? `−${formatCurrencyInt(d.lbCedido)}` : '—'}</td>
                        {temBaratao && (() => {
                          const b = barataoCruz.get(barKey(d.key)) ?? 0
                          return <td className={cn('border-l border-gray-100 px-4 py-2 text-right font-bold tabular-nums dark:border-gray-800', b > 0 ? 'text-[#2563eb] dark:text-blue-400' : 'text-gray-400')}>{b > 0 ? `−${formatCurrencyInt(b)}` : '—'}</td>
                        })()}
                      </tr>
                      )
                    })}
                    {/* Total */}
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(aberto.precoTabelaMedio)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r3(aberto.precoPraticadoMedio)}</td>
                      <td className={cn('px-2 py-2 text-right tabular-nums', aberto.desvioMedio > 0.0005 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(aberto.desvioMedio)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatLiters(aberto.volume)}</td>
                      <td className={cn('px-2 py-2 text-right tabular-nums', aberto.lbCedido > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{aberto.lbCedido > 0 ? `−${formatCurrencyInt(aberto.lbCedido)}` : '—'}</td>
                      {temBaratao && <td className="border-l border-gray-100 px-4 py-2 text-right tabular-nums text-[#2563eb] dark:border-gray-800 dark:text-blue-400">−{formatCurrencyInt(bTotalProd)}</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="border-t border-gray-100 px-5 py-2.5 text-[10.5px] text-gray-400 dark:border-gray-800">
                {BASE_DESVIO_LABEL} · só abastecimentos com preço de tabela.
              </p>
            </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const GestaoPrecos = () => {
  const data = useGestaoPrecos()
  const baratao = useBaratao()
  const [sub, setSub] = useState<SubId>('produto')

  const cov = data.cobertura

  return (
    <div className="space-y-4">
      {/* Faixa-flag: o que a IA cruza + selo Analista IA + base */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[#dbeafe] bg-gradient-to-r from-[#eff6ff] to-[#fbfdff] px-[18px] py-[15px] dark:border-blue-900/40 dark:from-blue-950/20 dark:to-gray-900">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#1e3a5f] text-white"><Tag className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-[#0f172a] dark:text-gray-100">Gestão de Preços — onde a rede cede margem</p>
          <p className="mt-[3px] text-[12px] leading-[1.5] text-[#64748b] dark:text-gray-400">
            Quanto a rede deixou de ganhar dando preço <strong className="font-semibold text-[#334155] dark:text-gray-300">abaixo do cadastro na bomba</strong> e <strong className="font-semibold text-[#334155] dark:text-gray-300">descontos no cupom</strong> — por produto, posto e cliente.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1e3a5f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          <Sparkles className="h-3 w-3 text-[#5eead4]" /> Analista IA
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-white px-2.5 py-1 text-[10px] font-medium text-[#64748b] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-[#94a3b8]" />{BASE_DESVIO_LABEL}
        </span>
      </div>

      {/* Cobertura — escondida no erro total (números 0/0 seriam enganosos).
          Quando ~100% vira um selinho compacto; só expande (com barra + aviso)
          quando fica parcial, que é quando o número importa. */}
      {!(data.isError && data.byProduto.length === 0) && (
        cov.pct >= 99.5 ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#dcfce7] bg-[#f6fef9] px-2.5 py-1 text-[11px] font-medium text-[#15803d] dark:border-emerald-900/40 dark:bg-emerald-950/10 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Cobertura {pct1(cov.pct)}
            <InfoHint side="right" text="Mede quantos abastecimentos têm preço de tabela (preco_cadastro). Sem ele, o desvio não é calculável e o abastecimento sai da conta." />
          </div>
        ) : (
          <div className="flex items-center gap-3.5 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-[11px] dark:border-amber-900/40 dark:bg-amber-950/15">
            <AlertTriangle className="h-[18px] w-[18px] shrink-0 text-amber-500" />
            <div className="text-[12.5px] text-[#334155] dark:text-gray-300">
              <strong className="font-bold text-amber-700 dark:text-amber-400">Cobertura {pct1(cov.pct)}</strong> — {cov.comTabela.toLocaleString('pt-BR')}/{cov.totalFills.toLocaleString('pt-BR')} abastecimentos com preço de tabela. Número <strong>parcial</strong> — abastecimentos sem cadastro de preço ficam de fora.
            </div>
            <div className="ml-2 hidden h-[6px] max-w-[280px] flex-1 overflow-hidden rounded bg-amber-100 sm:block dark:bg-amber-950/40">
              <div className="h-full rounded" style={{ width: `${Math.min(100, cov.pct)}%`, background: '#f59e0b' }} />
            </div>
            <InfoHint side="left" className="ml-auto" text="Mede quantos abastecimentos têm preço de tabela (preco_cadastro). Sem ele, o desvio não é calculável e o abastecimento sai da conta. Sobe quando o cron de apuração carimba o preço no cache." />
          </div>
        )
      )}

      {/* Sub-abas */}
      <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
        {SUB_TABS.map((t) => {
          const active = sub === t.id
          return (
            <span key={t.id} className="inline-flex items-center">
              {/* "Tabelas cadastradas" é dado de referência (não uma lente
                  analítica) → separador antes dela. */}
              {t.id === 'tabelas' && <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />}
              <button type="button" disabled={t.lock} onClick={() => !t.lock && setSub(t.id)}
                title={t.lock ? 'Depende da ingestão das tabelas do WebPosto (Fase 2)' : undefined}
                className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  active ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : t.lock ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200')}>
                {t.lock && <Lock className="h-3 w-3" />}{t.label}
              </button>
            </span>
          )
        })}
      </div>

      {/* Conteúdo */}
      {sub === 'tabelas' ? (
        <GestaoPrecosTabelas />
      ) : sub === 'cliente' ? (
        <GestaoPrecosCliente />
      ) : (data.isLoading || data.isFetching) && data.byProduto.length === 0 ? (
        <div className="space-y-3">
          <p className="flex items-center justify-center gap-2 py-1 text-[13px] text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados de preços…
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : data.isError && data.byProduto.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Não foi possível carregar os abastecimentos físicos</p>
          <p className="mx-auto mt-1 max-w-lg text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
            A API da Quality retornou erro ao buscar o <code className="rounded bg-amber-100 px-1 text-[12px] dark:bg-amber-900/40">/ABASTECIMENTO</code> — <strong>não é problema do painel</strong>. As demais telas (base fiscal) seguem normais. Tente de novo em instantes; se persistir, é indisponibilidade do lado da Quality.
          </p>
          <button
            type="button"
            onClick={() => data.refetch()}
            className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
          </button>
        </div>
      ) : sub === 'produto' ? (
        <AbaDesvio rows={data.byProduto} cedidoGlobal={data.global.lbCedido} entidade="produto" baratao={baratao.porProduto} barataoCruz={baratao.porProdutoPosto} />
      ) : sub === 'empresa' ? (
        <AbaDesvio rows={data.byPosto} cedidoGlobal={data.global.lbCedido} entidade="posto" baratao={baratao.porPosto} barataoCruz={baratao.porProdutoPosto} />
      ) : null}

      {/* Proveniência */}
      <p className="text-center text-[11px] text-[#94a3b8]">
        Preço original e tabela por cliente vêm do WebPosto · preço praticado é o valor médio batido na bomba no cupom fiscal.
      </p>
    </div>
  )
}

export default GestaoPrecos
