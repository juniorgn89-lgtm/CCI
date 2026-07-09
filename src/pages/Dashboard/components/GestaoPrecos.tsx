import { useMemo, useState, type ReactNode } from 'react'
import { Tag, Sparkles, Lock, AlertTriangle, ShieldCheck, Crosshair, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import useGestaoPrecos, { type GestaoPrecoRow } from '@/pages/Dashboard/hooks/useGestaoPrecos'
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

/* ── KPI ── */
const Kpi = ({ label, value, sub, tone, help, foot }: {
  label: string; value: string; sub?: string; tone?: 'red' | 'amber' | 'green' | 'navy'; help: string; foot?: ReactNode
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <InfoHint text={help} />
    </div>
    <p className={cn('mt-1.5 text-[26px] font-extrabold leading-none tabular-nums',
      tone === 'red' ? 'text-red-600 dark:text-red-400'
      : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
      : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-[#1e3a5f] dark:text-blue-200')}>
      {value}
    </p>
    {sub && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>}
    {foot && <div className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">{foot}</div>}
  </div>
)

/* ── Aba de desvio (serve "Por produto" e "Por empresa") ── */
const AbaDesvio = ({ rows, cedidoGlobal, entidade }: {
  rows: GestaoPrecoRow[]; cedidoGlobal: number; entidade: 'produto' | 'posto'
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

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Nenhum abastecimento com preço de tabela no período/escopo.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Decomposição da margem cedida — total + 2 fontes. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Margem cedida total" tone="navy" value={signed(agg.total)}
          sub="fiscal + ajuste na bomba"
          help="Impacto total no lucro bruto = Acrés./Desc. (fiscal) − LB cedido na bomba. A soma das 2 fontes ao lado." />
        <Kpi label="Acrés./Desc. (fiscal)" tone={acresDescGeral < 0 ? 'red' : acresDescGeral > 0 ? 'green' : 'navy'}
          value={signed(acresDescGeral)}
          sub="desconto/acréscimo no cupom" help="Acréscimos − descontos lançados nas vendas (base fiscal). É a fonte 'cupom' — inclui descontos de app (99/Baratão) que passam pelo cupom fiscal. Compara com o relatório de Vendas por Período do WebPosto." />
        <Kpi label="Ajuste na bomba" tone={agg.cedido > 0 ? 'red' : 'navy'} value={signed(-agg.cedido)}
          sub="preço da bomba abaixo do cadastro" help="LB cedido por vender abaixo do preço de cadastro: Σ (preço de cadastro − praticado) × litros (base física). Métrica interna do Visor, sem equivalente no relatório fiscal do WebPosto." />
      </div>

      {/* Tabela praticado × tabela */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="px-3 py-2 font-semibold">{ent.col}</th>
              <th className="px-2 py-2 text-center font-semibold">Situação</th>
              <th className="px-2 py-2 text-right font-semibold">Tabela</th>
              <th className="px-2 py-2 text-right font-semibold">Praticado</th>
              <th className="px-2 py-2 text-right font-semibold">Desvio R$/L</th>
              <th className="px-2 py-2 text-right font-semibold">Volume</th>
              <th className="px-2 py-2 text-right font-semibold">
                <span className="inline-flex items-center gap-1">ACRÉS./DESC<InfoHint text="Acréscimos − descontos lançados nas vendas (base fiscal). Bate com o WebPosto. Negativo = desconto predominou." /></span>
              </th>
              <th className="px-2 py-2 text-right font-semibold">
                <span className="inline-flex items-center gap-1">Ajuste na bomba<InfoHint text="Lucro bruto cedido por vender abaixo do preço de cadastro: Σ (preço de cadastro − praticado) × litros (base física)." /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {rows.map((r) => {
              const sev = severidadeCedido(r.pctCedido)
              const cedeu = r.desvioMedio > 0.0005
              return (
                <tr key={r.key} onClick={() => setAberto(r)} title={`Ver de onde ${r.label} cedeu`}
                  className={cn('cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40', SEV_ROW[sev])}>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                    <span className="inline-flex items-center gap-1">{r.label}<ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" /></span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.acresDesc < 0 ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:bg-red-950/30 dark:text-red-400">Cedeu</span>
                    ) : r.acresDesc > 0 ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">Acrescentou</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">Na tabela</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(r.precoTabelaMedio)}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{r3(r.precoPraticadoMedio)}</td>
                  <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', cedeu ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(r.desvioMedio)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatLiters(r.volume)}</td>
                  <td className={cn('px-2 py-2 text-right font-bold tabular-nums', r.acresDesc < 0 ? 'text-red-600 dark:text-red-400' : r.acresDesc > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')}>
                    {r.acresDesc === 0 ? '—' : `${r.acresDesc < 0 ? '−' : '+'}${formatCurrencyInt(Math.abs(r.acresDesc))}`}
                  </td>
                  <td className={cn('px-2 py-2 text-right font-bold tabular-nums', r.lbCedido > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r.lbCedido > 0 ? `−${formatCurrencyInt(r.lbCedido)}` : '—'}</td>
                </tr>
              )
            })}
            {/* Totalizador */}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
              <td className="px-3 py-2">Total</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(agg.tabela)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r3(agg.praticado)}</td>
              <td className={cn('px-2 py-2 text-right tabular-nums', agg.desvio > 0.0005 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(agg.desvio)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatLiters(agg.vol)}</td>
              <td className={cn('px-2 py-2 text-right tabular-nums', agg.acresDesc < 0 ? 'text-red-600 dark:text-red-400' : agg.acresDesc > 0 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
                {agg.acresDesc === 0 ? '—' : `${agg.acresDesc < 0 ? '−' : '+'}${formatCurrencyInt(Math.abs(agg.acresDesc))}`}
              </td>
              <td className={cn('px-2 py-2 text-right tabular-nums', agg.cedido > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{agg.cedido > 0 ? `−${formatCurrencyInt(agg.cedido)}` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Leitura do especialista (determinística, read-only) */}
      {agg.top && cedidoGlobal > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-4 py-2.5 text-white">
            <Crosshair className="h-4 w-4 text-white/80" />
            <p className="text-[13px] font-semibold">Leitura do especialista</p>
          </div>
          <div className="space-y-3 bg-white p-4 dark:bg-gray-900">
            <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
              <strong>{agg.top.label}</strong> concentra <strong>{pct1(agg.conc)}</strong> do desconto concedido
              (<strong>{formatCurrencyInt(agg.top.lbCedido)}</strong>) — desvio médio de {r3(agg.top.desvioMedio)}/L abaixo da tabela.
              No total a rede cedeu <strong>{formatCurrencyInt(cedidoGlobal)}</strong> por ajuste de bomba abaixo do cadastro.
            </p>
            <div className="rounded-xl border border-[#dbeafe] bg-[#f0f6ff] px-3.5 py-2.5 text-[12.5px] text-[#1e3a5f] dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
              <strong>Recomendação:</strong> padronizar um teto de desconto de bomba pela referência do produto mais disciplinado e revisar os ajustes de {agg.top.label}. <span className="text-gray-400 dark:text-gray-500">A IA diagnostica; a decisão e a execução são do gestor.</span>
            </div>
            <button type="button" disabled title="Execução é roadmap — o módulo é read-only (diagnóstico)"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-400 dark:border-gray-700">
              <Lock className="h-3.5 w-3.5" /> Criar tarefa <span className="text-[10px] font-normal">(roadmap)</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal "de onde cedeu" — quebra pela outra dimensão */}
      <Dialog open={!!aberto} onOpenChange={(o) => { if (!o) setAberto(null) }}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0">
          {aberto && (
            <>
              <div className="border-b border-gray-100 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-5 py-3.5 text-white dark:border-gray-800">
                <DialogTitle className="text-[15px] font-bold">De onde cedeu — {aberto.label}</DialogTitle>
                <DialogDescription className="mt-0.5 text-[12px] text-white/70">
                  −{formatCurrencyInt(aberto.lbCedido)} cedido · quebra por {outroLabel.toLowerCase()}
                </DialogDescription>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 bg-white dark:bg-gray-900">
                    <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
                      <th className="px-4 py-2 font-semibold">{outroLabel}</th>
                      <th className="px-2 py-2 text-right font-semibold">Desvio R$/L</th>
                      <th className="px-2 py-2 text-right font-semibold">Volume</th>
                      <th className="px-4 py-2 text-right font-semibold">LB cedido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {aberto.detalhe.map((d) => (
                      <tr key={d.key}>
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{d.label}</td>
                        <td className={cn('px-2 py-2 text-right tabular-nums', d.desvioMedio > 0.0005 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(d.desvioMedio)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatLiters(d.volume)}</td>
                        <td className={cn('px-4 py-2 text-right font-bold tabular-nums', d.lbCedido > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{d.lbCedido > 0 ? `−${formatCurrencyInt(d.lbCedido)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-gray-100 px-5 py-2.5 text-[10.5px] text-gray-400 dark:border-gray-800">
                {BASE_DESVIO_LABEL} · só abastecimentos com preço de tabela.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const GestaoPrecos = () => {
  const data = useGestaoPrecos()
  const [sub, setSub] = useState<SubId>('produto')

  const cov = data.cobertura
  const covTone = cov.pct >= 80 ? 'emerald' : cov.pct >= 40 ? 'amber' : 'red'

  return (
    <div className="space-y-4">
      {/* Faixa única: o que a tela cruza + selo IA + base, com a cobertura no rodapé */}
      <div className="overflow-hidden rounded-xl border border-blue-200 dark:border-blue-900/40">
        <div className="flex flex-wrap items-center gap-3 bg-blue-50 px-4 py-2.5 dark:bg-blue-950/20">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white"><Tag className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Gestão de Preços — desvio de bomba + acréscimos e descontos</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              A IA cruza o preço de tabela com o praticado na bomba (o ajuste abaixo da tabela = margem cedida) e soma os acréscimos e descontos das vendas. O consolidado <strong className="font-semibold text-gray-700 dark:text-gray-300">Acrés./Desc.</strong> mostra se, no total, o produto <span className="font-semibold text-red-600 dark:text-red-400">cedeu</span> margem ou <span className="font-semibold text-emerald-600 dark:text-emerald-400">acrescentou</span> no período.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#1e3a5f] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            <Sparkles className="h-3 w-3" /> Analista IA
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {BASE_DESVIO_LABEL}
          </span>
        </div>
        <div className="flex items-center gap-2 border-t border-blue-200/70 bg-blue-50 px-4 py-2 text-[12px] text-gray-600 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-gray-400">
          {covTone === 'emerald' ? <ShieldCheck className="h-4 w-4 shrink-0 text-[#2563eb] dark:text-blue-400" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-[#2563eb] dark:text-blue-400" />}
          <span>
            <strong className="text-gray-800 dark:text-gray-200">Cobertura {pct1(cov.pct)}</strong> — {cov.comTabela.toLocaleString('pt-BR')}/{cov.totalFills.toLocaleString('pt-BR')} abastecimentos com preço de tabela.
            {cov.pct < 80 && ' Número parcial — abastecimentos sem cadastro de preço ficam de fora.'}
          </span>
          <InfoHint side="left" className="ml-auto" text="Mede quantos abastecimentos têm preço de tabela (preco_cadastro). Sem ele, o desvio não é calculável e o abastecimento sai da conta. Sobe quando o cron de apuração carimba o preço no cache." />
        </div>
      </div>

      {/* Sub-abas */}
      <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
        {SUB_TABS.map((t) => {
          const active = sub === t.id
          return (
            <button key={t.id} type="button" disabled={t.lock} onClick={() => !t.lock && setSub(t.id)}
              title={t.lock ? 'Depende da ingestão das tabelas do WebPosto (Fase 2)' : undefined}
              className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                active ? 'bg-[#1e3a5f] text-white shadow-sm'
                : t.lock ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200')}>
              {t.lock && <Lock className="h-3 w-3" />}{t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      {sub === 'tabelas' ? (
        <GestaoPrecosTabelas />
      ) : sub === 'cliente' ? (
        <GestaoPrecosCliente />
      ) : data.isLoading && data.byProduto.length === 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : sub === 'produto' ? (
        <AbaDesvio rows={data.byProduto} cedidoGlobal={data.global.lbCedido} entidade="produto" />
      ) : sub === 'empresa' ? (
        <AbaDesvio rows={data.byPosto} cedidoGlobal={data.global.lbCedido} entidade="posto" />
      ) : null}
    </div>
  )
}

export default GestaoPrecos
