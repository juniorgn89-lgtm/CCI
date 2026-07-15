import { useState } from 'react'
import { Sparkles, TriangleAlert, CircleCheck, Clock, CircleAlert, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber, formatDate } from '@/lib/formatters'
import HeaderHint from '@/components/tables/HeaderHint'
import type { CartoesResult, CartoesView, StatusKind } from '@/pages/Cartoes/hooks/useCartoesConciliacao'

const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const STATUS: Record<StatusKind, { label: string; cls: string; dot: string }> = {
  conciliado: { label: 'Conciliado', cls: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  a_creditar: { label: 'Vinculado · a creditar', cls: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500' },
  valor_divergente: { label: 'Valor divergente', cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  sem_repasse: { label: 'Sem repasse', cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  aguardando: { label: 'Aguardando', cls: 'text-amber-700 dark:text-amber-500', dot: 'bg-amber-500' },
}

const ResultadoTab = ({ coverage, view, empresaNome, isLoading, tratadosCount, onRowClick }: { coverage?: CartoesResult['coverage']; view?: CartoesView; empresaNome: Map<number, string>; isLoading: boolean; tratadosCount: number; onRowClick?: (empresaCodigo: number, bandeira: string, dia: string) => void }) => {
  const nomePosto = (c: number) => empresaNome.get(c) || `Posto ${c}`
  // "Não conciliado" abre primeiro (é o que precisa de ação).
  const [subTab, setSubTab] = useState<'nao' | 'conc'>('nao')
  if (isLoading && !view) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      </div>
    )
  }
  if (!view || !coverage) return <p className="px-5 py-12 text-center text-sm text-gray-400">Selecione um período pra conciliar.</p>

  const { kpis, adminDia } = view
  const naoConc = adminDia.filter((r) => r.status !== 'conciliado')
  const conc = adminDia.filter((r) => r.status === 'conciliado')
  const rows = subTab === 'conc' ? conc : naoConc

  return (
    <div className="space-y-4">
      {/* Faixa Analista IA */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Analista IA
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
              base: /CARTAO × /CARTAO_REMESSA
            </span>
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
            Conciliação de cartão — <strong>sistema × repasse do adquirente</strong>. A IA cruza cada venda de cartão com o lote de repasse da adquirente (por bandeira e dia), confere valor e prazo, e destaca o que não fechou. Diagnóstico, não ação — o lançamento é do gestor no ERP.
          </p>
        </div>
      </div>

      {/* Strip de cobertura do EDI */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/15">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-amber-800 dark:text-amber-300">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {coverage.ediUpTo ? (
              <>Repasse (EDI) carregado até <strong>{formatDate(coverage.ediUpTo)}</strong> — os dias após isso estão <strong>aguardando repasse</strong>, não são divergência.</>
            ) : (
              <>Nenhum repasse (EDI) carregado no período — tudo <strong>aguardando</strong> ou pendente, nada é marcado como divergência.</>
            )}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">{coverage.pctPeriodo}% do período coberto</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/50 dark:bg-amber-900/30">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${coverage.pctPeriodo}%` }} />
        </div>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Conciliado (hero navy) */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 text-white shadow-lg">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Conciliado
          </p>
          <p className="mt-2 text-[32px] font-extrabold tabular-nums leading-none">{formatCurrencyInt(kpis.conciliado.valor)}</p>
          <p className="mt-2 text-[13px] text-white/75">
            <span className="tabular-nums">{formatNumber(kpis.conciliado.registros)}</span> registros · <span className="font-semibold text-emerald-300">{fmtPct(kpis.pctConciliavel)}</span> do conciliável
          </p>
          <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full bg-emerald-400" style={{ width: `${kpis.pctConciliavel}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${100 - kpis.pctConciliavel}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/50">
            <span>Conciliado</span><span>Sem conciliar</span>
          </div>
        </div>

        {/* Sem conciliar (topo vermelho) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="h-1 w-full rounded-full bg-red-500" />
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            <CircleAlert className="h-3.5 w-3.5" /> Sem conciliar
          </p>
          <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-gray-100">{formatCurrencyInt(kpis.semConciliar.valor)}</p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">{formatNumber(kpis.semConciliar.registros)}</span> registros · <span className="font-medium text-red-600 dark:text-red-400">precisam de lançamento</span>
          </p>
          {tratadosCount > 0 && (
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              · <span className="font-semibold text-gray-500 dark:text-gray-400">{tratadosCount}</span> já tratados (marcados como lançados no ERP)
            </p>
          )}
        </div>

        {/* Aguardando repasse (topo âmbar) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="h-1 w-full rounded-full bg-amber-500" />
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            <Clock className="h-3.5 w-3.5" /> Aguardando / a creditar
          </p>
          <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-gray-100">{formatCurrencyInt(kpis.aguardando.valor)}</p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">{formatNumber(kpis.aguardando.registros)}</span> registros · <span className="font-medium text-amber-600 dark:text-amber-500">vinculado ou EDI não creditou ainda</span>
          </p>
        </div>
      </div>

      {/* Tabela administradora × dia */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <CircleCheck className="h-4 w-4 text-gray-400" /> Resumo por administradora × dia
              </h3>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Cada lote do adquirente cruzado com as vendas do sistema.</p>
            </div>
            <div className="inline-flex items-center gap-0.5 self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
              {([['nao', 'Não conciliado', naoConc.length], ['conc', 'Conciliado', conc.length]] as const).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSubTab(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
                    subTab === id
                      ? id === 'conc' ? 'bg-emerald-600 text-white' : 'bg-[#1e3a5f] text-white'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                  )}
                >
                  {label}
                  <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', subTab === id ? 'bg-white/20' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300')}>{n}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
              <tr>
                <HeaderHint align="left" className="px-5" label="Administradora" help="Bandeira/adquirente do cartão (ex.: VISA DÉBITO GETNET) e a modalidade (débito/crédito)." />
                <HeaderHint align="left" label="Posto" help="Empresa/posto da rede onde o recebível liquidou. A conciliação é por posto — igual ao WebPosto." />
                <HeaderHint align="left" label="Dia" help="Dia de LIQUIDAÇÃO (dataPagamento) — quando o adquirente credita. É por ele que casamos com o repasse do EDI, não pelo dia da venda." />
                <HeaderHint label="Bruto sistema" help="Soma dos recebíveis do sistema (/CARTAO) que liquidam neste dia, por bandeira e posto." />
                <HeaderHint label="Bruto repasse" help="Bruto do lote repassado pelo adquirente (/CARTAO_REMESSA) neste dia." />
                <HeaderHint label="Δ" help="Diferença sistema − repasse. Zero (dentro de centavos) = conciliado." />
                <HeaderHint label="Taxa %" help="Taxa APLICADA pelo adquirente no lote (taxa em R$ ÷ bruto). É fato do EDI — a divergência de taxa contratada fica fora desta fase." />
                <HeaderHint label="Líquido" help="Valor líquido creditado pelo adquirente (bruto − taxa)." />
                <HeaderHint align="left" className="px-5" label="Status" help="Conciliado (bate) · Valor divergente (lote difere) · Sem repasse (venceu e não veio) · Aguardando (EDI ainda não carregou o dia)." />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-400">
                  {adminDia.length === 0 ? 'Sem vendas de cartão no período.' : subTab === 'nao' ? 'Nada pendente — tudo conciliado ou aguardando.' : 'Nada conciliado ainda neste período.'}
                </td></tr>
              )}
              {rows.map((r) => {
                const s = STATUS[r.status]
                const clicavel = !!onRowClick && (r.status === 'sem_repasse' || r.status === 'valor_divergente')
                return (
                  <tr
                    key={r.key}
                    onClick={clicavel ? () => onRowClick!(r.empresaCodigo, r.bandeira, r.dia) : undefined}
                    title={clicavel ? 'Ver no Detalhamento' : undefined}
                    className={cn('text-gray-700 dark:text-gray-300', clicavel ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/15' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}
                  >
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] font-bold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {r.bandeira.slice(0, 4)}
                        </span>
                        <span>
                          <span className="block font-medium text-gray-900 dark:text-gray-100">{r.bandeira}</span>
                          {r.tipo && <span className="block text-[11px] text-gray-400">{r.tipo}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{nomePosto(r.empresaCodigo)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-gray-500 dark:text-gray-400">{formatDate(r.dia)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(r.brutoSistema)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.brutoRepasse > 0 ? formatCurrency(r.brutoRepasse) : '—'}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', Math.abs(r.delta) < 0.005 ? 'text-gray-400' : 'font-semibold text-red-600 dark:text-red-400')}>
                      {formatCurrency(r.delta)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.brutoRepasse > 0 ? `${r.taxaPct.toFixed(2).replace('.', ',')}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.liquido > 0 ? formatCurrency(r.liquido) : '—'}</td>
                    <td className="px-5 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium', s.cls)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} /> {s.label}
                      </span>
                      {r.revisao && (
                        <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" title="Conciliado pela revisão automática (lote adjacente).">
                          revisão
                        </span>
                      )}
                      {clicavel && <ChevronRight className="ml-1.5 inline h-3.5 w-3.5 align-text-bottom text-gray-300 dark:text-gray-600" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
          Fonte: /CARTAO (sistema) × /CARTAO_REMESSA (adquirente/EDI) via GET. Taxa exibida é a APLICADA (fato do EDI); divergência de taxa contratada fica fora desta fase. Read-only — o lançamento é feito no ERP pelo gestor.
        </p>
      </div>
    </div>
  )
}

export default ResultadoTab
