import { useMemo, useState } from 'react'
import { Tag, Sparkles, Lock, AlertTriangle, ShieldCheck, Crosshair } from 'lucide-react'
import useGestaoPrecos, { type GestaoPrecoRow } from '@/pages/Dashboard/hooks/useGestaoPrecos'
import { BASE_DESVIO_LABEL, severidadeCedido, type SeveridadeCedido } from '@/lib/gestaoPrecos'
import { formatCurrencyInt, formatLiters } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const r3 = (v: number) => `${v < 0 ? '−' : ''}R$ ${Math.abs(v).toFixed(3).replace('.', ',')}`
const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const SEV_TEXT: Record<SeveridadeCedido, string> = {
  alto: 'text-red-600 dark:text-red-400',
  medio: 'text-amber-600 dark:text-amber-400',
  baixo: 'text-emerald-600 dark:text-emerald-400',
}
const SEV_ROW: Record<SeveridadeCedido, string> = {
  alto: 'bg-red-50/60 dark:bg-red-950/15',
  medio: 'bg-amber-50/50 dark:bg-amber-950/[0.12]',
  baixo: '',
}

type SubId = 'produto' | 'empresa' | 'lb' | 'cliente' | 'tabelas'
const SUB_TABS: { id: SubId; label: string; lock?: boolean; soon?: boolean }[] = [
  { id: 'produto', label: 'Por produto' },
  { id: 'empresa', label: 'Por empresa', soon: true },
  { id: 'lb', label: 'Impacto no LB', soon: true },
  { id: 'cliente', label: 'Por cliente', lock: true },
  { id: 'tabelas', label: 'Tabelas cadastradas', lock: true },
]

/* ── KPI ── */
const Kpi = ({ label, value, sub, tone, help }: {
  label: string; value: string; sub?: string; tone?: 'red' | 'amber' | 'green' | 'navy'; help: string
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
  </div>
)

/* ── Aba "Por produto" ── */
const PorProduto = ({ rows, cedidoGlobal }: { rows: GestaoPrecoRow[]; cedidoGlobal: number }) => {
  const agg = useMemo(() => {
    let vol = 0, tabW = 0, pratW = 0
    for (const r of rows) { vol += r.volume; tabW += r.precoTabelaMedio * r.volume; pratW += r.precoPraticadoMedio * r.volume }
    const tabela = vol > 0 ? tabW / vol : 0
    const praticado = vol > 0 ? pratW / vol : 0
    const vsTabelaPct = tabela > 0 ? (praticado / tabela - 1) * 100 : 0
    const top = rows[0] ?? null
    const conc = top && cedidoGlobal > 0 ? (top.lbCedido / cedidoGlobal) * 100 : 0
    return { tabela, praticado, desvio: tabela - praticado, vsTabelaPct, top, conc }
  }, [rows, cedidoGlobal])

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Nenhum abastecimento com preço de tabela no período/escopo.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Desconto concedido" tone="red" value={`−${formatCurrencyInt(cedidoGlobal)}`}
          sub="margem cedida no período (cedido)" help="Soma do lucro bruto cedido por vender abaixo da tabela: Σ (preço de tabela − praticado) × volume, só dos abastecimentos em que se vendeu abaixo. Derivado · base física." />
        <Kpi label="Praticado vs tabela" tone={agg.vsTabelaPct < 0 ? 'red' : 'green'}
          value={pct1(agg.vsTabelaPct)} sub={`desvio médio ${r3(agg.desvio)}/L`}
          help="Preço praticado médio (ponderado por volume) vs o preço de tabela. Negativo = abaixo da tabela. Fato (preços) · derivado (%)." />
        <Kpi label="Concentração do vazamento" tone="navy" value={agg.top?.label ?? '—'}
          sub={agg.top ? `${pct1(agg.conc)} do cedido · ${formatCurrencyInt(agg.top.lbCedido)}` : ''}
          help="Produto que mais puxa o desconto concedido — onde a recuperação tem maior alavancagem." />
        <Kpi label="Produtos com desvio" tone="amber" value={String(rows.filter((r) => r.lbCedido > 0).length)}
          sub={`de ${rows.length} no período`} help="Quantos combustíveis tiveram ao menos um abastecimento abaixo da tabela." />
      </div>

      {/* Tabela praticado × tabela */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="px-3 py-2 font-semibold">Produto</th>
              <th className="px-2 py-2 text-right font-semibold">Tabela</th>
              <th className="px-2 py-2 text-right font-semibold">Praticado</th>
              <th className="px-2 py-2 text-right font-semibold">Desvio R$/L</th>
              <th className="px-2 py-2 text-right font-semibold">Volume</th>
              <th className="px-2 py-2 text-right font-semibold">LB cedido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {rows.map((r) => {
              const sev = severidadeCedido(r.pctCedido)
              const cedeu = r.desvioMedio > 0.0005
              return (
                <tr key={r.key} className={SEV_ROW[sev]}>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                    {r.label}
                    {cedeu && <span className={cn('ml-2 text-[10px] font-bold uppercase tracking-wide', SEV_TEXT[sev])}>cedeu</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r3(r.precoTabelaMedio)}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{r3(r.precoPraticadoMedio)}</td>
                  <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', cedeu ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{r3(r.desvioMedio)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatLiters(r.volume)}</td>
                  <td className={cn('px-2 py-2 text-right font-bold tabular-nums', cedeu ? SEV_TEXT[sev] : 'text-gray-400')}>{r.lbCedido > 0 ? `−${formatCurrencyInt(r.lbCedido)}` : '—'}</td>
                </tr>
              )
            })}
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
    </div>
  )
}

const SoonCard = ({ fase }: { fase: string }) => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Em construção</p>
    <p className="mt-1 text-[12px] text-gray-400">{fase}</p>
  </div>
)

const GestaoPrecos = () => {
  const data = useGestaoPrecos()
  const [sub, setSub] = useState<SubId>('produto')

  const cov = data.cobertura
  const covTone = cov.pct >= 80 ? 'emerald' : cov.pct >= 40 ? 'amber' : 'red'

  return (
    <div className="space-y-4">
      {/* Faixa-flag: o que a tela cruza + selo Analista IA + base */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white"><Tag className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Gestão de Preços — preço de tabela × batido na bomba</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            A IA cruza o preço de cadastro do abastecimento com o preço praticado — o ajuste de bomba abaixo da tabela aparece como margem cedida.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#1e3a5f] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          <Sparkles className="h-3 w-3" /> Analista IA
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {BASE_DESVIO_LABEL}
        </span>
      </div>

      {/* Badge de cobertura — desde o 1º render (número sem cobertura visível, não) */}
      <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]',
        covTone === 'emerald' ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
        : covTone === 'amber' ? 'border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
        : 'border-red-200 bg-red-50/60 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300')}>
        {covTone === 'emerald' ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span>
          <strong>Cobertura {pct1(cov.pct)}</strong> — {cov.comTabela.toLocaleString('pt-BR')}/{cov.totalFills.toLocaleString('pt-BR')} abastecimentos com preço de tabela.
          {cov.pct < 80 && ' Número parcial — abastecimentos sem cadastro de preço ficam de fora.'}
        </span>
        <InfoHint side="left" className="ml-auto" text="Mede quantos abastecimentos têm preço de tabela (preco_cadastro). Sem ele, o desvio não é calculável e o abastecimento sai da conta. Sobe quando o cron de apuração carimba o preço no cache." />
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
      {data.isLoading && data.byProduto.length === 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : sub === 'produto' ? (
        <PorProduto rows={data.byProduto} cedidoGlobal={data.global.lbCedido} />
      ) : sub === 'empresa' ? (
        <SoonCard fase="Por empresa — Fase 1.3" />
      ) : sub === 'lb' ? (
        <SoonCard fase="Impacto no LB — Fase 1.4" />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <Lock className="mx-auto mb-2 h-5 w-5 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Fase 2 — depende da ingestão das tabelas</p>
          <p className="mt-1 text-[12px] text-gray-400">A "Tabela de Preço de Prazos" do WebPosto não vem na API; será espelhada no Supabase (como a concorrência) pra alimentar atribuição nomeada e preço de contrato.</p>
        </div>
      )}
    </div>
  )
}

export default GestaoPrecos
