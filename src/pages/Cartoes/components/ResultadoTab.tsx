import { Sparkles, TriangleAlert, CircleCheck, Clock, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber, formatDate } from '@/lib/formatters'
import type { CartoesResult, StatusKind } from '@/pages/Cartoes/hooks/useCartoesConciliacao'

const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const STATUS: Record<StatusKind, { label: string; cls: string; dot: string }> = {
  conciliado: { label: 'Conciliado', cls: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  valor_divergente: { label: 'Valor divergente', cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  sem_repasse: { label: 'Sem repasse', cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  aguardando: { label: 'Aguardando', cls: 'text-amber-700 dark:text-amber-500', dot: 'bg-amber-500' },
}

const ResultadoTab = ({ data, isLoading }: { data?: CartoesResult; isLoading: boolean }) => {
  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      </div>
    )
  }
  if (!data) return <p className="px-5 py-12 text-center text-sm text-gray-400">Selecione um período pra conciliar.</p>

  const { coverage, kpis, adminDia } = data

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
        </div>

        {/* Aguardando repasse (topo âmbar) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="h-1 w-full rounded-full bg-amber-500" />
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            <Clock className="h-3.5 w-3.5" /> Aguardando repasse
          </p>
          <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-gray-100">{formatCurrencyInt(kpis.aguardando.valor)}</p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">{formatNumber(kpis.aguardando.registros)}</span> registros · <span className="font-medium text-amber-600 dark:text-amber-500">EDI ainda não chegou</span>
          </p>
        </div>
      </div>

      {/* Tabela administradora × dia */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <CircleCheck className="h-4 w-4 text-gray-400" /> Resumo por administradora × dia
          </h3>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Cada lote do adquirente cruzado com as vendas do sistema.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Administradora</th>
                <th className="px-3 py-2 text-left font-semibold">Dia</th>
                <th className="px-3 py-2 text-right font-semibold">Bruto sistema</th>
                <th className="px-3 py-2 text-right font-semibold">Bruto repasse</th>
                <th className="px-3 py-2 text-right font-semibold">Δ</th>
                <th className="px-3 py-2 text-right font-semibold">Taxa %</th>
                <th className="px-3 py-2 text-right font-semibold">Líquido</th>
                <th className="px-5 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {adminDia.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">Sem vendas de cartão no período.</td></tr>
              )}
              {adminDia.map((r) => {
                const s = STATUS[r.status]
                return (
                  <tr key={r.key} className="text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/40">
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
